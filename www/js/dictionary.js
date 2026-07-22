/* ============================================================
   dictionary.js — словарь. Фильтры: статус/библиотека/урок.
   Русский ярче английского. Свайп →знаю/←снять. Избранное (★).
   ============================================================ */
const Dict = (() => {
  const D = window.GENKI_DATA;
  let statusFilter='all', libFilter='all', lessonFilter=0;
  let renderTimer=0, currentResults=[], currentQuery='', shown=0;
  const PAGE=80;
  const $ = id=>document.getElementById(id);
  const norm = s=>(s||'').toLowerCase().trim();
  const uid = v=>v.uid||('w'+v.id);
  const jpKey = v=>(v.j||v.k||'').trim()+'|'+(v.k||'').trim();
  const groupId = key=>'wg:'+key;
  const groupItems = v=>v&&v._items?v._items:[v];
  const itemIds = v=>groupItems(v).map(uid);
  const primaryItem = v=>groupItems(v).find(x=>Store.isCram(uid(x))) || groupItems(v)[0];
  const primaryId = v=>{ const x=primaryItem(v); return x?uid(x):uid(v); };
  const unique = arr=>[...new Set(arr.filter(Boolean))];
  function statusOf(v){ const s=Store.status(uid(v)); return (s==='learning'||s==='review')?'learning':s; }
  function groupStatus(g){
    const own=Store.status(uid(g));
    if(own==='known') return 'known';
    const sts=groupItems(g).map(statusOf);
    if(sts.includes('known')) return 'known';
    if(sts.includes('learning')) return 'learning';
    return 'new';
  }
  function groupFav(g){ return groupItems(g).some(v=>Store.favHas(uid(v))); }
  function groupCram(g){ return groupItems(g).some(v=>Store.isCram(uid(v))); }
  function groupArchived(g){ const xs=groupItems(g); return xs.length&&xs.every(v=>Store.isArchived(uid(v))); }
  function base(){ return D.words.filter(v=>Store.srcOn('mat',v.lib)); }
  function grouped(list){
    const map=new Map();
    for(const v of list){
      const key=jpKey(v);
      if(!map.has(key)) map.set(key,{...v,uid:groupId(key),_items:[],_key:key});
      map.get(key)._items.push(v);
    }
    return [...map.values()].map(g=>{
      const first=g._items[0];
      g.j=first.j; g.k=first.k; g.r=unique(g._items.map(x=>x.r)).join('; ');
      g.e=unique(g._items.map(x=>x.e)).join('; ');
      g.pa=first.pa||first.pitch||''; g.a=first.a||first.audio||'';
      return g;
    });
  }
  function search(q){
    q=norm(q); let list=base();
    if(libFilter!=='all') list=list.filter(v=>v.lib===libFilter);
    if(lessonFilter) list=list.filter(v=>v.l===lessonFilter);
    list=grouped(list);
    if(statusFilter==='fav') list=list.filter(groupFav);
    else if(statusFilter!=='all') list=list.filter(v=>groupStatus(v)===statusFilter);
    if(!q) return list;
    const out=[];
    for(const v of list){
      const hay=groupItems(v).map(x=>[x.j,x.k,x.e,x.r,LU.libName(x.lib),LU.lessonLabel(x.lib,x.l)].join(' ')).join(' ');
      if(norm(hay).includes(q)) out.push(v);
    }
    out.sort((a,b)=>{ const am=a.k.startsWith(q)||a.j.startsWith(q)||norm(a.r).startsWith(q)?0:1; const bm=b.k.startsWith(q)||b.j.startsWith(q)||norm(b.r).startsWith(q)?0:1; return am-bm; });
    return out;
  }
  let _rev=-1;
  function scheduleRender(q){
    clearTimeout(renderTimer);
    renderTimer=setTimeout(()=>render(q),80);
  }
  function jpBlock(v, sheet){
    const word=v.j||v.k, kana=v.k||word, speak=kana||word;
    const showFuri=sheet || Store.settings().dictFuri!==false;
    const pitch=showFuri ? Pitch.render(kana, word, v.pa||v.pitch) : '';
    const btn=WordAudio.button(speak, 'Прослушать', v.a||v.audio);
    if(sheet) return `<div class="dict-sheet-head"><div class="big-kanji" style="font-size:46px">${LU.esc(word)}</div>${btn}</div>
      <div class="sub">${pitch}</div>`;
    if(word===kana) return `<div class="jp dict-jp"><div class="dict-jp-stack"><div class="dict-jp-main">${showFuri?pitch:LU.esc(word)}</div></div><div class="dict-audio-side">${btn}</div></div>`;
    return `<div class="jp dict-jp"><div class="dict-jp-stack"><div class="dict-jp-main">${LU.esc(word)}</div>${pitch?`<span class="kana">${pitch}</span>`:''}</div><div class="dict-audio-side">${btn}</div></div>`;
  }
  function entryHtml(v){
    const id=uid(v); const known=groupStatus(v)==='known'; const fav=groupFav(v); const cram=groupCram(v); const arch=groupArchived(v);
    const meanings=groupItems(v).map(x=>`<div class="dict-meaning"><b>${LU.esc(LU.libName(x.lib))}</b><span>${LU.ml(x.r)}</span>${x.e?`<small>${LU.ml(x.e)}</small>`:''}</div>`).join('');
    return `<div class="entry card${known?' known-entry':''}${cram?' cram-entry':''}${arch?' archived-entry':''}" data-uid="${id}">
      ${jpBlock(v)}
      <div class="mean">${meanings}</div>
      <div class="lz"><span class="fav${fav?' on':''}" data-fav="${id}">${fav?'★':'☆'}</span></div>
    </div>`;
  }
  function updateMeta(){
    $('dictMeta').textContent=`Показано: ${shown} из ${currentResults.length} · 出典 Genki / материалы`;
  }
  function appendPage(){
    const box=$('dictResults');
    if(shown>=currentResults.length) return;
    const next=currentResults.slice(shown, shown+PAGE);
    shown+=next.length;
    box.insertAdjacentHTML('beforeend', next.map(entryHtml).join(''));
    updateMeta();
    if(shown<currentResults.length) box.insertAdjacentHTML('beforeend','<div class="dict-more" id="dictMore">Загружаю дальше…</div>');
  }
  function removeMore(){ const m=$('dictMore'); if(m) m.remove(); }
  function maybeLoadMore(){
    if(!$('view-dict')||!$('view-dict').classList.contains('active')) return;
    if(shown>=currentResults.length) return;
    const nearBottom=window.innerHeight+window.scrollY>=document.documentElement.scrollHeight-500;
    if(nearBottom){ removeMore(); appendPage(); }
  }
  function maybeRender(){ if(_rev!==Store.rev()) render(); }
  function render(q){
    _rev=Store.rev();
    if(q==null) q=$('dictInput').value;
    currentQuery=q;
    currentResults=search(q);
    shown=0;
    const box=$('dictResults');
    if(!currentResults.length){ $('dictMeta').textContent='Найдено: 0 · 出典 Genki / материалы'; box.innerHTML=`<div class="empty"><div class="big">🔍</div>Ничего не найдено</div>`; return; }
    box.innerHTML='';
    appendPage();
    maybeLoadMore();
  }
  function chips(wrap,arr,cur,attr,cb){ wrap.innerHTML=arr.map(([v,l])=>`<span class="pill${String(v)===String(cur)?' on':''}" data-${attr}="${v}">${l}</span>`).join(''); wrap.onclick=e=>{ const p=e.target.closest(`[data-${attr}]`); if(!p)return; cb(p.dataset[attr]); }; }
  function buildStatus(){ chips($('dStatus'),[['all','Все'],['new','Новые'],['learning','Учу'],['known','Знаю'],['fav','★']],statusFilter,'st',v=>{ statusFilter=v; buildStatus(); render(); }); }
  function buildLibs(){ const arr=[['all','Все']].concat(LU.activeLibs('mat').map(l=>[l.id,l.name])); chips($('dLibs'),arr,libFilter,'lib',v=>{ libFilter=v; lessonFilter=0; buildLibs(); buildLessons(); render(); }); }
  function buildLessons(){ const wrap=$('dFilters'); if(libFilter==='all'){ wrap.innerHTML=''; return; }
    const ls=[...new Set(base().filter(v=>v.lib===libFilter).map(v=>v.l))].sort((a,b)=>a-b);
    const arr=[[0,'Все уроки']].concat(ls.map(l=>[l,LU.lessonLabel(libFilter,l)]));
    chips(wrap,arr,lessonFilter,'less',v=>{ lessonFilter=+v; buildLessons(); render(); }); }
  function init(){
    buildStatus(); buildLibs(); buildLessons();
    $('dictInput').addEventListener('input',e=>{ scheduleRender(e.target.value); });
    window.addEventListener('scroll',maybeLoadMore,{passive:true});
    const box=$('dictResults');
    box.addEventListener('click',e=>{ const f=e.target.closest('[data-fav]'); if(!f) return;
      const g=wordByUid(f.dataset.fav); const ids=itemIds(g); const on=!ids.some(id=>Store.favHas(id)); ids.forEach(id=>{ if(Store.favHas(id)!==on) Store.favToggle(id); });
      if(statusFilter==='fav'){ render(); } else { f.classList.toggle('on',on); f.textContent=on?'★':'☆'; } });
    // Точечное обновление вместо ререндера всего списка (плавность при отметке).
    LU.attachSwipe(box, null, (uid,action)=>{
      const g=wordByUid(uid); itemIds(g).forEach(id=>Store.set(id, action==='known'?{...(Store.get(id)||SRS.fresh()),s:'known',due:0}:SRS.fresh()));
      if(statusFilter==='all'||statusFilter==='fav'){
        const node=box.querySelector('[data-uid="'+uid+'"]');
        if(node){ node.style.transform=''; node.style.opacity=''; node.classList.toggle('known-entry', action==='known'); }
      } else { render(); }
    });
    bindTap(box);
    render('');
  }
  function wordByUid(id){
    if(id&&id.startsWith('wg:')) return grouped(base()).find(v=>uid(v)===id);
    return D.words.find(v=>uid(v)===id);
  }
  // Меню действий открывается по одиночному тапу (не по зажатию). Свайпы остаются.
  function bindTap(box){
    if(box._tap) return; box._tap=true; let sx=0,sy=0,moved=false;
    box.addEventListener('pointerdown',e=>{ sx=e.clientX; sy=e.clientY; moved=false; },{passive:true});
    box.addEventListener('pointermove',e=>{ if(Math.abs(e.clientX-sx)>10||Math.abs(e.clientY-sy)>10) moved=true; },{passive:true});
    box.addEventListener('click',e=>{ if(e.target.closest('[data-fav]')) return; if(moved){ moved=false; return; } const c=e.target.closest('[data-uid]'); if(c) openMenu(c.dataset.uid); });
  }
  function openMenu(id){ const v=wordByUid(id); if(!v) return;
    const sheet=document.getElementById('sheet');
    const cramOn=Store.settings().cramMode!==false;
    const details=groupItems(v).map(x=>`<div class="dict-sheet-row"><b>${LU.esc(LU.libName(x.lib))}</b><span>${LU.lessonLabel(x.lib,x.l)}</span><p>${LU.ml(x.r)}</p>${x.e?`<small>${LU.ml(x.e)}</small>`:''}</div>`).join('');
    sheet.innerHTML=`<div class="grip"></div>
      ${jpBlock(v, true)}
      <div class="dict-sheet-details">${details}</div>
      <div class="actions" style="grid-template-columns:1fr 1fr">
        <button class="btn primary" data-act="known">✓ Знаю</button>
        <button class="btn" data-act="learn">🎴 В деку</button>
        ${cramOn?'<button class="btn" data-act="cram">🔥 Зазубрить</button>':''}
        <button class="btn" data-act="archive">🗄 В архив</button>
        ${v.clib?`<button class="btn" data-act="edit" style="grid-column:1/-1">✏️ Редактировать (своя библиотека)</button>`:''}
        <button class="btn ghost" data-act="close" style="grid-column:1/-1">Закрыть</button></div>`;
    const mo=document.getElementById('modal'); mo.dataset.stats=''; mo.classList.add('open');
    sheet.querySelector('.actions').onclick=e=>{ const b=e.target.closest('[data-act]'); if(!b)return; const a=b.dataset.act;
      const ids=itemIds(v);
      if(a==='known'){ ids.forEach(x=>Store.set(x,{...(Store.get(x)||SRS.fresh()),s:'known',due:0})); Sound.play('known'); if(window.toast)toast('Отмечено: знаю'); }
      else if(a==='learn'){ ids.forEach(x=>{ Store.setArchive(x,false); Store.set(x,SRS.fresh()); }); if(window.toast)toast('В деку'); }
      else if(a==='cram'){ const x=primaryId(v); Store.setArchive(x,false); Store.setCram(x,true); if(window.toast)toast('В «Зазубрить» 🔥'); }
      else if(a==='archive'){ ids.forEach(x=>Store.setArchive(x,true)); if(window.toast)toast('В архив 🗄'); }
      else if(a==='edit'){ document.getElementById('modal').classList.remove('open'); if(window.App&&App.editItem) App.editItem(id); return; }
      document.getElementById('modal').classList.remove('open');
      const node=document.querySelector('[data-uid="'+id+'"]');
      if(node){
        if(a==='known') node.classList.add('known-entry');
        if(a==='learn') node.classList.remove('known-entry','archived-entry');
        if(a==='cram') node.classList.add('cram-entry');
        if(a==='archive') node.classList.add('archived-entry');
      }
      if(statusFilter!=='all'&&a!=='close'&&a!=='cram') render(); };
  }
  function refresh(){ libFilter='all'; lessonFilter=0; buildStatus(); buildLibs(); buildLessons(); render(currentQuery); }
  return { init, render, refresh, maybeRender };
})();
