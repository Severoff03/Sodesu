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
  // Несколько значений через «;» → каждое с новой строки.
  function ml(s){ return esc(s).replace(/\s*[;；]\s*/g,'<br>'); }
  // активные библиотеки, по которым строится список
  const activeLibs = (section)=> D.meta.libraries.filter(l=>Store.srcOn(section||'deck', l.id));
  // свайп по строкам списка: вправо=знаю, влево=снять «знаю».
  // after(uid, action) — точечное обновление без полного ререндера списка.
  function attachSwipe(container, _unused, after){
    let el=null,x0=0,dx=0,drag=false; const TH=70;
    container.addEventListener('pointerdown',e=>{ el=e.target.closest('[data-uid]'); if(!el)return; x0=e.clientX; dx=0; drag=true; el.style.transition='none'; el.style.willChange='transform'; },{passive:true});
    container.addEventListener('pointermove',e=>{ if(!drag||!el)return; dx=e.clientX-x0; if(Math.abs(dx)<4)return;
      el.style.transform=`translateX(${dx}px)`; el.style.opacity=String(Math.max(.4,1-Math.abs(dx)/300)); },{passive:true});
    const end=()=>{ if(!drag||!el)return; drag=false; const node=el; el=null;
      node.style.transition='transform .16s ease-out,opacity .16s ease-out';
      const uid=node.dataset.uid; const fin=()=>{ node.style.willChange=''; };
      if(dx>TH){ Store.set(uid,{...(Store.get(uid)||SRS.fresh()),s:'known',due:0}); Sound.play('known'); node.style.transform=''; node.style.opacity=''; if(after) after(uid,'known'); fin(); }
      else if(dx<-TH){ Store.set(uid,SRS.fresh()); Sound.play('add'); node.style.transform=''; node.style.opacity=''; if(after) after(uid,'unknown'); fin(); }
      else { node.style.transform=''; node.style.opacity=''; fin(); }
    };
    container.addEventListener('pointerup',end); container.addEventListener('pointercancel',end); container.addEventListener('pointerleave',end);
  }
  return { libName, lessonLabel, esc, ml, activeLibs, attachSwipe };
})();
