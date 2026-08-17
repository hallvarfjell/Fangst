import { CONFIG } from './config.js';
import { putPending, getPending, removePending, clearLocal } from './db.js';

const TYPES={note:'Notat',idea:'Idé',journal:'Dagbok',observation:'Observasjon',decision:'Beslutning',question:'Spørsmål',follow_up:'Oppfølging',reference:'Referanse'};
const typeIcons={note:'📝',idea:'💡',journal:'📖',observation:'👁',decision:'✅',question:'❓',follow_up:'🔔',reference:'🔗'};
let sb=null,user=null,entries=[],context=localStorage.getItem('fangst-context')||'private',online=navigator.onLine;
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const toast=m=>{const el=$('#toast');el.textContent=m;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2200)};
function configured(){return CONFIG.SUPABASE_URL.startsWith('https://')&&!CONFIG.SUPABASE_URL.includes('PASTE_')&&CONFIG.SUPABASE_ANON_KEY.length>30&&!CONFIG.SUPABASE_ANON_KEY.includes('PASTE_')}
function isoLocal(d=new Date()){const z=new Date(d.getTime()-d.getTimezoneOffset()*60000);return z.toISOString().slice(0,16)}
function fmtDate(v){return new Intl.DateTimeFormat('no-NO',{dateStyle:'medium',timeStyle:'short'}).format(new Date(v))}
function setHidden(sel,hidden){$(sel).classList.toggle('hidden',hidden)}

