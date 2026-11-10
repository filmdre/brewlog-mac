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
function uniqueCafes(cafes){const seen=new Set();return cafes.filter(cafe=>{const key=nameOf(cafe).normalize('NFKC').replace(/[‘’]/g,"'").replace(/\s+/g,' ').trim().toLocaleLowerCase('en-US');if(!key||seen.has(key))return false;seen.add(key);return true;});}
function css(style){return Object.entries(style).filter(([k])=>!k.startsWith('border')||k==='borderRadius').map(([k,v])=>`${k.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())}:${typeof v==='number'&&!['fontWeight','opacity','zIndex'].includes(k)?v+'px':v}`).join(';');}
function nodeHTML(n,context={}){
 if(n.type==='FAVORITE')return `<button type="button" class="layer cafe-favorite ${n.favorite?'is-favorite':''}" data-action="favorite" aria-label="${esc(`${n.favorite?'Remove':'Add'} ${n.cafeName} ${n.favorite?'from':'to'} favorites`)}" aria-pressed="${n.favorite}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 5.8a5.2 5.2 0 0 0-7.4 0L12 7.2l-1.4-1.4a5.2 5.2 0 1 0-7.4 7.4L12 22l8.8-8.8a5.2 5.2 0 0 0 0-7.4Z"/></svg></button>`;
 if(n.type==='EMPTY')return `<article class="layer empty-coffee-card" style="${css(n.s)}"><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M10 19h25v12a10 10 0 0 1-10 10h-5a10 10 0 0 1-10-10V19Zm25 2h3a6 6 0 0 1 0 12h-4M7 44h31M17 13V7m8 6V4m8 9V7"/></svg><h3>${esc(n.text)}</h3><p>${esc(n.description||'')}</p></article>`;
 if(n.name==='Journal collections')return `<div class="layer journal-collections" style="${css({...n.s,width:300})}"><div class="journal-tabs" role="tablist" aria-label="Journal collections">${['Favorites','Lists'].map(label=>`<button type="button" role="tab" aria-selected="${collectionTab===label}" class="${collectionTab===label?'selected':''}" data-action="collection-${label.toLowerCase()}">${label}</button>`).join('')}</div><a class="journal-database" href="https://app.notion.com/p/411690f50c8380aba583c2d6edb14a41?v=dded7b7a83b84349b14e73ea50e2b82f" target="_blank" rel="noopener noreferrer" title="Open the café database in Notion">Database</a></div>`;
 let ctx={...context},tag='div',attrs='',style={...n.s},content='';
 if(n.name==='CafeCard'){ctx.cafe=n.cafeName||'';attrs+=` data-cafe="${esc(ctx.cafe)}"`;}
 const text=words(n).trim();
 if(n.name.startsWith('Button')&&!n.name.includes(':margin')){
  tag='button';attrs+=' type="button"';let action=n.action;
  if(n.id==='41:753')action='collection-favorites';if(n.id==='41:757')action='collection-lists';
  if(text==='CAFECITO'||text==='DOPPIO')action='home';
  if(!action&&n.name.includes('stars')){action=route==='log'?'visit-rate':'rate';attrs+=` data-rating="${n.name.match(/(\d) stars/)[1]}"`;}
  if(!action&&/favorit/i.test(n.name))action='favorite';
  if(!action&&text==='Log visit')action='log';if(!action&&text==='Favorites')action='favorites';if(!action&&text==='Lists')action='lists';
  if(!action&&text==='Like'){action='like';attrs+=` data-like="${n.id}"`;}
  if(!action&&text==='Save to diary')action='save-visit';if(!action&&text==='Find people')action='people';
  if(!action&&n.children.some(c=>c.name==='PlusIcon')&&!text)action='log';if(!action&&n.children.some(c=>c.name==='ArrowIcon')&&!text)action='lists';
  if(n.id==='1:20')action='favorites';if(n.id==='1:34')action='want';if(n.id==='1:45')action='new-list';
  if(['11:1152','11:1155','11:1157','11:1159'].includes(n.id)){action='filter';attrs+=` data-filter="${text}"`;style.background=filter===text?'#171713':'transparent';style.color=filter===text?'white':'#77766f';}
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
function cafeState(c){const key=nameOf(c);return {...c,name:key,status:saved.visits.some(v=>v.cafe===key)?'Logged':'Up next',favorite:saved.favorites[key]===true,rating:saved.ratings[key]??0};}
function emptyCard(title,description,top=1){return {id:'empty-'+title,name:'Empty coffee card',type:'EMPTY',s:{left:1,top,width:364,height:185.09375},text:title,description,children:[]};}
function makeCard(template,c,index){
 const card=structuredClone(template);card.cafeName=c.name;card.s.top=1+index*186.09375;const nodes=all(card),texts=nodes.filter(n=>n.type==='TEXT');
 card.children[0].children[0].s.background=c.status==='Logged'?'#171713':'#f04e23';
 setText(texts[0],c.status||'Up next');setText(texts[1],c.name);texts[1].s.width=330;texts[1].s.fontSize=Math.min(23,550/Math.max(c.name.length,1));setText(texts[2],/^https?:/.test(c.source||'')?'From the café directory':c.source||'From the café directory');texts[2].s.width=330;
 for(const n of nodes.filter(n=>n.name.startsWith('Button - ')&&!n.name.includes(':margin'))){if(n.name.includes('stars')){const score=Number(n.name.match(/(\d) stars/)[1]);for(const p of all(n).flatMap(n=>n.paths||[]))p.fill=score<=c.rating?'#f04e23':'#b6b4a9';}else if(/favorit/i.test(n.name)){n.action='favorite';n.name=`Button - ${c.favorite?'Remove':'Add'} ${c.name} ${c.favorite?'from':'to'} favorites`;n.s.background=c.favorite?'#f04e23':'transparent';}}
 const removeImportedHearts=n=>{n.children=(n.children||[]).filter(child=>!(child.name.startsWith('Button')&&/favorit/i.test(child.name))&&child.name!=='HeartIcon');n.children.forEach(removeImportedHearts);};removeImportedHearts(card);
 card.children.push({id:`favorite-${index}`,name:'Favorite control',type:'FAVORITE',favorite:c.favorite,cafeName:c.name,s:{},children:[]});
 return card;
}
function render(){
 if(!['journal','cafes','log','activity','lists'].includes(route))route='journal';
 const design=structuredClone(FIGMA_DESIGNS[route]||FIGMA_DESIGNS.journal);design.children.splice(1,1);
 for(const n of all(design).filter(n=>n.type==='TEXT'&&['DOPPIO','DOPPIO®'].includes(n.text)))setText(n,'CAFECITO');
 const sourceCafes=directory, favoriteNames=Object.keys(saved.favorites).filter(key=>saved.favorites[key]===true);
 if(route==='cafes'){
  const box=find(design,'11:1161'),template=box.children[0],matches=sourceCafes.map(cafeState).filter(c=>(filter==='All'||filter==='Favorites'&&c.favorite||filter==='Logged'&&c.status==='Logged'||filter==='Want to try'&&c.status!=='Logged')&&[c.name,...(c.tags||[]).filter(t=>!(c.cities||[]).includes(t))].join(' ').toLowerCase().includes(query.toLowerCase()));
  const shown=matches.slice(0,pageSize),height=Math.max(shown.length,1)*186.09375+1,more=matches.length>pageSize?60:0,delta=height+more-1117.5625;
  box.children=shown.length?shown.map((c,i)=>makeCard(template,c,i)):[emptyCard(query?'No matching cafés':filter==='Favorites'?'No favorites yet':filter==='Logged'?'No visits yet':'No cafés yet',query?'Try another café name.':'Your saved cafés will appear here.')];box.s.height=height+more;box.s.background='transparent';
  find(design,'11:1400').s.height+=delta;find(design,'11:1127').s.height+=delta;find(design,'11:1401').s.top+=delta;design.s.height+=delta;
  if(more)box.children.push({id:'more',type:'FRAME',name:'Button',action:'more',s:{left:0,top:height+10,width:366,height:40},children:[{id:'more-text',type:'TEXT',name:'More',s:{left:0,top:0,width:366,height:40,fontSize:11,lineHeight:40,textAlign:'center'},text:`Show more (${matches.length-shown.length})`,children:[]}]});
 }
 if(route==='journal'){
  const visits=saved.visits,average=visits.length?visits.reduce((sum,v)=>sum+Number(v.rating||0),0)/visits.length:0;
  setText(find(design,'41:680'),String(visits.length).padStart(2,'0'));setText(find(design,'41:687'),average?average.toFixed(1):'—');setText(find(design,'41:692'),favoriteNames.length);
  const diary=find(design,'41:707'),template=diary.children[0];
  diary.children=visits.length?visits.map((visit,i)=>{const row=structuredClone(template);row.s.top=i*115;const texts=all(row).filter(n=>n.type==='TEXT'),date=new Date(visit.date);[String(i+1).padStart(2,'0'),date.getDate(),date.toLocaleDateString('en-US',{month:'short',year:'numeric'}),'Visit log',visit.cafe,visit.order].forEach((value,j)=>setText(texts[j],value));texts[4].s.width=248;return row;}):[emptyCard('No visits yet','Log your first cup to start your diary.',0)];
  const diaryHeight=visits.length?visits.length*115:185.09375,diaryDelta=diaryHeight-230;diary.s.height=diaryHeight;find(design,'41:695').s.height+=diaryDelta;find(design,'41:747').s.top+=diaryDelta;find(design,'41:845').s.top+=diaryDelta;design.s.height+=diaryDelta;
  const box=find(design,'41:762');box.s.background='transparent';
  if(collectionTab==='Favorites'){
   const template=box.children[0],favorites=favoriteNames.map(name=>sourceCafes.find(c=>nameOf(c)===name)||{name});box.children=favorites.length?favorites.slice(0,3).map((c,i)=>makeCard(template,cafeState(c),i)):[emptyCard('No favorites yet','Tap a heart on a café to save it here.')];box.s.height=Math.max(Math.min(favorites.length,3),1)*186.09375+1;
  }else{populateLists(box);find(design,'41:759').action='new-list';}
  if(collectionTab==='Favorites')find(design,'41:759').action='favorites';
  const delta=box.s.height-373.18798828125;find(design,'41:844').s.height=box.s.height+20;find(design,'41:747').s.height+=delta;find(design,'41:845').s.top+=delta;design.s.height+=delta;
 }
 if(route==='lists'){const box=find(design,'1:19');populateLists(box);const delta=box.s.height-634;find(design,'1:56').s.top+=delta;design.s.height+=delta;}
 if(route==='log'){setText(find(design,'5:691'),`ENTRY / ${String(saved.visits.length+1).padStart(3,'0')}`);setText(find(design,'5:744'),new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}));}
 if(route==='activity'){const feed=find(design,'4:456');feed.children=[emptyCard('No activity yet','Your coffee circle’s activity will appear here.',30)];feed.s.height=245;const layout=find(design,'4:455');layout.children=[feed];layout.s.height=275;const footer=all(design).find(n=>n.name==='Footer');footer.s.top=66+267+275;design.s.height=footer.s.top+208;}
 document.body.dataset.route=route;app.innerHTML=`<div class="design-viewport" style="height:${design.s.height}px"><div class="design-frame" style="height:${design.s.height}px">${design.children.map(n=>nodeHTML(n)).join('')}</div></div>`;
 document.querySelectorAll('.bottom-nav button').forEach(b=>{const active=b.dataset.route===route||route==='lists'&&b.dataset.route==='journal';b.classList.toggle('active',active);b.setAttribute('aria-current',active?'page':'false');});resize();bind();
}
function populateLists(box){
 const template=find(FIGMA_DESIGNS.lists,'1:34');box.s.background='transparent';box.children=saved.lists.map((list,i)=>{const card=structuredClone(template);card.id='custom-'+i;card.s.top=1+i*211;card.action='custom-list';const texts=all(card).filter(n=>n.type==='TEXT');setText(texts[0],`${String(i+1).padStart(2,'0')} / PERSONAL`);setText(texts[1],list.name);setText(texts[2],`${list.cafes.length} cafés`);return card;});
 if(!saved.lists.length)box.children.push(emptyCard('No lists yet','Create a list to collect your coffee stops.'));
 const create=structuredClone(find(FIGMA_DESIGNS.lists,'1:45'));create.s.top=saved.lists.length?1+saved.lists.length*211:187.09375;box.children.push(create);box.s.height=create.s.top+211;
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
 if(action==='rate')setCafeRating(name,Number(button.dataset.rating));
 if(action==='visit-rate'){visitRating=Number(button.dataset.rating);document.querySelectorAll('[data-action="visit-rate"]').forEach(b=>b.classList.toggle('chosen',Number(b.dataset.rating)<=visitRating));const value=document.querySelector('[data-node="5:724"]');if(value)value.textContent=visitRating.toFixed(1);validateVisit();}
 if(action==='save-visit'){const order=document.querySelector('#visitOrder'),cafeInput=document.querySelector('#visitCafe'),cafeName=cafeInput?.value.trim();if(!cafeName||!order.value.trim()||!visitRating){order.reportValidity();toast('Choose a café, visit rating, and enter your order.');return;}button.disabled=true;try{const existing=directory.find(c=>nameOf(c).toLowerCase()===cafeName.toLowerCase());if(!existing){const response=await fetch('/api/cafes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:cafeName})});const data=await response.json();if(!response.ok)throw Error(data.error||'Could not add this café to the directory.');if(data.cafe){directory.unshift(data.cafe);selectedCafe=nameOf(data.cafe);}}else selectedCafe=nameOf(existing);saved.visits.unshift({cafe:selectedCafe||cafeName,order:order.value.trim(),comment:document.querySelector('#visitComment').value,rating:visitRating,date:new Date().toISOString()});persist();go('journal');toast(account.user?'Visit saved to your journal.':'Visit saved to this device.');}catch(error){button.disabled=false;toast(error.message);}}
 if(action==='like'){saved.likes[button.dataset.like]=!saved.likes[button.dataset.like];persist();button.classList.toggle('liked',saved.likes[button.dataset.like]);}
 if(action==='new-list'){const el=modal('New list','<form id="newListForm"><label for="listName">LIST NAME</label><input id="listName" required placeholder="e.g. Weekend coffee stops"><button class="solid" type="submit">CREATE LIST</button></form>');el.querySelector('#newListForm').onsubmit=e=>{e.preventDefault();saved.lists.push({name:el.querySelector('#listName').value.trim(),cafes:[]});persist();el.close();render();};}
 if(action==='custom-list')modal('Your list',nodeHTML({...emptyCard('No cafés yet','Your saved cafés will appear here.'),s:{position:'relative',left:0,top:0,width:'100%',height:185}}));
 if(action==='settings')openAccountModal();
 if(action==='people')modal('Your circle','<p>This screen follows the Figma sample activity. Following people will need user accounts and a shared activity service.</p>');
 if(action==='export'){const link=document.createElement('a');link.href=URL.createObjectURL(new Blob([JSON.stringify(saved,null,2)],{type:'application/json'}));link.download='cafecito-journal.json';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);}
 });const cafeInput=document.querySelector('#visitCafe');if(cafeInput)cafeInput.oninput=()=>{selectedCafe=cafeInput.value;validateVisit();};const search=document.querySelector('#search');if(search)search.oninput=()=>{const caret=search.selectionStart;query=search.value;pageSize=6;render();const next=document.querySelector('#search');next.focus();next.setSelectionRange(caret,caret);};}
function validateVisit(){const save=document.querySelector('[data-action="save-visit"]');if(save)save.disabled=!(visitRating&&document.querySelector('#visitOrder')?.value.trim()&&document.querySelector('#visitCafe')?.value.trim());}
function setCafeRating(name,value){if(value)saved.ratings[name]=value;else delete saved.ratings[name];persist();document.querySelectorAll('[data-cafe]').forEach(card=>{if(card.dataset.cafe!==name)return;card.querySelectorAll('[data-action="rate"]').forEach(star=>{const filled=Number(star.dataset.rating)<=value;star.setAttribute('aria-pressed',String(filled));star.querySelectorAll('svg path').forEach(path=>path.setAttribute('fill',filled?'#f04e23':'#b6b4a9'));});});}
document.addEventListener('dblclick',event=>{const star=event.target.closest('[data-action="rate"]');if(!star)return;const name=star.closest('[data-cafe]')?.dataset.cafe;if(name){event.preventDefault();setCafeRating(name,0);toast('Café rating removed.');}});
document.addEventListener('input',validateVisit);
function toast(message){document.querySelector('.toast')?.remove();const el=document.createElement('div');el.className='toast';el.setAttribute('role','status');el.textContent=message;document.body.append(el);setTimeout(()=>el.remove(),4000);}
document.querySelectorAll('.bottom-nav button').forEach(b=>b.onclick=()=>go(b.dataset.route));window.addEventListener('hashchange',()=>{route=location.hash.slice(1)||'journal';render();});window.addEventListener('resize',resize);render();
fetch('/api/cafes').then(r=>{if(!r.ok)throw Error('Directory unavailable');return r.json();}).then(data=>{directory=uniqueCafes(data.cafes||[]);if(route==='cafes')render();else if(route==='log'){const names=[...directory,...examples].map(c=>nameOf(c)).filter((name,index,list)=>name&&list.indexOf(name)===index),list=document.querySelector('#cafe-options');if(list)list.innerHTML=names.map(name=>`<option value="${esc(name)}"></option>`).join('');}}).catch(()=>console.info('Showing the Figma preview directory.'));
initAccounts();
