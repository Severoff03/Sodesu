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
  function statusOf(v){ const s=Store.status(uid(v)); return (s==='learning'||s==='review')?'learning':s; }
  function base(){ return D.words.filter(v=>Store.srcOn('mat',v.lib)); }
  function search(q){
    q=norm(q); let list=base();
    if(libFilter!=='all') list=list.filter(v=>v.lib===libFilter);
    if(lessonFilter) list=list.filter(v=>v.l===lessonFilter);
    if(statusFilter==='fav') list=list.filter(v=>Store.favHas(uid(v)));
    else if(statusFilter!=='all') list=list.filter(v=>statusOf(v)===statusFilter);
    if(!q) return list;
    const out=[];
    for(const v of list){ if(v.j.includes(q)||v.k.includes(q)||norm(v.e).includes(q)||norm(v.r).includes(q)){ out.push(v); } }
    out.sort((a,b)=>{ const am=a.k.startsWith(q)||a.j.startsWith(q)||norm(a.r).startsWith(q)?0:1; const bm=b.k.startsWith(q)||b.j.startsWith(q)||norm(b.r).startsWith(q)?0:1; return am-bm; });
    return out;
  }
  let _rev=-1;
  function scheduleRender(q){
    clearTimeout(renderTimer);
    renderTimer=setTimeout(()=>render(q),80);
  }
  function entryHtml(v){
    const id=uid(v); const known=Store.status(id)==='known'; const fav=Store.favHas(id); const hasJ=!!v.j; const arch=Store.isArchived(id);
    return `<div class="entry card${known?' known-entry':''}${arch?' archived-entry':''}" data-uid="${id}">
      <div class="jp">${hasJ?LU.esc(v.j):LU.esc(v.k)}${hasJ?`<span class="kana">${LU.esc(v.k)}</span>`:''}</div>
      <div class="mean"><div class="ru ru-main">${LU.ml(v.r)}</div><div class="en en-sub">${LU.ml(v.e)}</div></div>
      <div class="lz"><span class="fav${fav?' on':''}" data-fav="${id}">${fav?'★':'☆'}</span><br>${LU.lessonLabel(v.lib,v.l)}</div>
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
      const on=Store.favToggle(f.dataset.fav);
      if(statusFilter==='fav'){ render(); } else { f.classList.toggle('on',on); f.textContent=on?'★':'☆'; } });
    // Точечное обновление вместо ререндера всего списка (плавность при отметке).
    LU.attachSwipe(box, null, (uid,action)=>{
      if(statusFilter==='all'||statusFilter==='fav'){
        const node=box.querySelector('[data-uid="'+uid+'"]');
        if(node){ node.style.transform=''; node.style.opacity=''; node.classList.toggle('known-entry', action==='known'); }
      } else { render(); }
    });
    bindTap(box);
    render('');
  }
  function wordByUid(id){ return D.words.find(v=>uid(v)===id); }
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
    sheet.innerHTML=`<div class="grip"></div>
      <div class="big-kanji" style="font-size:46px">${LU.esc(v.j||v.k)}</div>
      <div class="sub">${LU.esc(v.k)} · ${LU.esc(v.r)}</div>
      <div class="actions" style="grid-template-columns:1fr 1fr">
        <button class="btn primary" data-act="known">✓ Знаю</button>
        <button class="btn" data-act="learn">🎴 В деку</button>
        ${cramOn?'<button class="btn" data-act="cram">🔥 Зазубрить</button>':''}
        <button class="btn" data-act="archive">🗄 В архив</button>
        ${v.clib?`<button class="btn" data-act="edit" style="grid-column:1/-1">✏️ Редактировать (своя библиотека)</button>`:''}
        <button class="btn ghost" data-act="close" style="grid-column:1/-1">Закрыть</button></div>`;
    const mo=document.getElementById('modal'); mo.dataset.stats=''; mo.classList.add('open');
    sheet.querySelector('.actions').onclick=e=>{ const b=e.target.closest('[data-act]'); if(!b)return; const a=b.dataset.act;
      if(a==='known'){ Store.set(id,{...(Store.get(id)||SRS.fresh()),s:'known',due:0}); Sound.play('known'); if(window.toast)toast('Отмечено: знаю'); }
      else if(a==='learn'){ Store.setArchive(id,false); Store.set(id,SRS.fresh()); if(window.toast)toast('В деку'); }
      else if(a==='cram'){ Store.setArchive(id,false); Store.setCram(id,true); if(window.toast)toast('В «Зазубрить» 🔥'); }
      else if(a==='archive'){ Store.setArchive(id,true); if(window.toast)toast('В архив 🗄'); }
      else if(a==='edit'){ document.getElementById('modal').classList.remove('open'); if(window.App&&App.editItem) App.editItem(id); return; }
      document.getElementById('modal').classList.remove('open'); if(a!=='close') render(); };
  }
  function refresh(){ libFilter='all'; lessonFilter=0; buildStatus(); buildLibs(); buildLessons(); render(currentQuery); }
  return { init, render, refresh, maybeRender };
})();
