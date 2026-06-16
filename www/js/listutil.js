/* ============================================================
   listutil.js — общие помощники списков (метки уроков/библ.,
   свайп по карточке для отметки «знаю», экранирование).
   ============================================================ */
const LU = (() => {
  const D = window.GENKI_DATA;
  const libName = lib => (D.meta.libraries.find(l=>l.id===lib)||{name:lib}).name;
  function lessonLabel(lib,l){
    const ln=D.meta.lessonNames&&D.meta.lessonNames[lib];
    if(ln&&ln[l]) return ln[l];
    return l===0?'Доп':'L'+l;
  }
  function esc(s){ return (s||'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }
  // активные библиотеки, по которым строится список
  const activeLibs = ()=> D.meta.libraries.filter(l=>Store.libOn(l.id));
  // свайп по строкам списка: вправо=знаю, влево=снять «знаю»
  function attachSwipe(container, uidOf, after){
    let el=null,x0=0,dx=0,drag=false; const TH=70;
    container.addEventListener('pointerdown',e=>{ el=e.target.closest('[data-uid]'); if(!el)return; x0=e.clientX; dx=0; drag=true; el.style.transition='none'; });
    container.addEventListener('pointermove',e=>{ if(!drag||!el)return; dx=e.clientX-x0;
      el.style.transform=`translateX(${dx}px)`; el.style.opacity=String(Math.max(.4,1-Math.abs(dx)/300)); });
    const end=()=>{ if(!drag||!el)return; drag=false; const node=el; el=null;
      node.style.transition='transform .18s,opacity .18s';
      const uid=node.dataset.uid;
      if(dx>TH){ Store.set(uid,{...(Store.get(uid)||SRS.fresh()),s:'known',due:0}); Sound.play('known'); node.style.transform='translateX(360px)'; node.style.opacity='0'; setTimeout(after,160); }
      else if(dx<-TH){ Store.set(uid,SRS.fresh()); Sound.play('add'); node.style.transform='translateX(-360px)'; node.style.opacity='0'; setTimeout(after,160); }
      else { node.style.transform=''; node.style.opacity=''; }
    };
    container.addEventListener('pointerup',end); container.addEventListener('pointercancel',end); container.addEventListener('pointerleave',end);
  }
  return { libName, lessonLabel, esc, activeLibs, attachSwipe };
})();
