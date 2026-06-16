/* ============================================================
   dictionary.js — словарь. Фильтры: статус/библиотека/урок.
   Русский ярче английского. Свайп →знаю/←снять. Избранное (★).
   ============================================================ */
const Dict = (() => {
  const D = window.GENKI_DATA;
  let statusFilter='all', libFilter='all', lessonFilter=0;
  const $ = id=>document.getElementById(id);
  const norm = s=>(s||'').toLowerCase().trim();
  const uid = v=>v.uid||('w'+v.id);
  function statusOf(v){ const s=Store.status(uid(v)); return (s==='learning'||s==='review')?'learning':s; }
  function base(){ return D.words.filter(v=>Store.libOn(v.lib)); }
  function search(q){
    q=norm(q); let list=base();
    if(libFilter!=='all') list=list.filter(v=>v.lib===libFilter);
    if(lessonFilter) list=list.filter(v=>v.l===lessonFilter);
    if(statusFilter==='fav') list=list.filter(v=>Store.favHas(uid(v)));
    else if(statusFilter!=='all') list=list.filter(v=>statusOf(v)===statusFilter);
    if(!q) return list.slice(0,200);
    const out=[];
    for(const v of list){ if(v.j.includes(q)||v.k.includes(q)||norm(v.e).includes(q)||norm(v.r).includes(q)){ out.push(v); if(out.length>=400) break; } }
    out.sort((a,b)=>{ const am=a.k.startsWith(q)||a.j.startsWith(q)||norm(a.r).startsWith(q)?0:1; const bm=b.k.startsWith(q)||b.j.startsWith(q)||norm(b.r).startsWith(q)?0:1; return am-bm; });
    return out;
  }
  function render(q){
    if(q==null) q=$('dictInput').value;
    const res=search(q);
    $('dictMeta').textContent=`Найдено: ${res.length} · 出典 Genki / материалы`;
    const box=$('dictResults');
    if(!res.length){ box.innerHTML=`<div class="empty"><div class="big">🔍</div>Ничего не найдено</div>`; return; }
    box.innerHTML=res.map(v=>{
      const id=uid(v); const known=Store.status(id)==='known'; const fav=Store.favHas(id); const hasJ=!!v.j;
      return `<div class="entry card${known?' known-entry':''}" data-uid="${id}">
        <div class="jp">${hasJ?LU.esc(v.j):LU.esc(v.k)}${hasJ?`<span class="kana">${LU.esc(v.k)}</span>`:''}</div>
        <div class="mean"><div class="ru ru-main">${LU.esc(v.r)}</div><div class="en en-sub">${LU.esc(v.e)}</div></div>
        <div class="lz"><span class="fav${fav?' on':''}" data-fav="${id}">${fav?'★':'☆'}</span><br>${LU.lessonLabel(v.lib,v.l)}</div>
      </div>`;
    }).join('');
  }
  function chips(wrap,arr,cur,attr,cb){ wrap.innerHTML=arr.map(([v,l])=>`<span class="pill${String(v)===String(cur)?' on':''}" data-${attr}="${v}">${l}</span>`).join(''); wrap.onclick=e=>{ const p=e.target.closest(`[data-${attr}]`); if(!p)return; cb(p.dataset[attr]); }; }
  function buildStatus(){ chips($('dStatus'),[['all','Все'],['new','Новые'],['learning','Учу'],['known','Знаю'],['fav','★']],statusFilter,'st',v=>{ statusFilter=v; buildStatus(); render(); }); }
  function buildLibs(){ const arr=[['all','Все']].concat(LU.activeLibs().map(l=>[l.id,l.name])); chips($('dLibs'),arr,libFilter,'lib',v=>{ libFilter=v; lessonFilter=0; buildLibs(); buildLessons(); render(); }); }
  function buildLessons(){ const wrap=$('dFilters'); if(libFilter==='all'){ wrap.innerHTML=''; return; }
    const ls=[...new Set(base().filter(v=>v.lib===libFilter).map(v=>v.l))].sort((a,b)=>a-b);
    const arr=[[0,'Все уроки']].concat(ls.map(l=>[l,LU.lessonLabel(libFilter,l)]));
    chips(wrap,arr,lessonFilter,'less',v=>{ lessonFilter=+v; buildLessons(); render(); }); }
  function init(){
    buildStatus(); buildLibs(); buildLessons();
    $('dictInput').addEventListener('input',()=>render());
    const box=$('dictResults');
    box.addEventListener('click',e=>{ const f=e.target.closest('[data-fav]'); if(f){ Store.favToggle(f.dataset.fav); render(); } });
    LU.attachSwipe(box, null, ()=>render());
    render('');
  }
  return { init, render };
})();
