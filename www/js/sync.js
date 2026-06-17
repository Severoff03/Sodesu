/* ============================================================
   sync.js — ИЗОЛИРОВАННО: экспорт/импорт прогресса и библиотек,
   перенос между устройствами кодом. Меняется независимо.
   ============================================================ */
const Sync = (() => {
  const $ = id=>document.getElementById(id);
  function showTextFallback(text, msg){
    const ta=$('syncCode');
    if(ta){ ta.style.display='block'; ta.value=text; ta.select(); try{ document.execCommand('copy'); }catch(_){} }
    alert(msg||'Файл не удалось сохранить напрямую. Данные показаны в поле кода, их можно скопировать вручную.');
  }
  function download(name, text, type){ try{
    const mime=type||'application/json';
    if(typeof File!=='undefined' && navigator.share && navigator.canShare){
      const file=new File([text],name,{type:mime});
      if(navigator.canShare({files:[file]})){
        navigator.share({files:[file],title:name}).catch(()=>showTextFallback(text));
        return;
      }
    }
    if(!('download' in HTMLAnchorElement.prototype)){ showTextFallback(text); return; }
    const b=new Blob([text],{type:mime}); const u=URL.createObjectURL(b);
    const a=document.createElement('a'); a.href=u; a.download=name; document.body.appendChild(a); a.click();
    setTimeout(()=>{ URL.revokeObjectURL(u); a.remove(); },500);
  }catch(e){ showTextFallback(text); } }
  function readFile(input, cb){ const f=input.files&&input.files[0]; if(!f) return; const r=new FileReader(); r.onload=()=>cb(r.result); r.readAsText(f); }
  const b64enc=s=>btoa(unescape(encodeURIComponent(s)));
  const b64dec=s=>decodeURIComponent(escape(atob(s.trim())));

  function init(){
    if($('syncExport')) $('syncExport').onclick=()=>download('sodesu-progress-'+Store.today()+'.json', Store.exportAll());
    if($('syncImportFile')) $('syncImportFile').addEventListener('change',e=>readFile(e.target,t=>{ if(Store.importAll(t)){ alert('Прогресс импортирован'); location.reload(); } else alert('Неверный файл'); }));
    if($('syncShowCode')) $('syncShowCode').onclick=()=>{ const code=b64enc(Store.exportAll());
      const done=()=>alert('Код прогресса скопирован в буфер обмена. Вставь его на другом устройстве.');
      if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(code).then(done,()=>fallback()); } else fallback();
      function fallback(){ const ta=$('syncCode'); ta.style.display='block'; ta.value=code; ta.select(); try{document.execCommand('copy');}catch(_){ } done(); ta.style.display='none'; } };
    if($('syncApplyCode')) $('syncApplyCode').onclick=()=>{ const ta=$('syncCode'); ta.style.display='block'; const v=ta.value.trim(); if(!v){ alert('Вставь код в поле'); return; } try{ if(Store.importAll(b64dec(v))){ alert('Прогресс перенесён'); location.reload(); } else alert('Неверный код'); }catch(e){ alert('Неверный код'); } };
    // библиотеки
    if($('libExport')) $('libExport').onclick=()=>download('sodesu-library-'+Store.today()+'.json', JSON.stringify(Store.custom()));
    if($('libImportFile')) $('libImportFile').addEventListener('change',e=>readFile(e.target,t=>{ try{ const o=JSON.parse(t); ['kanji','words','grammar'].forEach(k=>(o[k]||[]).forEach(x=>Store.addCustom(k,x))); alert('Библиотека импортирована'); location.reload(); }catch(_){ alert('Неверный файл библиотеки'); } }));
  }
  return { init };
})();
window.Sync = Sync;
