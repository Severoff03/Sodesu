/* ============================================================
   app.js — роутинг, главная, тесты, JLPT, настройки, темы,
   библиотеки, активность, своя библиотека.
   ============================================================ */
const App = (() => {
  const D = window.GENKI_DATA;
  const $ = id=>document.getElementById(id);
  const VERSION=(window.SODESU_VERSION&&window.SODESU_VERSION.label)||'0.11 (beta)';
  const THEMES=[{id:'light',label:'Светлая'},{id:'dark',label:'Тёмная'},{id:'zen',label:'Дзен'},{id:'retro',label:'Ретро'},{id:'shinkai',label:'空'},{id:'yurucamp',label:'Yuru Camp'}];
  const THEME_BG={light:'#fff7f5',dark:'#0b0e1a',zen:'#10221a',retro:'#15171c',shinkai:'#0b1424',yurucamp:'#0f1f1c'};
  const PHRASES=[['お元気ですか？','Как дела?'],['今日の天気はどうですか？','Какая сегодня погода?'],['週末は何をしますか？','Что будешь делать на выходных?'],['趣味は何ですか？','Какое у тебя хобби?'],['朝ごはんを食べましたか？','Ты позавтракал?'],['今、何をしていますか？','Чем сейчас занят?'],['好きな食べ物は何ですか？','Какая любимая еда?'],['昨日は何をしましたか？','Что делал вчера?'],['どこに行きたいですか？','Куда хочешь поехать?'],['最近どうですか？','Как ты в последнее время?'],['何時に起きましたか？','Во сколько встал?'],['今日もがんばりましょう！','Постараемся и сегодня!']];
  function greeting(){ const h=new Date().getHours(); if(h<5)return'おやすみなさい'; if(h<10)return'おはようございます！'; if(h<17)return'こんにちは！'; if(h<23)return'今晩は！'; return'こんばんは！'; }
  function phrase(){ return PHRASES[Math.floor(Date.now()/(5*3600*1000))%PHRASES.length]; }

  // ---- своя библиотека: пересборка D из базы + custom ----
  let baseKanji, baseWords, baseGrammar;
  function mergeCustom(){
    D.kanji=baseKanji.slice(); D.words=baseWords.slice(); D.grammar=baseGrammar.slice();
    D.meta.libraries=D.meta.libraries.filter(l=>!l.custom);
    (Store.customLibs()||[]).forEach(lib=>{
      D.meta.libraries.push({id:lib.id,name:lib.name,kind:lib.kind,custom:true});
      D.meta.lessonNames[lib.id]=lib.groups||{};
      (lib.items.words||[]).forEach((x,ci)=>{ const id=D.words.length; D.words.push({k:x.k,j:x.j||'',e:x.e||'',r:x.r,a:x.a||x.audio||'',pa:x.pa||x.pitch||'',l:x.l||1,lib:lib.id,id,uid:lib.id+'w'+id,clib:lib.id,ctype:'words',ci}); });
      (lib.items.kanji||[]).forEach((x,ci)=>{ const id=D.kanji.length; D.kanji.push({c:x.c,m:x.m||'',l:x.l||1,lib:lib.id,freq:0,ex:[],id,uid:lib.id+'k'+id,clib:lib.id,ctype:'kanji',ci}); });
      (lib.items.grammar||[]).forEach((x,ci)=>{ const id=D.grammar.length; D.grammar.push({t:x.t,p:x.p||'',m:x.m||'',d:x.d||x.m||'',l:x.l||1,lib:lib.id,id,uid:lib.id+'g'+id,clib:lib.id,ctype:'grammar',ci}); });
    });
  }

  let nav=['home'];
  function go(view,fromPop){
    if(!fromPop){ if(nav[nav.length-1]!==view){ nav.push(view); try{ history.pushState({view},''); }catch(e){} } }
    document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active', v.id==='view-'+view));
    document.querySelectorAll('[data-go]').forEach(b=>b.classList.toggle('active', b.dataset.go===view));
    window.scrollTo(0,0);
    if(view==='study') Study.start();
    if(view==='kanji') KList.maybeRender();
    if(view==='dict') Dict.maybeRender();
    if(view==='grammar') Gram.maybeRender();
    if(view==='home') home();
    if(view==='settings') syncSettings();
    if(view==='test'){ Test.backToSetup(); }
    screenHint(view);
  }

  function metric(items){ const c=SRS.counts(items,Store); return {known:c.known, rest:c.total-c.known}; }
  function deckLeft(deck, items){ const left=Store.deckRemaining(deck); if(left<=0) return 0; return SRS.queue(items,Store,{newLimit:left,limit:left}).queue.length; }
  let showRu=false;
  function home(){
    $('greet').textContent=greeting();
    const p=phrase(); showRu=false; const pj=$('phraseJp'); pj.textContent=p[0]; pj.dataset.jp=p[0]; pj.dataset.ru=p[1];
    const mk=metric(D.kanji),mw=metric(D.words),mg=metric(D.grammar);
    const fill=(id,m,lbl)=>$(id).innerHTML=`<div class="n">${m.known}</div><div class="l">${lbl}</div><div class="rest">осталось ${m.rest}</div>`;
    fill('mKanji',mk,'кандзи'); fill('mWords',mw,'слов'); fill('mGram',mg,'грамматик');
    // Если на сегодня нечего учить (нет новых/повторений) — кнопка «Дека» гаснет (без градиента).
    const left=deckLeft('kanji',D.kanji)+deckLeft('words',D.words)+deckLeft('grammar',D.grammar);
    const dc=$('deckCta'); if(dc) dc.classList.toggle('primary', left>0);
    Cal.render($('cal')); flame();
  }
  function togglePhrase(){ const pj=$('phraseJp'); showRu=!showRu; pj.textContent=showRu?pj.dataset.ru:pj.dataset.jp; Sound.play('tap'); }

  // ---- статистика за 7 дней (клик по активности) ----
  function weekStats(){
    const act=Store.activity(); const hist=Store.history();
    const days=[]; let flips=0; const since=Date.now()-7*86400000;
    for(let i=6;i>=0;i--){ const d=new Date(); d.setDate(d.getDate()-i);
      const key=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
      const f=act[key]||0; flips+=f; days.push([key.slice(5),f]); }
    const tests=hist.filter(r=>r.ts>=since);
    const avg=tests.length? Math.round(tests.reduce((s,r)=>s+100*r.score/r.total,0)/tests.length):0;
    $('sheet').innerHTML=`<div class="grip"></div><div class="block-title" style="margin-top:0">Статистика за 7 дней</div>
      <div class="stats-grid"><div class="stat card"><div class="n">${flips}</div><div class="l">карточек</div></div>
        <div class="stat card"><div class="n">${tests.length}</div><div class="l">тестов</div></div>
        <div class="stat card"><div class="n">${avg}%</div><div class="l">ср. результат</div></div></div>
      <div style="margin:8px 0 4px;font-size:12px;color:var(--muted2)">Карточек по дням</div>
      ${days.map(([d,f])=>`<div class="ex"><span class="w" style="min-width:60px;font-size:14px">${d}</span>
        <span class="mn" style="margin-left:0"><span style="display:inline-block;height:8px;border-radius:4px;background:var(--green);width:${Math.min(100,f*4)}px;min-width:2px"></span> ${f}</span></div>`).join('')}
      ${tests.length?'<div style="margin:14px 0 4px;font-size:12px;color:var(--muted2)">Тесты</div>'+tests.slice(0,8).map(r=>`<div class="ex"><span class="w" style="min-width:auto;font-size:14px">${esc(r.source)}</span><span class="mn">${r.score}/${r.total}</span></div>`).join(''):''}
      <div class="actions" style="grid-template-columns:1fr"><button class="btn ghost" id="mClose2">Закрыть</button></div>`;
    const m=$('modal'); m.classList.add('open'); m.dataset.stats='1'; try{ history.pushState({modal:'stats'},''); }catch(e){}
    $('mClose2').onclick=()=>{ m.classList.remove('open'); m.dataset.stats=''; };
  }

  // ---- тесты строит модуль Test ----

  // ---- настройки ----
  function applyTheme(t){ document.documentElement.setAttribute('data-theme',t); const m=document.querySelector('meta[name=theme-color]'); if(m) m.content=THEME_BG[t]||'#0b0e1a'; applyYuruBg(Store.settings().yuruBg||'none'); applyIcon(t); applyUserBg(t); }
  function bgLayer(){ let L=document.getElementById('bgLayer'); if(!L){ L=document.createElement('div'); L.id='bgLayer'; document.body.prepend(L); } return L; }
  function applyUserBg(t){ const L=bgLayer(); const bg=Store.bg(t); L.style.backgroundImage = bg ? `linear-gradient(rgba(8,10,16,.5),rgba(8,10,16,.62)),url(${bg})` : ''; L.classList.toggle('contain', Store.settings().bgFit==='contain'); }
  function applyYuruBg(v){ document.documentElement.setAttribute('data-yuru', v||'none'); }
  function applyIcon(t){ const src=t==='yurucamp'?'assets/themes/yuru/icon.jpg':'assets/icon.png'; document.querySelectorAll('.topbar .logo, .sidebar .brand img').forEach(im=>{ im.onerror=()=>{ im.onerror=null; im.src='assets/icon.png'; }; im.src=src; }); }
  function buildYuru(){ const el=$('yuruRow'); if(!el) return; const hasBg=Store.settings().theme==='yurucamp'; el.style.display=hasBg?'':'none'; if(!hasBg){ el.innerHTML=''; return; } const cur=String(Store.settings().yuruBg||'1'); const opts=[['none','Без фона'],['1','Фон 1'],['2','Фон 2']]; el.innerHTML=opts.map(([v,l])=>`<span class="pill${cur===v?' on':''}" data-yb="${v}">${l}</span>`).join(''); el.onclick=e=>{ const b=e.target.closest('[data-yb]'); if(!b)return; const v=b.dataset.yb; Store.setSetting('yuruBg',v); applyYuruBg(v); buildYuru(); Sound.play('tap'); }; }
  function buildThemes(){ $('themeRow').innerHTML=THEMES.map(t=>`<button class="theme-btn" data-theme="${t.id}"><span class="sw sw-${t.id}"></span>${t.label}</button>`).join('');
    $('themeRow').onclick=e=>{ const b=e.target.closest('[data-theme]'); if(!b)return; Store.setSetting('theme',b.dataset.theme); applyTheme(b.dataset.theme); syncSettings(); Sound.play('tap'); }; }
  function libLessons(id){ return [...new Set(D.words.concat(D.kanji,D.grammar).filter(x=>x.lib===id).map(x=>x.l))].sort((a,b)=>a-b); }
  function libKind(id){ const l=D.meta.libraries.find(x=>x.id===id); return l&&l.kind?l.kind:'lessons'; }
  function buildLibs(){
    $('libsRow').innerHTML=D.meta.libraries.map(l=>{ const on=Store.libOn(l.id); const ls=libLessons(l.id); let extra='';
      if(on && ls.length>1){
        if(libKind(l.id)==='themes'){ const sel=Store.libThemes(l.id); const set=sel?new Set(sel):new Set(ls);
          extra='<div class="lib-range">'+ls.map(n=>`<span class="pill mini${set.has(n)?' on':''}" data-th="${l.id}" data-n="${n}">${LU.lessonLabel(l.id,n)}</span>`).join('')+'</div>'; }
        else { const r=Store.libLess(l.id)||{min:ls[0],max:ls[ls.length-1]}; const opt=sel=>ls.map(n=>`<option value="${n}"${n===sel?' selected':''}>${LU.lessonLabel(l.id,n)}</option>`).join('');
          extra=`<div class="lib-range"><span>уроки</span><select data-lr="${l.id}" data-b="min">${opt(r.min)}</select><span>—</span><select data-lr="${l.id}" data-b="max">${opt(r.max)}</select></div>`; }
      }
      return `<div class="lib-item"><label class="toggle"><input type="checkbox" data-lib="${l.id}" ${on?'checked':''}> ${l.name}</label>${extra}</div>`;
    }).join('');
    $('libsRow').onclick=e=>{ const th=e.target.closest('[data-th]'); if(!th)return; const lib=th.dataset.th,n=+th.dataset.n; const ls=libLessons(lib); const cur=new Set(Store.libThemes(lib)||ls); if(cur.has(n))cur.delete(n); else cur.add(n); Store.setLibThemes(lib,[...cur]); buildLibs(); };
    $('libsRow').onchange=e=>{ const c=e.target.closest('[data-lib]'); if(c){ Store.setLib(c.dataset.lib,c.checked); buildLibs(); return; }
      const lr=e.target.closest('[data-lr]'); if(lr){ const lib=lr.dataset.lr, ls=libLessons(lib); const cur=Store.libLess(lib)||{min:ls[0],max:ls[ls.length-1]}; cur[lr.dataset.b]=+lr.value; if(cur.min>cur.max){ if(lr.dataset.b==='min')cur.max=cur.min; else cur.min=cur.max; } Store.setLibLess(lib,cur); buildLibs(); } };
  }
  // Общие источники для Словаря/Кандзи/Грамматики (один набор «mat»).
  function buildSrcRows(){ const el=$('srcRows'); if(!el) return; const libs=D.meta.libraries; const allOn=libs.every(l=>Store.srcOn('mat',l.id));
    el.innerHTML=`<div class="lib-item"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><b>Библиотеки</b><span class="pill mini" data-srcall="mat">${allOn?'Снять всё':'Выбрать всё'}</span></div>
      <div class="lib-range">${libs.map(l=>`<span class="pill mini${Store.srcOn('mat',l.id)?' on':''}" data-src="mat" data-lib="${l.id}">${esc(l.name)}</span>`).join('')}</div></div>`;
  }
  function refreshSection(s){ try{ Dict.refresh(); KList.render(); Gram.refresh(); }catch(e){} }
  function syncSettings(){
    const s=Store.settings();
    document.querySelectorAll('.theme-btn').forEach(b=>b.classList.toggle('on', b.dataset.theme===s.theme));
    $('soundToggle').checked=s.sound; $('soundStd').checked=(s.soundSet==='standard');
    $('volume').value=Math.round(s.volume*100); $('volLbl').textContent=Math.round(s.volume*100)+'%';
    $('nkLbl').textContent=s.newKanji; $('nwLbl').textContent=s.newWords; $('ngLbl').textContent=s.newGrammar;
    if($('ccLbl')) $('ccLbl').textContent=(s.cramCooldown!=null?s.cramCooldown:10);
    if($('cnLbl')) $('cnLbl').textContent=(s.cramNeed!=null?s.cramNeed:3);
    if($('gramCommentSel')) $('gramCommentSel').value = s.grammarComment==null?'auto':(s.grammarComment?'on':'off');
    if($('bgFit')) $('bgFit').checked = s.bgFit==='contain';
    if($('dictFuriSet')) $('dictFuriSet').checked = s.dictFuri!==false;
    if($('studyFuriSet')) $('studyFuriSet').checked = !!s.studyFuri;
    if($('studyAudioSet')) $('studyAudioSet').checked = s.studyAudioButton!==false;
    if($('pitchAccentSet')) $('pitchAccentSet').checked = s.pitchAccent!==false;
    if($('cramModeSet')) $('cramModeSet').checked = s.cramMode!==false;
    if($('cramFuriSet')) $('cramFuriSet').checked = !!s.cramFuri;
    buildLibs(); buildSrcRows(); buildYuru();
    $('aboutTxt').innerHTML=`<b>そうです</b> · версия <b>${VERSION}</b><br>Кандзи, слова и грамматика по Genki I & II + материалы.<br>Разработчик: <b>Mothman</b>.`;
  }
  function bindSettings(){
    $('soundToggle').addEventListener('change',e=>{ Store.setSetting('sound',e.target.checked); if(e.target.checked) Sound.play('correct'); });
    $('soundStd').addEventListener('change',e=>{ Store.setSetting('soundSet', e.target.checked?'standard':'theme'); Sound.play('correct'); });
    $('volume').addEventListener('input',e=>{ const v=+e.target.value; $('volLbl').textContent=v+'%'; Store.setSetting('volume',v/100); });
    $('volume').addEventListener('change',()=>Sound.play('correct'));
    const ST={newKanji:{step:5,max:40,lbl:'nkLbl'},newWords:{step:5,max:40,lbl:'nwLbl'},newGrammar:{step:1,max:20,lbl:'ngLbl'},cramCooldown:{step:5,max:120,min:0,lbl:'ccLbl'},cramNeed:{step:1,max:10,min:1,lbl:'cnLbl'}};
    document.querySelectorAll('[data-step]').forEach(b=>b.onclick=()=>{ const key=b.dataset.step,d=+b.dataset.d,c=ST[key]; const cur=(Store.settings()[key]!=null?Store.settings()[key]:0); let v=Math.min(c.max,Math.max(c.min||0,cur+d*c.step)); Store.setSetting(key,v); $(c.lbl).textContent=v; Sound.play('tap'); });
    if($('gramCommentSel')) $('gramCommentSel').addEventListener('change',e=>{ const v=e.target.value; Store.setSetting('grammarComment', v==='auto'?null:(v==='on')); });
    if($('bgFile')) $('bgFile').addEventListener('change',e=>{ const f=e.target.files[0]; if(!f)return; const r=new FileReader(); r.onload=()=>{ Store.setBg(Store.settings().theme,r.result); applyTheme(Store.settings().theme); alert('Фон установлен для текущей темы'); }; r.readAsDataURL(f); });
    if($('bgReset')) $('bgReset').onclick=()=>{ Store.setBg(Store.settings().theme,null); applyTheme(Store.settings().theme); };
    if($('bgFit')) $('bgFit').addEventListener('change',e=>{ Store.setSetting('bgFit', e.target.checked?'contain':'cover'); applyUserBg(Store.settings().theme); document.getElementById('bgLayer')&&document.getElementById('bgLayer').classList.toggle('contain', e.target.checked); });
    if($('dictFuriSet')) $('dictFuriSet').addEventListener('change',e=>{ Store.setSetting('dictFuri',e.target.checked); Dict.refresh(); });
    if($('studyFuriSet')) $('studyFuriSet').addEventListener('change',e=>Store.setSetting('studyFuri',e.target.checked));
    if($('studyAudioSet')) $('studyAudioSet').addEventListener('change',e=>{ Store.setSetting('studyAudioButton',e.target.checked); if($('view-study')&&$('view-study').classList.contains('active')) Study.start(); });
    if($('pitchAccentSet')) $('pitchAccentSet').addEventListener('change',e=>{ Store.setSetting('pitchAccent',e.target.checked); refreshSection(); if($('view-study')&&$('view-study').classList.contains('active')) Study.start(); });
    if($('advancedBtn')) $('advancedBtn').onclick=()=>{ const box=$('advancedSettings'); if(!box)return; const open=!box.classList.contains('open'); box.classList.toggle('open',open); $('advancedBtn').textContent=open?'Скрыть расширенную кастомизацию':'Открыть расширенную кастомизацию'; Sound.play('tap'); };
    if($('cramModeSet')) $('cramModeSet').addEventListener('change',e=>{ Store.setSetting('cramMode',e.target.checked); flame(); if($('view-study')&&$('view-study').classList.contains('active')) Study.start(); });
    if($('cramFuriSet')) $('cramFuriSet').addEventListener('change',e=>{ Store.setSetting('cramFuri',e.target.checked); if($('view-study')&&$('view-study').classList.contains('active')) Study.startCram(); });
    if($('supportBtn')) $('supportBtn').onclick=()=>openExternal('https://github.com/Severoff03/sodesu/issues/new');
    if($('donateBtn')) $('donateBtn').onclick=()=>openExternal('https://boosty.to/m0thman/donate');
    if($('ttsInstallBtn')) $('ttsInstallBtn').onclick=()=>{
      try{
        if(window.Android&&typeof window.Android.installTts==='function'){
          window.Android.installTts();
          return;
        }
      }catch(e){}
      toast('Доступно в Android-приложении');
    };
    if($('libsAll')) $('libsAll').onclick=()=>{ const on=!D.meta.libraries.every(l=>Store.libOn(l.id)); D.meta.libraries.forEach(l=>Store.setLib(l.id,on)); buildLibs(); home(); Sound.play('tap'); };
    if($('srcRows')) $('srcRows').onclick=e=>{ const all=e.target.closest('[data-srcall]'); if(all){ const s=all.dataset.srcall; const on=!D.meta.libraries.every(l=>Store.srcOn(s,l.id)); D.meta.libraries.forEach(l=>Store.setSrc(s,l.id,on)); buildSrcRows(); refreshSection(s); Sound.play('tap'); return; }
      const p=e.target.closest('[data-src]'); if(p){ const s=p.dataset.src,lib=p.dataset.lib; Store.setSrc(s,lib,!Store.srcOn(s,lib)); buildSrcRows(); refreshSection(s); } };
    if($('libAddBtn')) $('libAddBtn').onclick=openLibEditor;
    if($('libExportBtn')) $('libExportBtn').onclick=exportLibPick;
    if($('libImportFile')) $('libImportFile').addEventListener('change',e=>{ const f=e.target.files[0]; if(!f){ return; } const r=new FileReader();
      r.onload=()=>{ try{ if(Sync.importCsv(f.name.replace(/\.csv$/i,''),r.result)){ mergeCustom(); buildLibs(); buildSrcRows(); refreshSection(); home(); toast('Библиотека добавлена ✓'); } else toast('Файл пуст или неверный формат CSV'); }catch(err){ toast('Не удалось прочитать файл'); } e.target.value=''; };
      r.onerror=()=>{ toast('Не удалось открыть файл'); e.target.value=''; };
      r.readAsText(f,'utf-8'); });
    if($('archClear')) $('archClear').onclick=()=>{ const n=Store.archiveCount(); if(!n){ toast('Архив пуст'); return; } confirmBox('Очистить архив?','Все '+n+' слов(а) из архива вернутся в учёбу.','Очистить',()=>{ Store.clearArchive(); Dict.refresh(); home(); toast('Архив очищен'); }); };
    $('resetBtn').addEventListener('click',()=>{ confirmBox('Удалить весь прогресс?','Будут стёрты статусы, активность, история и «Зазубрить». Это действие необратимо.','Удалить', ()=>{ Store.reset(); home(); KList.render(); Dict.render(); Gram.render(); syncSettings(); flame(); toast('Прогресс удалён'); }); });
  }

  function toast(msg){ let t=document.getElementById('toast'); if(!t){ t=document.createElement('div'); t.id='toast'; document.body.appendChild(t);} t.textContent=msg; t.classList.add('show'); clearTimeout(t._h); t._h=setTimeout(()=>t.classList.remove('show'),2200); }
  window.toast=toast;
  // Свой диалог подтверждения (window.confirm в WebView не работает).
  function confirmBox(title, text, okLabel, onYes){
    const old=document.getElementById('confirmOv'); if(old) old.remove();
    const o=document.createElement('div'); o.id='confirmOv'; o.className='onboard';
    o.innerHTML=`<div class="ob-card"><div class="ob-h">${esc(title)}</div>
      <div class="ob-row" style="display:block">${esc(text)}</div>
      <div style="display:flex;gap:10px;margin-top:14px">
        <button class="btn" id="cbNo" style="flex:1">Отмена</button>
        <button class="btn danger" id="cbYes" style="flex:1">${esc(okLabel||'Да')}</button>
      </div></div>`;
    document.body.appendChild(o);
    const close=()=>o.remove();
    o.addEventListener('click',e=>{ if(e.target===o) close(); });
    document.getElementById('cbNo').onclick=close;
    document.getElementById('cbYes').onclick=()=>{ close(); try{ onYes&&onYes(); }catch(e){} };
  }
  function openExternal(url){ try{ if(window.Android&&typeof window.Android.openUrl==='function'){ window.Android.openUrl(url); return; } }catch(e){} try{ window.open(url,'_blank'); }catch(e){} }

  // ---- Автопроверка версии по GitHub Releases ----
  const REPO='Severoff03/sodesu';
  function verNums(v){ return String(v||'').replace(/^[vV]/,'').split(/[^0-9]+/).filter(s=>s!=='').map(n=>parseInt(n,10)||0); }
  function cmpVer(a,b){ const x=verNums(a),y=verNums(b); for(let i=0;i<Math.max(x.length,y.length);i++){ const d=(x[i]||0)-(y[i]||0); if(d) return d>0?1:-1; } return 0; }
  function showUpdate(tag,url){
    if(document.getElementById('updOv')) return;
    const o=document.createElement('div'); o.id='updOv'; o.className='onboard';
    o.innerHTML=`<div class="ob-card"><div class="ob-h">Доступно обновление</div>
      <div class="ob-row" style="display:block">Вышла новая версия <b>${esc(tag)}</b> (у вас ${esc(VERSION)}). Скачайте свежий релиз на GitHub.</div>
      <div style="display:flex;gap:10px;margin-top:14px">
        <button class="btn" id="updLater" style="flex:1">Позже</button>
        <button class="btn primary" id="updGo" style="flex:1">Обновиться</button></div></div>`;
    document.body.appendChild(o); const close=()=>o.remove(); o.addEventListener('click',e=>{ if(e.target===o) close(); });
    o.querySelector('#updLater').onclick=close;
    o.querySelector('#updGo').onclick=()=>{ close(); openExternal(url); };
  }
  function checkUpdate(){
    if(!window.fetch) return;
    fetch('https://api.github.com/repos/'+REPO+'/releases/latest',{headers:{'Accept':'application/vnd.github+json'}})
      .then(r=>r.ok?r.json():null)
      .then(j=>{ if(!j) return; const tag=(j.tag_name||j.name||'').trim(); if(!tag) return;
        const url=j.html_url||('https://github.com/'+REPO+'/releases/latest');
        if(cmpVer(tag, VERSION)>0) showUpdate(tag,url); })
      .catch(()=>{});
  }

  // ---- Одноразовые подсказки (показываются один раз для человека) ----
  function hint(id, title, text){
    if(Store.hintSeen(id)) return; Store.markHint(id);
    const o=document.createElement('div'); o.className='onboard';
    o.innerHTML=`<div class="ob-card"><div class="ob-h">${esc(title)}</div>
      <div class="ob-row" style="display:block">${esc(text)}</div>
      <button class="btn primary" id="hOk" style="width:100%;margin-top:12px">Понятно</button></div>`;
    document.body.appendChild(o);
    const close=()=>o.remove(); o.addEventListener('click',e=>{ if(e.target===o) close(); });
    o.querySelector('#hOk').onclick=close;
  }
  window.appHint=hint;
  const SCREEN_HINTS={
    dict:['Словарь','Свайп карточки вправо — отметить «знаю», влево — убрать из «знаю». ☆ — добавить в избранное. Фильтры сверху: статус, библиотека, тема/урок.'],
    grammar:['Грамматика','Нажми на конструкцию — откроется подробное объяснение с примером. Свайп вправо — «знаю». ☆ — избранное.'],
    kanji:['Кандзи','Долгое нажатие на кандзи отмечает его как «знаю» (или снимает). Тап — карточка с чтениями и примерами.'],
    test:['Тесты','Сначала выбери вариант теста и параметры (статус, библиотеки, уроки, режим, лимит времени), затем «Начать». История тестов — внизу.'],
    study:['Дека','Тап по карточке — перевод. Свайп вправо — «знаю», влево — отложить (повтор позже). 🔥 «Зазубрить» — на главной.'],
    settings:['Настройки','Здесь: материалы и лимиты деки, темы и свой фон, свои библиотеки (импорт/экспорт), резервная копия прогресса файлом.']
  };
  function screenHint(view){ const h=SCREEN_HINTS[view]; if(h) hint('h_'+view, h[0], h[1]); }

  // ---- «Что нового» после обновления ----
  const CHANGES={
    '0.11 (beta)':[
      'Дека: «Осталось» = карточки на сегодня; любое взаимодействие уменьшает на 1.',
      'Главная: убрана строка «К повторению сегодня»; кнопка «Дека» гаснет (без градиента), когда на сегодня учить нечего.',
      'В редакторе своих библиотек после добавления очищаются только поля слова — выбранные библиотека и занятие/тема остаются.'
    ],
    '0.11.3 (beta)':[
      'Дека: верхняя строка теперь просто «Осталось N» (без деления на новые/повторения); в «Зазубрить» она скрыта.',
      '«Зазубрить»: после «Знаю» показывается, сколько ещё раз отметить.',
      'У слова может быть несколько значений — разделяйте «;», показываются списком.',
      'Тесты: варианты ответа берутся из того же занятия/темы (без посторонних слов).',
      'Архивные слова в словаре показываются серым; в Настройках — «Очистить архив».',
      'Можно докачать библиотеки (Genki и JLPT на базе jisho) из папки libraries на GitHub — импорт через Настройки → Библиотеки.'
    ],
    '0.11.2 (beta)':[
      '«Зазубрить»: кнопки «Не знаю»/«Знаю» поменяны местами; для выхода нужно N раз «Знаю» подряд (настраивается); счётчики/тосты убраны.',
      'Слова из «Зазубрить» не показываются в обычной деке.',
      'В деке: «не знаю» (свайп влево) — дальше любой свайп листает без штампов; примеры к кандзи только содержащие иероглиф.',
      'Архив и «Зазубрить» считаются в дневном счётчике новых.',
      'Элементы своих библиотек можно редактировать и удалять (через меню/шторку).',
      'Главная: плитки статистики ведут в Словарь/Кандзи/Грамматику; «Лимиты» → «Настройки».',
      'Когда «Зазубрить» на паузе — пишет, через сколько вернуться. Ежедневные уведомления отключены.'
    ],
    '0.11.1 (beta)':[
      'Библиотеки по умолчанию выгружены в 3 файла .csv (Genki 1, Genki 2, Полезные материалы).',
      'Кнопка-огонёк скрывается, если все слова «Зазубрить» на паузе.',
      'Длительность паузы «Зазубрить» настраивается (Настройки → Настройка деки).',
      '«Зазубрить»: после перевода свайп влево — «Не знаю» (пауза, без зачёта).',
      'Раздельные источники для Словаря, Кандзи и Грамматики + «Выбрать всё».',
      '«Учить» переименован в «Дека». В словаре долгое нажатие — меню (Знаю/В деку/Зазубрить/Архив).',
      'Удаление своих библиотек; выбор готовой темы при добавлении; починен тап по кандзи после прокрутки.',
      'Роадмап: устойчивые выражения в библиотеку.'
    ],
    '0.10 (beta)':[
      'Резервная копия прогресса только файлом (выбор места сохранения).',
      '«Полезные материалы» делятся по темам.',
      'Кнопки GitHub/Boosty открываются во внешнем браузере.',
      '«Зазубрить»: выход из категории после 3 «Знаю»; отложенные слова возвращаются через 10 минут.',
      'Подсказки в меню, «Что нового» после обновлений.',
      'Свой диалог подтверждения сброса; убраны дубли слов; экспорт выбранной библиотеки; выбор готовой темы/урока при добавлении.',
      'Оптимизация: словарь больше не лагает при отметке слов.'
    ]
  };
  function whatsNew(){
    const seen=Store.seenVersion();
    if(seen===VERSION) return;
    const firstEver = !seen && !Store.onboarded(); // совсем новый пользователь — без окна
    Store.setSeenVersion(VERSION);
    if(firstEver) return;
    const items=CHANGES[VERSION]||[]; if(!items.length) return;
    const o=document.createElement('div'); o.className='onboard';
    o.innerHTML=`<div class="ob-card"><div class="ob-h">Что нового · ${esc(VERSION)}</div>
      <ul class="ob-list">${items.map(t=>`<li>${esc(t)}</li>`).join('')}</ul>
      <button class="btn primary" id="wnOk" style="width:100%;margin-top:14px">Отлично</button></div>`;
    document.body.appendChild(o);
    const close=()=>o.remove(); o.addEventListener('click',e=>{ if(e.target===o) close(); });
    o.querySelector('#wnOk').onclick=close;
  }
  function flame(){ const b=$('flameBtn'); if(!b) return; if(Store.settings().cramMode===false){ b.style.display='none'; return; } const ready=Store.cramList().some(u=>Store.cramReady(u)); b.style.display=ready?'':'none'; b.onclick=()=>{ Study.startCram(); hint('h_cram','Зазубрить 🔥','Здесь только слова из категории «Зазубрить». Свайп вправо — «Знаю» (3 раза — слово выходит). Свайп влево — перевод, слово вернётся через 10 минут. «Ещё» — показать сразу.'); }; }
  function onboard(){ if(Store.onboarded()) return; const o=document.createElement('div'); o.id='onboard'; o.innerHTML='<div class="ob-card"><div class="ob-h">Как пользоваться</div><div class="ob-row">🎴 <b>Дека</b> — тап по карточке покажет перевод.</div><div class="ob-row">➡️ Свайп вправо — «знаю».</div><div class="ob-row">⬅️ Свайп влево — в деку (повтор позже).</div><div class="ob-row">🔥 «Зазубрить» — частый повтор сложных слов с главной.</div><div class="ob-row">📚 Материалы и лимиты — в Настройках.</div><div class="ob-row">⬇️ Можно докачать библиотеки (в т.ч. <b>JLPT</b>, на базе jisho) и импортировать через Настройки → Библиотеки.</div><button class="btn" id="obLibs" style="width:100%;margin-top:10px">📚 Где скачать библиотеки</button><button class="btn primary" id="obClose" style="width:100%;margin-top:8px">Понятно!</button></div>'; document.body.appendChild(o); const obl=document.getElementById('obLibs'); if(obl) obl.onclick=()=>openExternal('https://github.com/Severoff03/sodesu/tree/main/libraries'); document.getElementById('obClose').onclick=()=>{ Store.setOnboarded(); o.remove(); }; }
  function openLibEditor(preLib, preGroup){
    const libs=Store.customLibs(); const ph={words:['Кандзи (опц.)','Кана','Перевод'],kanji:['Кандзи (1 символ)','Значение',''],grammar:['Конструкция','Шаблон','Значение/описание']};
    $('sheet').innerHTML=`<div class="grip"></div><div class="block-title" style="margin-top:0">Редактор библиотек</div>
      <div class="field"><label>Библиотека</label><select id="leLib" class="q-input"><option value="__new"${!preLib||preLib==='__new'?' selected':''}>+ Новая библиотека</option>${libs.map(l=>`<option value="${l.id}"${l.id===preLib?' selected':''}>${esc(l.name)}</option>`).join('')}</select></div>
      <div id="leNewBox"><div class="field"><label>Название</label><input id="leName" class="q-input" placeholder="Моя библиотека"></div>
        <div class="field"><label>Деление</label><select id="leKind" class="q-input"><option value="lessons">По занятиям</option><option value="themes">По темам</option></select></div></div>
      <div class="field"><label>Занятие/тема</label>
        <select id="leGroup" class="q-input"></select>
        <input id="leGroupName" class="q-input" placeholder="Новая тема/занятие: Урок 1 / Глаголы…" style="margin-top:8px"></div>
      <div class="field"><label>Что добавить</label><select id="leType" class="q-input"><option value="words">Слово</option><option value="kanji">Кандзи</option><option value="grammar">Грамматика</option><option value="text" disabled>Текст (WIP)</option><option value="audio" disabled>Аудирование (WIP)</option></select></div>
      <div id="leFields"></div>
      <button class="btn primary" id="leAdd" style="width:100%">Добавить</button>
      <button class="btn danger" id="leDel" style="width:100%;margin-top:8px;display:none">🗑 Удалить эту библиотеку</button>
      <button class="btn ghost" id="leClose" style="width:100%;margin-top:8px">Закрыть</button>`;
    $('modal').dataset.stats=''; $('modal').classList.add('open');
    const delBtn=()=>{ const cur=$('leLib').value; $('leDel').style.display=(cur && cur!=='__new')?'':'none'; };
    const bindAudioFile=(fileId,inputId)=>{ const f=$(fileId), inp=$(inputId); if(!f||!inp) return; f.onchange=e=>{ const file=e.target.files&&e.target.files[0]; if(!file) return; const r=new FileReader(); r.onload=()=>{ inp.value=String(r.result||''); toast('Аудио добавлено'); }; r.readAsDataURL(file); }; };
    const flds=()=>{ const a=ph[$('leType').value]||ph.words; const wordExtra=$('leType').value==='words'?`<input id="lePitch" class="q-input" placeholder="Тон (0, 1, 2 или 0,2)" style="margin-bottom:8px"><input id="leAudio" class="q-input" placeholder="Аудио URL / data: / assets/..." style="margin-bottom:8px"><label class="btn ghost" style="display:block;text-align:center;margin-bottom:8px">Выбрать аудиофайл<input type="file" id="leAudioFile" accept="audio/*" style="display:none"></label>`:''; $('leFields').innerHTML=`<input id="leF1" class="q-input" placeholder="${a[0]}" style="margin-bottom:8px">`+(a[1]?`<input id="leF2" class="q-input" placeholder="${a[1]}" style="margin-bottom:8px">`:'')+(a[2]?`<input id="leF3" class="q-input" placeholder="${a[2]}" style="margin-bottom:8px">`:'')+wordExtra; bindAudioFile('leAudioFile','leAudio'); };
    const nb=()=>{ $('leNewBox').style.display=$('leLib').value==='__new'?'':'none'; };
    // Список уже созданных тем/занятий выбранной библиотеки + «новая».
    const pg=()=>{ const id=$('leLib').value; const lib=id!=='__new'?Store.getCustomLib(id):null;
      const groups=lib?Object.entries(lib.groups):[];
      $('leGroup').innerHTML=`<option value="__newg">+ Новая тема/занятие</option>`+groups.map(([k,name])=>`<option value="${k}">${esc(name)}</option>`).join('');
      ng(); };
    const ng=()=>{ $('leGroupName').style.display=$('leGroup').value==='__newg'?'':'none'; };
    $('leType').onchange=flds; $('leLib').onchange=()=>{ nb(); pg(); delBtn(); }; $('leGroup').onchange=ng; flds(); nb(); pg(); delBtn();
    // Сохранить выбор библиотеки/занятия (после добавления слова поля очищаются, выбор остаётся).
    if(preGroup!=null && $('leGroup').querySelector('option[value="'+preGroup+'"]')){ $('leGroup').value=preGroup; ng(); }
    $('leClose').onclick=()=>$('modal').classList.remove('open');
    $('leDel').onclick=()=>{ const id=$('leLib').value; if(!id||id==='__new') return; const lib=Store.getCustomLib(id); const nm=lib?lib.name:'библиотеку';
      confirmBox('Удалить библиотеку?','«'+nm+'» и все её слова/кандзи/грамматика будут удалены безвозвратно.','Удалить',()=>{ Store.removeCustomLib(id); mergeCustom(); buildLibs(); buildSrcRows(); refreshSection(); toast('Библиотека удалена'); $('modal').classList.remove('open'); openLibEditor(); }); };
    $('leAdd').onclick=()=>{ let libId=$('leLib').value; if(libId==='__new') libId=Store.addCustomLib($('leName').value.trim()||'Моя библиотека',$('leKind').value);
      const lib=Store.getCustomLib(libId); let g, gname; const gv=$('leGroup') ? $('leGroup').value : '__newg';
      if(gv && gv!=='__newg' && lib.groups[gv]){ g=+gv; gname=lib.groups[gv]; }
      else { gname=$('leGroupName').value.trim()||'1'; g=null; for(const k in lib.groups){ if(lib.groups[k]===gname) g=+k; } if(g===null){ const ns=Object.keys(lib.groups).map(Number); g=ns.length?Math.max(...ns)+1:1; } }
      const t=$('leType').value, f1=($('leF1')||{}).value||'', f2=($('leF2')||{}).value||'', f3=($('leF3')||{}).value||'';
      const pa=(($('lePitch')||{}).value||'').trim(), a=(($('leAudio')||{}).value||'').trim();
      if(t==='words'){ if(!f2||!f3){ toast('Заполни кану и перевод'); return; } Store.addCustomItem(libId,'words',{j:f1.trim(),k:f2.trim(),r:f3.trim(),e:'',pa,a},g,gname); }
      else if(t==='kanji'){ if(!f1||!f2){ toast('Заполни кандзи и значение'); return; } Store.addCustomItem(libId,'kanji',{c:f1.trim(),m:f2.trim()},g,gname); }
      else { if(!f1||!f3){ toast('Заполни конструкцию и значение'); return; } Store.addCustomItem(libId,'grammar',{t:f1.trim(),p:f2.trim(),m:f3.trim()},g,gname); }
      mergeCustom(); buildLibs(); buildSrcRows(); refreshSection(); toast('Добавлено ✓'); openLibEditor(libId, String(g)); };
  }
  function doExportLib(lib){ Sync.downloadCsv((lib.name||'library')+'.csv', libToCsv(lib)); if(!(window.Android&&window.Android.saveFile)) toast('Файл сохранён в Загрузки'); }
  function exportLibPick(){ const libs=Store.customLibs(); if(!libs.length){ toast('Нет своих библиотек'); return; }
    if(libs.length===1){ doExportLib(libs[0]); return; }
    const o=document.createElement('div'); o.className='onboard';
    o.innerHTML=`<div class="ob-card"><div class="ob-h">Экспорт библиотеки</div>
      <div class="field"><label>Выбери библиотеку</label><select id="elSel" class="q-input">${libs.map((l,i)=>`<option value="${i}">${esc(l.name)}</option>`).join('')}</select></div>
      <div style="display:flex;gap:10px;margin-top:14px"><button class="btn" id="elNo" style="flex:1">Отмена</button><button class="btn primary" id="elYes" style="flex:1">Экспорт</button></div></div>`;
    document.body.appendChild(o); const close=()=>o.remove(); o.addEventListener('click',e=>{ if(e.target===o) close(); });
    o.querySelector('#elNo').onclick=close;
    o.querySelector('#elYes').onclick=()=>{ const i=+o.querySelector('#elSel').value; close(); doExportLib(libs[i]); };
  }
  // ---- Редактирование элемента своей библиотеки ----
  function findByUid(uid){ return D.words.find(x=>x.uid===uid)||D.kanji.find(x=>x.uid===uid)||D.grammar.find(x=>x.uid===uid); }
  function isCustomItem(it){ return !!(it&&it.clib&&it.ctype&&it.ci!=null); }
  function refreshAfterCustom(){ mergeCustom(); buildLibs(); buildSrcRows(); refreshSection(); home(); }
  function editItem(uid){
    const it=findByUid(uid); if(!isCustomItem(it)){ toast('Это элемент встроенной библиотеки'); return; }
    const type=it.ctype, lib=Store.getCustomLib(it.clib); if(!lib){ toast('Библиотека не найдена'); return; }
    const src=(lib.items[type]||[])[it.ci]; if(!src){ toast('Элемент не найден'); return; }
    const fields = type==='words'?[['j','Кандзи (опц.)',src.j],['k','Кана',src.k],['r','Перевод',src.r],['e','English (опц.)',src.e],['pa','Тон (0, 1, 2 или 0,2)',src.pa||src.pitch],['a','Аудио URL / data: / assets/...',src.a||src.audio]]
      : type==='kanji'?[['c','Кандзи',src.c],['m','Значение',src.m]]
      : [['t','Конструкция',src.t],['p','Шаблон (опц.)',src.p],['m','Значение',src.m]];
    const o=document.createElement('div'); o.className='onboard';
    o.innerHTML=`<div class="ob-card"><div class="ob-h">Редактировать (${esc(lib.name)})</div>`+
      fields.map(([k,ph,v])=>`<div class="field"><label>${esc(ph)}</label><input class="q-input" data-f="${k}" value="${attr(v||'')}">${k==='a'?'<label class="btn ghost" style="display:block;text-align:center;margin-top:8px">Выбрать аудиофайл<input type="file" id="edAudioFile" accept="audio/*" style="display:none"></label>':''}</div>`).join('')+
      `<div style="display:flex;gap:10px;margin-top:8px"><button class="btn ghost" id="edCancel" style="flex:1">Отмена</button><button class="btn primary" id="edSave" style="flex:1">Сохранить</button></div>
       <button class="btn danger" id="edDel" style="width:100%;margin-top:8px">🗑 Удалить элемент</button></div>`;
    document.body.appendChild(o); const close=()=>o.remove(); o.addEventListener('click',e=>{ if(e.target===o) close(); });
    $('modal')&&$('modal').classList.remove('open');
    const af=o.querySelector('#edAudioFile'); if(af) af.onchange=e=>{ const file=e.target.files&&e.target.files[0]; if(!file) return; const r=new FileReader(); r.onload=()=>{ const inp=o.querySelector('[data-f="a"]'); if(inp) inp.value=String(r.result||''); toast('Аудио добавлено'); }; r.readAsDataURL(file); };
    o.querySelector('#edCancel').onclick=close;
    o.querySelector('#edSave').onclick=()=>{ const obj={}; o.querySelectorAll('[data-f]').forEach(inp=>obj[inp.dataset.f]=inp.value.trim());
      const ok = type==='words'?(obj.k&&obj.r) : type==='kanji'?(obj.c&&obj.m) : (obj.t&&obj.m);
      if(!ok){ toast('Заполни обязательные поля'); return; }
      Store.updateCustomItem(it.clib,type,it.ci,obj); refreshAfterCustom(); toast('Сохранено ✓'); close(); };
    o.querySelector('#edDel').onclick=()=>{ confirmBox('Удалить элемент?','Этот элемент будет удалён из библиотеки безвозвратно.','Удалить',()=>{ Store.removeCustomItem(it.clib,type,it.ci); refreshAfterCustom(); toast('Удалено'); close(); }); };
  }
  function libToCsv(lib){ const rows=[['type','group','kanji','kana','translation','pattern','pitch','audio']];
    lib.items.words.forEach(x=>rows.push(['word',lib.groups[x.l]||x.l,x.j||'',x.k||'',x.r||'','',x.pa||x.pitch||'',x.a||x.audio||''])); lib.items.kanji.forEach(x=>rows.push(['kanji',lib.groups[x.l]||x.l,x.c||'','',x.m||'','',''])); lib.items.grammar.forEach(x=>rows.push(['grammar',lib.groups[x.l]||x.l,x.t||'','',x.m||'',x.p||'','','']));
    return rows.map(r=>r.map(c=>'"'+String(c).replace(/"/g,'""')+'"').join(',')).join('\n'); }
  function init(){
    baseKanji=D.kanji.map(k=>({...k,uid:'k'+k.id}));
    baseWords=D.vocab.map(v=>({...v,uid:'w'+v.id}));
    baseGrammar=D.grammar.map(g=>({...g,uid:'g'+g.id}));
    mergeCustom();
    if(!THEMES.some(t=>t.id===Store.settings().theme)) Store.setSetting('theme','dark');
    applyTheme(Store.settings().theme); Store.touchOpen();
    if(window.Android && window.Android.setActive) try{ window.Android.setActive(); }catch(e){}
    document.addEventListener('click',e=>{ const b=e.target.closest('[data-go]'); if(b) go(b.dataset.go); });
    window.addEventListener('popstate',()=>{
      const m=$('modal');
      if(m && m.classList.contains('open')){ const wasStats=m.dataset.stats==='1'; m.classList.remove('open'); m.dataset.stats=''; if(wasStats){ go('home',true); } return; }
      if(nav.length>1){ nav.pop(); go(nav[nav.length-1]||'home',true); } else { go('home',true); } });
    try{ history.replaceState({view:'home'},''); }catch(e){}
    const gc=document.querySelector('.greet-card'); if(gc) gc.addEventListener('dblclick',togglePhrase);
    const ca=$('cal'); if(ca) ca.addEventListener('click',weekStats);
    // Каждый блок — отдельно, чтобы сбой одного модуля не ронял весь интерфейс (главную).
    const safe=(fn)=>{ try{ fn(); }catch(e){ try{ console.error('init',e); }catch(_){} } };
    safe(Dict.init); safe(Gram.init); safe(()=>{ KList.init(); KList.setOnChange(home); }); safe(()=>Study.setOnChange(()=>{}));
    safe(buildThemes); safe(Test.init); safe(bindSettings); safe(Sync.init); safe(home); safe(flame); safe(onboard); safe(whatsNew); safe(checkUpdate);
  }
  function esc(s){ return (s||'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }
  function attr(s){ return (s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  if(document.readyState!=='loading') init(); else document.addEventListener('DOMContentLoaded',init);
  return { go, editItem };
})();
window.App = App;
