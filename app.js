// Layouts, typography, and SVG paths come from the inspected Figma layers.
const app=document.querySelector('#app');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let saved;try{saved=JSON.parse(localStorage.getItem('brewlog-state'));}catch{}saved ||= {favorites:{},ratings:{},visits:[],lists:[],likes:{}};
const persist=()=>localStorage.setItem('brewlog-state',JSON.stringify(saved));
let route=location.hash.slice(1)||'journal',directory=[],filter='All',query='',pageSize=6,selectedCafe='',visitRating=0,collectionTab='Favorites';
const all=n=>[n,...(n.children||[]).flatMap(all)];
const words=n=>all(n).filter(c=>c.type==='TEXT').map(c=>c.text).join(' ');
const find=(n,id)=>all(n).find(c=>c.id===id);
const setText=(n,text)=>{if(n){n.text=String(text);n.runs=[{text:String(text),s:{}}];}};
function nameOf(c){let name=String(c.name||'');for(const city of c.cities||[]){const literal=city.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');name=name.replace(new RegExp('\\s*(?:—|-|\\(|,)\\s*'+literal+'(?:,\\s*CA)?\\)?$','i'),'');}return name.replace(/\s+—\s+[^,]+,\s*CA$/i,'').replace(/\s+\([^)]{2,30}\)$/,'').trim();}
function css(style){return Object.entries(style).filter(([k])=>!k.startsWith('border')||k==='borderRadius').map(([k,v])=>`${k.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())}:${typeof v==='number'&&!['fontWeight','opacity','zIndex'].includes(k)?v+'px':v}`).join(';');}
function nodeHTML(n,context={}){
 let ctx={...context},tag='div',attrs='',style={...n.s},content='';
 if(n.name==='CafeCard'){ctx.cafe=n.cafeName||'';attrs+=` data-cafe="${esc(ctx.cafe)}"`;}
 const text=words(n).trim();
 if(n.name.startsWith('Button')&&!n.name.includes(':margin')){
  tag='button';attrs+=' type="button"';let action=n.action;
  if(n.id==='6:100')action='collection-favorites';if(n.id==='6:104')action='collection-lists';
  if(text==='CAFECITO'||text==='DOPPIO')action='home';
  if(!action&&n.name.includes('stars')){action=route==='log'?'visit-rate':'rate';attrs+=` data-rating="${n.name.match(/(\d) stars/)[1]}"`;}
  if(!action&&/favorit/i.test(n.name))action='favorite';
  if(!action&&text==='Log visit')action='log';if(!action&&text==='Favorites')action='favorites';if(!action&&text==='Lists')action='lists';
  if(!action&&text==='Like'){action='like';attrs+=` data-like="${n.id}"`;}
  if(!action&&text==='Save to diary')action='save-visit';if(!action&&text==='Find people')action='people';
  if(!action&&n.children.some(c=>c.name==='PlusIcon')&&!text)action='log';if(!action&&n.children.some(c=>c.name==='ArrowIcon')&&!text)action='lists';
  if(n.id==='1:20')action='favorites';if(n.id==='1:34')action='want';if(n.id==='1:45')action='new-list';
  if(['2:32','2:35','2:37','2:39'].includes(n.id)){action='filter';attrs+=` data-filter="${text}"`;style.background=filter===text?'#171713':'transparent';style.color=filter===text?'white':'#77766f';}
  if(action)attrs+=` data-action="${action}"`;attrs+=` aria-label="${esc(n.name.startsWith('Button - ')?n.name.slice(9):text||action||'Open')}"`;
  if(action==='save-visit')attrs+=' disabled';
 }
 if(n.name==='Link'){tag='button';attrs+=` type="button" data-action="${text==='Export journal'?'export':'settings'}"`;}
 if(n.type==='TEXT'){
  tag=/Heading 1/.test(context.parent||'')?'h1':/Heading 3/.test(context.parent||'')?'h3':'span';if(context.filterButton)style.color='inherit';
  if(style.height<=(style.lineHeight||style.fontSize)*1.6&&!n.text.includes('\n'))style.whiteSpace='pre';
  content=(n.runs||[{text:n.text,s:{}}]).map(r=>`<span style="${css(r.s)}">${esc(r.text)}</span>`).join('');
 }else if(n.paths){tag='svg';attrs+=` viewBox="0 0 ${n.view[0]} ${n.view[1]}" aria-hidden="true"`;content=n.paths.map(p=>`<path d="${esc(p.d)}" fill="${p.fill}" fill-rule="${p.rule}"></path>`).join('');}
 else{content=(n.s.borderWidth?`<span aria-hidden="true" class="layer-border" style="border-style:solid;border-color:${n.s.borderColor};border-width:${n.s.borderWidth};border-radius:inherit"></span>`:'')+(n.children||[]).map(child=>nodeHTML(child,{...ctx,parent:n.name,filterButton:attrs.includes('data-action="filter"')||context.filterButton})).join('');}
 if(n.name==='Text Input'&&route==='cafes')return `<input class="layer native-input" style="${css(style)}" id="search" aria-label="Search cafés or tags" placeholder="Search your cafés or tags..." value="${esc(query)}">`;
 if(n.id==='5:696')return `<select class="layer native-input cafe-select" style="${css(style)}" id="visitCafe" aria-label="Café">${(directory.length?directory:examples).map(c=>`<option value="${esc(nameOf(c))}" ${nameOf(c)===selectedCafe?'selected':''}>${esc(nameOf(c))}</option>`).join('')}<option value="__new">Add a café not listed</option></select>`;
 if(n.id==='5:731')return `<input class="layer native-input" style="${css(style)}" id="visitOrder" aria-label="Your order" placeholder="What did you have?" required>`;
 if(n.id==='5:739')return `<textarea class="layer native-input" style="${css(style)}" id="visitComment" aria-label="Comment (optional)" placeholder="Taste, atmosphere, company, or anything worth remembering..."></textarea>`;
 return `<${tag} class="layer ${n.type==='TEXT'?'layer-text':''}" data-node="${n.id}"${attrs} style="${css(style)}">${content}</${tag}>`;
}
const examples=[{name:'Subtext Coffee',source:'Added from a friend',tags:['Pour over','Quiet'],status:'Logged',rating:5,favorite:true},{name:'Kawa',source:'Saved from the weekend list',tags:['Espresso','Pastries'],status:'Next up',rating:0,favorite:true},{name:'Lowkey',source:'Recommended by Mia',tags:['Light roast','Design'],status:'Logged',rating:4,favorite:true},{name:'Assembly',source:'Saved from Field Notes',tags:['Roastery','Espresso'],status:'Next up',rating:0,favorite:true},{name:'Process',source:'On the summer list',tags:['Natural','Social'],status:'Someday',rating:0},{name:'Drip',source:'Saved from Sam',tags:['Brunch','Outdoor'],status:'Someday',rating:0}];
function cafeState(c){const key=nameOf(c);return {...c,name:key,favorite:saved.favorites[key]??c.favorite,rating:saved.ratings[key]??c.rating};}
function makeCard(template,c,index){
 const card=structuredClone(template);card.cafeName=c.name;card.s.top=1+index*254;const nodes=all(card),texts=nodes.filter(n=>n.type==='TEXT');
 setText(texts[0],c.status||'Want to try');setText(texts[1],c.source||'From Notion');setText(texts[2],c.name);texts[2].s.width=330;
 const tags=(c.tags||[]).filter(t=>!(c.cities||[]).includes(t));setText(texts[3],tags[0]||'');setText(texts[4],tags[1]||'');
 for(const n of nodes.filter(n=>n.name.startsWith('Button - ')&&!n.name.includes(':margin'))){if(n.name.includes('stars')){const score=Number(n.name.match(/(\d) stars/)[1]);for(const p of all(n).flatMap(n=>n.paths||[]))p.fill=score<=c.rating?'#f04e23':'#b6b4a9';}else if(/favorit/i.test(n.name)){n.action='favorite';n.name=`Button - ${c.favorite?'Remove':'Add'} ${c.name} ${c.favorite?'from':'to'} favorites`;n.s.background=c.favorite?'#f04e23':'transparent';}}
 return card;
}
function render(){
 const design=structuredClone(FIGMA_DESIGNS[route]||FIGMA_DESIGNS.journal);design.children.splice(1,1);
 for(const n of all(design).filter(n=>n.type==='TEXT'&&['DOPPIO','DOPPIO®'].includes(n.text)))setText(n,'CAFECITO');
 if(route==='cafes'){
  const box=find(design,'2:41'),template=box.children[0];const matches=(directory.length?directory:examples).map(cafeState).filter(c=>(filter==='All'||filter==='Favorites'&&c.favorite||filter==='Logged'&&c.status==='Logged'||filter==='Want to try'&&c.status!=='Logged')&&[c.name,...(c.tags||[]).filter(t=>!(c.cities||[]).includes(t))].join(' ').toLowerCase().includes(query.toLowerCase()));
  const shown=matches.slice(0,pageSize),height=Math.max(shown.length*254+1,100),delta=height-1525;box.children=shown.map((c,i)=>makeCard(template,c,i));box.s.height=height;find(design,'2:322').s.height+=delta;find(design,'2:7').s.height+=delta;find(design,'2:323').s.top+=delta;design.s.height+=delta;
  if(!shown.length)box.children=[{id:'empty',type:'TEXT',name:'Empty',s:{left:15,top:30,width:330,height:40,fontSize:13,lineHeight:20},text:'No cafés match this view.',children:[]}];
  if(matches.length>pageSize)box.children.push({id:'more',type:'FRAME',name:'Button',action:'more',s:{left:0,top:height+10,width:366,height:40},children:[{id:'more-text',type:'TEXT',name:'More',s:{left:0,top:0,width:366,height:40,fontSize:11,lineHeight:40,textAlign:'center'},text:`Show more (${matches.length-shown.length})`,children:[]}]});
 }
 if(route==='journal'){
  for(const [id,c] of [['6:110',examples[1]],['6:159',examples[3]]]){const target=find(design,id),replacement=makeCard(target,cafeState(c),0);replacement.s.top=target.s.top;Object.assign(target,replacement);}
  if(saved.visits.length){const v=saved.visits[0];setText(find(design,'6:71'),v.cafe);setText(find(design,'6:73'),v.order);setText(find(design,'6:60'),new Date(v.date).getDate());setText(find(design,'6:63'),new Date(v.date).toLocaleDateString('en-US',{month:'short',year:'numeric'}));setText(find(design,'6:27'),String(2+saved.visits.length).padStart(2,'0'));}
  if(collectionTab==='Lists'){
   const box=find(design,'6:109'),listBox=structuredClone(find(FIGMA_DESIGNS.lists,'1:19'));box.children=listBox.children;box.s.height=634;
   find(design,'6:206').s.top+=125;design.s.height+=125;
   find(design,'6:103').s.background='transparent';find(design,'6:105').s.color='#171713';find(design,'6:101').s.color='#77766f';
   find(design,'6:104').children.push({id:'list-underline',name:'Underline',type:'FRAME',s:{left:8,top:86,width:42,height:4,background:'#f04e23'},children:[]});
  }
 }
 if((route==='lists'||route==='journal'&&collectionTab==='Lists')&&saved.lists.length){const container=find(design,route==='lists'?'1:19':'6:109'),template=container.children[1];saved.lists.forEach((list,i)=>{const card=structuredClone(template);card.id='custom-'+i;card.s.top=423+i*211;card.action='custom-list';const texts=all(card).filter(x=>x.type==='TEXT');setText(texts[0],`${String(i+3).padStart(2,'0')} / PERSONAL`);setText(texts[1],list.name);setText(texts[2],`${list.cafes.length} cafés`);container.children.splice(container.children.length-1,0,card);});const delta=saved.lists.length*211;find(design,'1:45').s.top+=delta;container.s.height+=delta;find(design,route==='lists'?'1:56':'6:206').s.top+=delta;design.s.height+=delta;}
 document.body.dataset.route=route;app.innerHTML=`<div class="design-viewport" style="height:${design.s.height}px"><div class="design-frame" style="height:${design.s.height}px">${design.children.map(n=>nodeHTML(n)).join('')}</div></div>`;
 document.querySelectorAll('.bottom-nav button').forEach(b=>{b.classList.toggle('active',b.dataset.route===route);b.setAttribute('aria-current',b.dataset.route===route?'page':'false');});resize();bind();
}
function resize(){const scale=Math.min(innerWidth,402)/402;document.documentElement.style.setProperty('--design-scale',scale);const frame=document.querySelector('.design-frame');if(frame)document.querySelector('.design-viewport').style.height=parseFloat(frame.style.height)*scale+'px';}
function go(next){route=next;location.hash=next;render();window.scrollTo(0,0);}
function modal(title,body){const el=document.createElement('dialog');el.className='modal';el.innerHTML=`<form method="dialog"><button class="close-modal" aria-label="Close">×</button></form><h2>${title}</h2>${body}`;document.body.append(el);el.addEventListener('close',()=>el.remove());el.showModal();return el;}
function bind(){document.querySelectorAll('[data-action]').forEach(button=>button.onclick=()=>{
 const action=button.dataset.action,name=button.closest('[data-cafe]')?.dataset.cafe;
 if(action==='home')go('journal');
 if(action==='collection-favorites'||action==='collection-lists'){collectionTab=action==='collection-lists'?'Lists':'Favorites';render();}
 if(action==='log'){selectedCafe=name||selectedCafe;visitRating=0;go('log');}if(action==='lists')go('lists');
 if(action==='favorites'||action==='want'){filter=action==='favorites'?'Favorites':'Want to try';pageSize=6;go('cafes');}
 if(action==='filter'){filter=button.dataset.filter;pageSize=6;render();}if(action==='more'){pageSize+=12;render();}
 if(action==='favorite'){saved.favorites[name]=!(saved.favorites[name]??[...examples,...directory].find(c=>nameOf(c)===name)?.favorite);persist();render();}
 if(action==='rate'){saved.ratings[name]=Number(button.dataset.rating);persist();render();}
 if(action==='visit-rate'){visitRating=Number(button.dataset.rating);document.querySelectorAll('[data-action="visit-rate"]').forEach(b=>b.classList.toggle('chosen',Number(b.dataset.rating)<=visitRating));const value=document.querySelector('[data-node="5:724"]');if(value)value.textContent=visitRating.toFixed(1);validateVisit();}
 if(action==='save-visit'){const order=document.querySelector('#visitOrder');if(!order.value.trim()||!visitRating){order.reportValidity();toast('Choose a visit rating and enter your order.');return;}saved.visits.unshift({cafe:document.querySelector('#visitCafe').value,order:order.value.trim(),comment:document.querySelector('#visitComment').value,rating:visitRating,date:new Date().toISOString()});persist();go('journal');toast('Visit saved to your journal on this device.');}
 if(action==='like'){saved.likes[button.dataset.like]=!saved.likes[button.dataset.like];persist();button.classList.toggle('liked',saved.likes[button.dataset.like]);}
 if(action==='new-list'){const el=modal('New list','<form id="newListForm"><label for="listName">LIST NAME</label><input id="listName" required placeholder="e.g. Weekend coffee stops"><button class="solid" type="submit">CREATE LIST</button></form>');el.querySelector('#newListForm').onsubmit=e=>{e.preventDefault();saved.lists.push({name:el.querySelector('#listName').value.trim(),cafes:[]});persist();el.close();render();};}
 if(action==='custom-list')modal('Your list','<p>This list is empty. New lists are saved on this device.</p>');
 if(action==='settings')modal('Settings','<p>Your visit logs, ratings, favorites, and lists are saved in this browser. The café directory is connected to Notion.</p><a href="#lists">Open your lists →</a>');
 if(action==='people')modal('Your circle','<p>This screen follows the Figma sample activity. Following people will need user accounts and a shared activity service.</p>');
 if(action==='export'){const link=document.createElement('a');link.href=URL.createObjectURL(new Blob([JSON.stringify(saved,null,2)],{type:'application/json'}));link.download='cafecito-journal.json';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);}
 });const cafeSelect=document.querySelector('#visitCafe');if(cafeSelect)cafeSelect.onchange=()=>{if(cafeSelect.value==='__new'){const el=modal('Add a café','<form id="addCafe"><label for="cafeName">CAFÉ NAME</label><input id="cafeName" required><button class="solid">ADD CAFÉ</button></form>');el.querySelector('#addCafe').onsubmit=e=>{e.preventDefault();const name=el.querySelector('#cafeName').value.trim();directory.unshift({name,status:'Want to try',tags:[]});const option=new Option(name,name,true,true);cafeSelect.add(option,0);selectedCafe=name;el.close();};}};const search=document.querySelector('#search');if(search)search.oninput=()=>{const caret=search.selectionStart;query=search.value;pageSize=6;render();const next=document.querySelector('#search');next.focus();next.setSelectionRange(caret,caret);};}
function validateVisit(){const save=document.querySelector('[data-action="save-visit"]');if(save)save.disabled=!(visitRating&&document.querySelector('#visitOrder')?.value.trim()&&document.querySelector('#visitCafe')?.value!=='__new');}
document.addEventListener('input',validateVisit);
function toast(message){document.querySelector('.toast')?.remove();const el=document.createElement('div');el.className='toast';el.setAttribute('role','status');el.textContent=message;document.body.append(el);setTimeout(()=>el.remove(),4000);}
document.querySelectorAll('.bottom-nav button').forEach(b=>b.onclick=()=>go(b.dataset.route));window.addEventListener('hashchange',()=>{route=location.hash.slice(1)||'journal';render();});window.addEventListener('resize',resize);render();
fetch('/api/cafes').then(r=>{if(!r.ok)throw Error('Directory unavailable');return r.json();}).then(data=>{directory=data.cafes||[];if(route==='cafes')render();}).catch(()=>console.info('Showing the Figma preview directory.'));