async function init(){
  if(!configured()){setHidden('#setup-screen',false);return}
  sb=window.supabase.createClient(CONFIG.SUPABASE_URL,CONFIG.SUPABASE_ANON_KEY);
  const {data}=await sb.auth.getSession(); user=data.session?.user||null;
  sb.auth.onAuthStateChange((_e,s)=>{user=s?.user||null;routeAuth()});
  bind(); routeAuth(); registerSW();
}
function bind(){
  $('#auth-form').addEventListener('submit',signIn); $('#signup-btn').onclick=signUp; $('#logout-btn').onclick=()=>sb.auth.signOut();
  $('#quick-new').onclick=$('#nav-new').onclick=()=>openEditor();
  $('#context-toggle').onclick=()=>{context=context==='private'?'work':'private';localStorage.setItem('fangst-context',context);renderContext();renderHome()};
  $$('.bottom-nav [data-view]').forEach(b=>b.onclick=()=>showView(b.dataset.view));
  $$('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
  $('#entry-form').addEventListener('submit',saveEntry); $('#delete-entry').onclick=deleteEntry;
  $('#search-input').oninput=renderSearch; $('#search-context').onchange=renderSearch; $('#search-type').onchange=renderSearch;
  $('#journal-from').onchange=$('#journal-to').onchange=renderJournal; $('#print-journal').onclick=()=>window.print();
  $('#refresh-btn').onclick=loadEntries; $('#manage-tags-btn').onclick=openTags;
  $('#export-json').onclick=exportJSON; $('#export-csv').onclick=exportCSV;
  $('#clear-cache').onclick=async()=>{await clearLocal();localStorage.removeItem('fangst-cache');toast('Lokal hurtigbuffer er tømt')};
  window.addEventListener('online',()=>{online=true;syncPending()}); window.addEventListener('offline',()=>{online=false;renderSync()});
  Object.entries(TYPES).forEach(([v,l])=>{$('#search-type').insertAdjacentHTML('beforeend',`<option value="${v}">${l}</option>`)});
  $('#type-chips').innerHTML=Object.entries(TYPES).map(([v,l])=>`<button type="button" data-type="${v}">${typeIcons[v]} ${l}</button>`).join('');
  $$('#type-chips button').forEach(b=>b.onclick=()=>{$$('#type-chips button').forEach(x=>x.classList.remove('selected'));b.classList.add('selected')});
}
function routeAuth(){
  setHidden('#auth-screen',!!user);setHidden('#app',!user);if(user){renderContext();loadEntries();$('#app-info').textContent=`Fangst v${CONFIG.APP_VERSION} · ${user.email}`}
}
async function signIn(e){e.preventDefault();const {error}=await sb.auth.signInWithPassword({email:$('#auth-email').value,password:$('#auth-password').value});$('#auth-message').textContent=error?error.message:''}
async function signUp(){const {data,error}=await sb.auth.signUp({email:$('#auth-email').value,password:$('#auth-password').value});$('#auth-message').textContent=error?error.message:(data.session?'Bruker opprettet.':'Sjekk e-posten din for bekreftelse.')}
function renderContext(){const b=$('#context-toggle');b.textContent=context==='private'?'Privat':'Jobb';b.className=`context ${context}`}
async function loadEntries(){
  renderSync('Synkroniserer …'); const cached=localStorage.getItem('fangst-cache');if(cached){try{entries=JSON.parse(cached);renderAll()}catch{}}
  const {data,error}=await sb.from('entries_with_tags').select('*').order('event_date',{ascending:false}).limit(1000);
  if(error){toast('Kunne ikke hente fra Supabase');renderSync('Frakoblet');return}
  entries=data||[];localStorage.setItem('fangst-cache',JSON.stringify(entries));renderAll();await syncPending();renderSync();
}
function renderAll(){renderHome();renderSearch();renderCollections();renderJournal()}
function entryCard(e){const tags=(e.tags||[]).map(t=>`<span>${esc(t)}</span>`).join('');return `<button class="entry-card" data-id="${e.id}"><div class="entry-icon">${typeIcons[e.entry_type]||'📝'}</div><div><strong>${esc(e.title||String(e.body).slice(0,70))}</strong><p>${esc(e.body)}</p><small>${fmtDate(e.event_date)} · ${e.context==='work'?'Jobb':'Privat'}</small><div class="mini-tags">${tags}</div></div></button>`}
function wireCards(root=document){root.querySelectorAll('.entry-card').forEach(c=>c.onclick=()=>openEditor(entries.find(e=>e.id===c.dataset.id)))}
function renderList(el,list){el.innerHTML=list.length?list.map(entryCard).join(''):$('#empty-template').innerHTML;wireCards(el)}
function renderHome(){renderList($('#recent-list'),entries.filter(e=>e.context===context).slice(0,20))}
function renderSearch(){const q=$('#search-input').value.trim().toLowerCase(),ct=$('#search-context').value,tp=$('#search-type').value;const list=entries.filter(e=>(!ct||e.context===ct)&&(!tp||e.entry_type===tp)&&(!q||[e.title,e.body,e.long_text,...(e.tags||[])].join(' ').toLowerCase().includes(q)));renderList($('#search-results'),list)}
function renderCollections(){const m=new Map();entries.forEach(e=>(e.tags||[]).forEach(t=>m.set(t,(m.get(t)||0)+1)));const sorted=[...m.entries()].sort((a,b)=>b[1]-a[1]);$('#collection-list').innerHTML=sorted.length?sorted.map(([t,n])=>`<button class="collection" data-tag="${esc(t)}"><strong>${esc(t)}</strong><span>${n} oppføringer</span></button>`).join(''):$('#empty-template').innerHTML;$$('#collection-list .collection').forEach(b=>b.onclick=()=>{showView('search');$('#search-input').value=b.dataset.tag;renderSearch()})}
function renderJournal(){const from=$('#journal-from').value,to=$('#journal-to').value;const list=entries.filter(e=>e.entry_type==='journal'&&(!from||e.event_date.slice(0,10)>=from)&&(!to||e.event_date.slice(0,10)<=to));let last='';$('#journal-list').innerHTML=list.length?list.map(e=>{const day=new Intl.DateTimeFormat('no-NO',{dateStyle:'full'}).format(new Date(e.event_date));const h=day!==last?`<h3>${esc(day)}</h3>`:'';last=day;return h+entryCard(e)}).join(''):$('#empty-template').innerHTML;wireCards($('#journal-list'))}
function showView(v){$$('.view').forEach(x=>x.classList.toggle('active',x.id===`view-${v}`));$$('.bottom-nav button').forEach(x=>x.classList.toggle('active',x.dataset.view===v));if(v==='search')setTimeout(()=>$('#search-input').focus(),50)}
function openEditor(e=null){
  $('#entry-form').reset();$('#entry-id').value=e?.id||'';$('#entry-title').value=e?.title||'';$('#entry-body').value=e?.body||'';$('#entry-date').value=isoLocal(e?new Date(e.event_date):new Date());$('#entry-status').value=e?.status||'new';$('#entry-tags').value=(e?.tags||[]).join(', ');$('#entry-url').value=e?.external_url||'';$('#entry-long').value=e?.long_text||'';$$('#type-chips button').forEach(b=>b.classList.toggle('selected',b.dataset.type===(e?.entry_type||'note')));$('#delete-entry').classList.toggle('hidden',!e);$('#entry-dialog-title').textContent=e?'Rediger oppføring':'Ny oppføring';$('#entry-dialog').showModal();setTimeout(()=>$('#entry-body').focus(),50)
}
function payload(){return {title:$('#entry-title').value.trim()||null,body:$('#entry-body').value.trim(),context,entry_type:$('#type-chips .selected')?.dataset.type||'note',status:$('#entry-status').value,event_date:new Date($('#entry-date').value).toISOString(),long_text:$('#entry-long').value.trim()||null,external_url:$('#entry-url').value.trim()||null,tags:$('#entry-tags').value.split(',').map(s=>s.trim()).filter(Boolean)}}
async function saveEntry(e){e.preventDefault();const p=payload(),id=$('#entry-id').value;$('#entry-dialog').close();if(!online){await queueSave(id,p);return}const {error}=id?await sb.rpc('update_entry_with_tags',{p_entry_id:id,p_data:p}):await sb.rpc('create_entry_with_tags',{p_data:p});if(error){await queueSave(id,p);toast('Lagret lokalt. Synkroniseres senere.')}else{toast('Oppføringen er lagret');await loadEntries()}}
async function queueSave(id,p){const local_id=crypto.randomUUID();await putPending({local_id,action:id?'update':'create',entry_id:id||null,payload:p,queued_at:new Date().toISOString()});entries.unshift({id:id||local_id,...p,pending:true});localStorage.setItem('fangst-cache',JSON.stringify(entries));renderAll();renderSync();toast('Lagret lokalt')}
async function syncPending(){if(!online||!user)return;const items=await getPending();for(const x of items){const call=x.action==='update'?sb.rpc('update_entry_with_tags',{p_entry_id:x.entry_id,p_data:x.payload}):sb.rpc('create_entry_with_tags',{p_data:x.payload});const {error}=await call;if(!error)await removePending(x.local_id)}renderSync();if(items.length)await loadEntriesNoSync()}
async function loadEntriesNoSync(){const {data}=await sb.from('entries_with_tags').select('*').order('event_date',{ascending:false}).limit(1000);if(data){entries=data;localStorage.setItem('fangst-cache',JSON.stringify(entries));renderAll()}}
async function deleteEntry(){const id=$('#entry-id').value;if(!id||!confirm('Slette denne oppføringen permanent?'))return;const {error}=await sb.from('entries').delete().eq('id',id);if(error)toast(error.message);else{$('#entry-dialog').close();toast('Oppføringen er slettet');loadEntries()}}
async function renderSync(custom){const n=(await getPending().catch(()=>[])).length;$('#sync-status').textContent=custom||(online?(n?`${n} venter på synkronisering`:'✓ Synkronisert'):'Frakoblet')}
function openTags(){const tags=[...new Set(entries.flatMap(e=>e.tags||[]))].sort();$('#all-tags').innerHTML=tags.map(t=>`<button type="button">${esc(t)}</button>`).join('');$('#tags-dialog').showModal()}
function download(name,type,text){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click();URL.revokeObjectURL(a.href)}
function exportJSON(){download(`fangst-${new Date().toISOString().slice(0,10)}.json`,'application/json',JSON.stringify({format:'fangst-backup',version:1,exported_at:new Date().toISOString(),entries},null,2))}
function exportCSV(){const cols=['id','title','body','context','entry_type','status','event_date','tags','external_url'];const q=v=>`"${String(v??'').replaceAll('"','""')}"`;download(`fangst-${new Date().toISOString().slice(0,10)}.csv`,'text/csv;charset=utf-8','\ufeff'+[cols.join(';'),...entries.map(e=>cols.map(c=>q(c==='tags'?(e.tags||[]).join(', '):e[c])).join(';'))].join('\n'))}
function registerSW(){if('serviceWorker'in navigator)navigator.serviceWorker.register('./service-worker.js').catch(console.warn)}
init();
