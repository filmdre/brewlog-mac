// Layouts, typography, and SVG paths come from the inspected Figma layers.
const app=document.querySelector('#app');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const blankState=()=>({favorites:{},ratings:{},visits:[],lists:[],likes:{}});
const normalizeState=value=>{const state=value&&typeof value==='object'?value:{};return {favorites:state.favorites&&typeof state.favorites==='object'?state.favorites:{},ratings:state.ratings&&typeof state.ratings==='object'?state.ratings:{},visits:Array.isArray(state.visits)?state.visits:[],lists:Array.isArray(state.lists)?state.lists:[],likes:state.likes&&typeof state.likes==='object'?state.likes:{}};};
let saved;try{saved=normalizeState(JSON.parse(localStorage.getItem('brewlog-state')));}catch{saved=blankState();}
const account={client:null,user:null,ready:false,timer:null};
const persistLocal=()=>localStorage.setItem('brewlog-state',JSON.stringify(saved));
const saveCloud=async()=>{if(!account.client||!account.user||!account.ready)return;const {error}=await account.client.from('brewlog_state').upsert({user_id:account.user.id,state:saved},{onConflict:'user_id'});if(error)toast('Could not sync this change. It is still saved on this device.');};
const persist=()=>{persistLocal();if(account.user&&account.ready){clearTimeout(account.timer);account.timer=setTimeout(saveCloud,350);}};
function accountName(){return account.user?.email||'Signed out';}
async function loadAccountState(user){
 account.ready=false;account.user=user;
 if(!user){saved=blankState();persistLocal();render();return;}
 const {data,error}=await account.client.from('brewlog_state').select('state').eq('user_id',user.id).maybeSingle();
 if(error){toast('Account connected, but your journal could not be loaded.');account.ready=true;render();return;}
 if(data?.state){saved=normalizeState(data.state);persistLocal();}
 else {saved=blankState();persistLocal();account.ready=true;await saveCloud();}
 account.ready=true;render();
}
async function initAccounts(){
 try{const response=await fetch('/api/config');const config=await response.json();if(!config.configured||!window.supabase?.createClient)return;account.client=window.supabase.createClient(config.supabaseUrl,config.supabaseAnonKey);const {data}=await account.client.auth.getSession();if(data.session?.user)await loadAccountState(data.session.user);account.client.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_IN'||event==='SIGNED_OUT')setTimeout(()=>loadAccountState(session?.user||null),0);});}
 catch(error){console.info('Accounts are not configured yet.');}
}
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
 if(n.id==='5:696'){const cafeOptions=[...directory,...examples].map(c=>nameOf(c)).filter((name,index,list)=>name&&list.indexOf(name)===index);return `<input class="layer native-input cafe-select" style="${css(style)}" id="visitCafe" aria-label="Café" placeholder="Search or enter a café..." value="${esc(selectedCafe)}" list="cafe-options" autocomplete="off"><datalist id="cafe-options">${cafeOptions.map(name=>`<option value="${esc(name)}"></option>`).join('')}</datalist>`;}
 if(n.id==='5:731')return `<input class="layer native-input" style="${css(style)}" id="visitOrder" aria-label="Your order" placeholder="What did you have?" required>`;
 if(n.id==='5:739')return `<textarea class="layer native-input" style="${css(style)}" id="visitComment" aria-label="Comment (optional)" placeholder="Taste, atmosphere, company, or anything worth remembering..."></textarea>`;
 return `<${tag} class="layer ${n.type==='TEXT'?'layer-text':''}" data-node="${n.id}"${attrs} style="${css(style)}">${content}</${tag}>`;
}
const examples=[{name:'Subtext Coffee',source:'Added from a friend',tags:['Pour over','Quiet'],status:'Logged',rating:5,favorite:true},{name:'Kawa',source:'Saved from the weekend list',tags:['Espresso','Pastries'],status:'Next up',rating:0,favorite:true},{name:'Lowkey',source:'Recommended by Mia',tags:['Light roast','Design'],status:'Logged',rating:4,favorite:true},{name:'Assembly',source:'Saved from Field Notes',tags:['Roastery','Espresso'],status:'Next up',rating:0,favorite:true},{name:'Process',source:'On the summer list',tags:['Natural','Social'],status:'Someday',rating:0},{name:'Drip',source:'Saved from Sam',tags:['Brunch','Outdoor'],status:'Someday',rating:0}];
function cafeState(c){const key=nameOf(c);return {...c,name:key,favorite:saved.favorites[key]===true,rating:saved.ratings[key]??0};}
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
  const sourceCafes=[...directory,...examples],favoriteNames=Object.keys(saved.favorites).filter(key=>saved.favorites[key]===true),favorites=favoriteNames.map(name=>sourceCafes.find(c=>nameOf(c)===name)||{name,status:'Logged',tags:[]});
  const favoriteBox=find(design,'6:109');
  if(favorites.length){const template=favoriteBox.children[0];favoriteBox.children=favorites.slice(0,2).map((c,i)=>makeCard(template,cafeState(c),i));}
  else favoriteBox.children=[{id:'empty-favorites',type:'TEXT',name:'Empty favorites',s:{left:24,top:210,width:318,height:40,color:'rgba(241,240,232,1.0)',fontFamily:'Inter',fontSize:13,fontWeight:400,lineHeight:20,textAlign:'center'},text:'No favorites yet.',children:[]}];
  const visits=saved.visits,average=visits.length?visits.reduce((sum,visit)=>sum+Number(visit.rating||0),0)/visits.length:0;setText(find(design,'6:27'),String(visits.length).padStart(2,'0'));setText(find(design,'6:34'),average?average.toFixed(1):'0.0');setText(find(design,'6:39'),String(favorites.length));
  const rows=[['6:60','6:63','6:71','6:73'],['6:82','6:84','6:90','6:91']];rows.forEach((ids,index)=>{const visit=visits[index];if(visit){setText(find(design,ids[0]),new Date(visit.date).getDate());setText(find(design,ids[1]),new Date(visit.date).toLocaleDateString('en-US',{month:'short',year:'numeric'}));setText(find(design,ids[2]),visit.cafe);setText(find(design,ids[3]),visit.order);}else{setText(find(design,ids[0]),'—');setText(find(design,ids[1]),'—');setText(find(design,ids[2]),index?'—':'No visits yet');setText(find(design,ids[3]),index?'—':'Log your first cup');}});
  if(collectionTab==='Lists'){
   const box=find(design,'6:109'),newList=structuredClone(find(FIGMA_DESIGNS.lists,'1:45'));box.children=[newList];box.s.height=634;
   find(design,'6:206').s.top+=125;design.s.height+=125;
   find(design,'6:103').s.background='transparent';find(design,'6:105').s.color='#171713';find(design,'6:101').s.color='#77766f';
   find(design,'6:104').children.push({id:'list-underline',name:'Underline',type:'FRAME',s:{left:8,top:86,width:42,height:4,background:'#f04e23'},children:[]});
  }
 }
 if(route==='activity'){const activity=find(design,'4:456');activity.children=[{id:'empty-activity',type:'TEXT',name:'Empty activity',s:{left:18,top:180,width:366,height:40,color:'rgba(23,23,19,1.0)',fontFamily:'Inter',fontSize:13,fontWeight:400,lineHeight:20,textAlign:'center'},text:'Your activity will appear here.',children:[]}]}
 if(route==='lists'||route==='journal'&&collectionTab==='Lists'){const container=find(design,route==='lists'?'1:19':'6:109'),newList=find(container,'1:45'),template=structuredClone(find(FIGMA_DESIGNS.lists,'1:34'));container.children=[newList];if(saved.lists.length){saved.lists.forEach((list,i)=>{const card=structuredClone(template);card.id='custom-'+i;card.s.top=423+i*211;card.action='custom-list';const texts=all(card).filter(x=>x.type==='TEXT');setText(texts[0],`${String(i+3).padStart(2,'0')} / PERSONAL`);setText(texts[1],list.name);setText(texts[2],`${list.cafes.length} cafés`);container.children.splice(container.children.length-1,0,card);});const delta=saved.lists.length*211;newList.s.top+=delta;container.s.height+=delta;find(design,route==='lists'?'1:56':'6:206').s.top+=delta;design.s.height+=delta;}}
 document.body.dataset.route=route;app.innerHTML=`<div class="design-viewport" style="height:${design.s.height}px"><div class="design-frame" style="height:${design.s.height}px">${design.children.map(n=>nodeHTML(n)).join('')}</div></div>`;
 document.querySelectorAll('.bottom-nav button').forEach(b=>{b.classList.toggle('active',b.dataset.route===route);b.setAttribute('aria-current',b.dataset.route===route?'page':'false');});resize();bind();
}
function resize(){const scale=Math.min(innerWidth,402)/402;document.documentElement.style.setProperty('--design-scale',scale);const frame=document.querySelector('.design-frame');if(frame)document.querySelector('.design-viewport').style.height=parseFloat(frame.style.height)*scale+'px';}
function go(next){route=next;location.hash=next;render();window.scrollTo(0,0);}
function modal(title,body){const el=document.createElement('dialog');el.className='modal';el.innerHTML=`<button type="button" class="close-modal" aria-label="Close">×</button><h2>${title}</h2>${body}`;document.body.append(el);el.querySelector('.close-modal').onclick=()=>el.close();el.addEventListener('close',()=>el.remove());el.showModal();return el;}
function openAccountModal(){
 if(!account.client){modal('Your account','<p>Shared accounts are ready to connect. Add your Supabase project settings to Vercel and this screen will let each person sign in with their own private journal.</p><p class="account-note">For now, this browser keeps your journal locally.</p>');return;}
 if(account.user){const el=modal('Your account',`<p>Signed in as <strong>${esc(accountName())}</strong>.</p><p>Your journal, ratings, favorites, and lists sync securely across your devices.</p><button class="solid" id="signOut" type="button">SIGN OUT</button>`);el.querySelector('#signOut').onclick=async()=>{await account.client.auth.signOut();el.close();toast('Signed out.');};return;}
 const el=modal('Sign in','<p>Use one account to keep your journal with you on every device.</p><form id="accountForm"><label for="accountEmail">EMAIL</label><input id="accountEmail" type="email" autocomplete="email" required><label for="accountPassword">PASSWORD</label><input id="accountPassword" type="password" autocomplete="current-password" minlength="6" required><div class="account-actions"><button class="solid" type="submit" data-mode="signin">SIGN IN</button><button class="outline" type="button" data-mode="signup">CREATE ACCOUNT</button></div><p class="account-status" aria-live="polite"></p></form>');
 const form=el.querySelector('#accountForm'),status=el.querySelector('.account-status');
 async function submit(mode){const email=el.querySelector('#accountEmail').value.trim(),password=el.querySelector('#accountPassword').value;if(!email||!password)return;status.textContent='Working…';el.querySelectorAll('button').forEach(button=>button.disabled=true);const result=mode==='signup'?await account.client.auth.signUp({email,password}):await account.client.auth.signInWithPassword({email,password});el.querySelectorAll('button').forEach(button=>button.disabled=false);if(result.error){status.textContent=result.error.message;return;}if(mode==='signup'&&!result.data.session){status.textContent='Check your email to confirm your account, then sign in.';return;}el.close();toast('You are signed in.');}
 form.onsubmit=event=>{event.preventDefault();submit('signin');};el.querySelector('[data-mode="signup"]').onclick=()=>submit('signup');
}
function bind(){document.querySelectorAll('[data-action]').forEach(button=>button.onclick=async()=>{
 const action=button.dataset.action,name=button.closest('[data-cafe]')?.dataset.cafe;
 if(action==='home')go('journal');
 if(action==='collection-favorites'||action==='collection-lists'){collectionTab=action==='collection-lists'?'Lists':'Favorites';render();}
 if(action==='log'){selectedCafe=name||selectedCafe;visitRating=0;go('log');}if(action==='lists')go('lists');
 if(action==='favorites'||action==='want'){filter=action==='favorites'?'Favorites':'Want to try';pageSize=6;go('cafes');}
 if(action==='filter'){filter=button.dataset.filter;pageSize=6;render();}if(action==='more'){pageSize+=12;render();}
 if(action==='favorite'){saved.favorites[name]=saved.favorites[name]!==true;persist();render();}
 if(action==='rate'){saved.ratings[name]=Number(button.dataset.rating);persist();render();}
 if(action==='visit-rate'){visitRating=Number(button.dataset.rating);document.querySelectorAll('[data-action="visit-rate"]').forEach(b=>b.classList.toggle('chosen',Number(b.dataset.rating)<=visitRating));const value=document.querySelector('[data-node="5:724"]');if(value)value.textContent=visitRating.toFixed(1);validateVisit();}
 if(action==='save-visit'){const order=document.querySelector('#visitOrder'),cafeInput=document.querySelector('#visitCafe'),cafeName=cafeInput?.value.trim();if(!cafeName||!order.value.trim()||!visitRating){order.reportValidity();toast('Choose a café, visit rating, and enter your order.');return;}button.disabled=true;try{const existing=directory.find(c=>nameOf(c).toLowerCase()===cafeName.toLowerCase());if(!existing){const response=await fetch('/api/cafes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:cafeName})});const data=await response.json();if(!response.ok)throw Error(data.error||'Could not add this café to the directory.');if(data.cafe){directory.unshift(data.cafe);selectedCafe=nameOf(data.cafe);}}else selectedCafe=nameOf(existing);saved.visits.unshift({cafe:selectedCafe||cafeName,order:order.value.trim(),comment:document.querySelector('#visitComment').value,rating:visitRating,date:new Date().toISOString()});persist();go('journal');toast(account.user?'Visit saved to your journal.':'Visit saved to this device.');}catch(error){button.disabled=false;toast(error.message);}}
 if(action==='like'){saved.likes[button.dataset.like]=!saved.likes[button.dataset.like];persist();button.classList.toggle('liked',saved.likes[button.dataset.like]);}
 if(action==='new-list'){const el=modal('New list','<form id="newListForm"><label for="listName">LIST NAME</label><input id="listName" required placeholder="e.g. Weekend coffee stops"><button class="solid" type="submit">CREATE LIST</button></form>');el.querySelector('#newListForm').onsubmit=e=>{e.preventDefault();saved.lists.push({name:el.querySelector('#listName').value.trim(),cafes:[]});persist();el.close();render();};}
 if(action==='custom-list')modal('Your list','<p>This list is empty. New lists are saved on this device.</p>');
 if(action==='settings')openAccountModal();
 if(action==='people')modal('Your circle','<p>This screen follows the Figma sample activity. Following people will need user accounts and a shared activity service.</p>');
 if(action==='export'){const link=document.createElement('a');link.href=URL.createObjectURL(new Blob([JSON.stringify(saved,null,2)],{type:'application/json'}));link.download='cafecito-journal.json';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);}
 });const cafeInput=document.querySelector('#visitCafe');if(cafeInput)cafeInput.oninput=()=>{selectedCafe=cafeInput.value;validateVisit();};const search=document.querySelector('#search');if(search)search.oninput=()=>{const caret=search.selectionStart;query=search.value;pageSize=6;render();const next=document.querySelector('#search');next.focus();next.setSelectionRange(caret,caret);};}
function validateVisit(){const save=document.querySelector('[data-action="save-visit"]');if(save)save.disabled=!(visitRating&&document.querySelector('#visitOrder')?.value.trim()&&document.querySelector('#visitCafe')?.value.trim());}
document.addEventListener('input',validateVisit);
function toast(message){document.querySelector('.toast')?.remove();const el=document.createElement('div');el.className='toast';el.setAttribute('role','status');el.textContent=message;document.body.append(el);setTimeout(()=>el.remove(),4000);}
document.querySelectorAll('.bottom-nav button').forEach(b=>b.onclick=()=>go(b.dataset.route));window.addEventListener('hashchange',()=>{route=location.hash.slice(1)||'journal';render();});window.addEventListener('resize',resize);render();
fetch('/api/cafes').then(r=>{if(!r.ok)throw Error('Directory unavailable');return r.json();}).then(data=>{directory=data.cafes||[];if(route==='cafes')render();else if(route==='log'){const names=[...directory,...examples].map(c=>nameOf(c)).filter((name,index,list)=>name&&list.indexOf(name)===index),list=document.querySelector('#cafe-options');if(list)list.innerHTML=names.map(name=>`<option value="${esc(name)}"></option>`).join('');}}).catch(()=>console.info('Showing the Figma preview directory.'));
initAccounts();
