/* ============================================================
   app.js — роутинг, главная, тесты, JLPT, настройки, темы,
   библиотеки, активность, своя библиотека.
   ============================================================ */
const App = (() => {
  const D = window.GENKI_DATA;
  const $ = id=>document.getElementById(id);
  const VERSION='0.9 (beta)';
  const THEMES=[{id:'light',label:'Светлая'},{id:'dark',label:'Тёмная'},{id:'zen',label:'Дзен'},{id:'retro',label:'Ретро'},{id:'shinkai',label:'空'},{id:'yurucamp',label:'Yuru Camp'}];
  const THEME_BG={light:'#fff7f5',dark:'#0b0e1a',zen:'#10221a',retro:'#15171c',shinkai:'#0b1424',yurucamp:'#0f1f1c'};
  const PHRASES=[['お元気ですか？','Как дела?'],['今日の天気はどうですか？','Какая сегодня погода?'],['週末は何をしますか？','Что будешь делать на выходных?'],['趣味は何ですか？','Какое у тебя хобби?'],['朝ごはんを食べましたか？','Ты позавтракал?'],['今、何をしていますか？','Чем сейчас занят?'],['好きな食べ物は何ですか？','Какая любимая еда?'],['昨日は何をしましたか？','Что делал вчера?'],['どこに行きたいですか？','Куда хочешь поехать?'],['最近どうですか？','Как ты в последнее время?'],['何時に起きましたか？','Во сколько встал?'],['今日もがんばりましょう！','Постараемся и сегодня!']];
  function greeting(){ const h=new Date().getHours(); if(h<5)return'おやすみなさい'; if(h<10)return'おはようございます！'; if(h<17)return'こんにちは！'; if(h<23)return'今晩は！'; return'こんばんは！'; }
  function phrase(){ return PHRASES[Math.floor(Date.now()/(5*3600*1000))%PHRASES.length]; }
  function notifyNativeActive(){
    if(window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.sodesu &&
      typeof window.webkit.messageHandlers.sodesu.postMessage==='function'){
      try{ window.webkit.messageHandlers.sodesu.postMessage({ type: "setActive" }); return; }catch(e){}
    }
    if(window.Android && typeof window.Android.setActive==='function'){
      try{ window.Android.setActive(); }catch(e){}
    }
  }

  // ---- своя библиотека: пересборка D из базы + custom ----
  let baseKanji, baseWords, baseGrammar;
  function mergeCustom(){
    const c=Store.custom();
    D.kanji = baseKanji.concat((c.kanji||[]).map((x,i)=>({c:x.c,l:1,lib:'my',freq:0,ex:[],id:10000+i,uid:'mk'+i})));
    D.words = baseWords.concat((c.words||[]).map((x,i)=>({k:x.k,j:x.j||'',e:x.e||'',r:x.r,l:1,lib:'my',id:20000+i,uid:'mw'+i})));
    D.grammar = baseGrammar.concat((c.grammar||[]).map((x,i)=>({t:x.t,p:x.p||'',m:x.m,l:1,lib:'my',id:30000+i,uid:'mg'+i})));
  }

  let nav=['home'];
  function go(view,fromPop){
    if(!fromPop){ if(nav[nav.length-1]!==view){ nav.push(view); try{ history.pushState({view},''); }catch(e){} } }
    document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active', v.id==='view-'+view));
    document.querySelectorAll('[data-go]').forEach(b=>b.classList.toggle('active', b.dataset.go===view));
    window.scrollTo(0,0);
    if(view==='study') Study.start();
    if(view==='kanji') KList.render();
    if(view==='dict') Dict.render();
    if(view==='grammar') Gram.render();
    if(view==='home') home();
    if(view==='settings') syncSettings();
    if(view==='test'){ Test.backToSetup(); }
  }

  function metric(items){ const c=SRS.counts(items,Store); return {known:c.known, rest:c.total-c.known}; }
  let showRu=false;
  function home(){
    $('greet').textContent=greeting();
    const p=phrase(); showRu=false; const pj=$('phraseJp'); pj.textContent=p[0]; pj.dataset.jp=p[0]; pj.dataset.ru=p[1];
    const mk=metric(D.kanji),mw=metric(D.words),mg=metric(D.grammar);
    const fill=(id,m,lbl)=>$(id).innerHTML=`<div class="n">${m.known}</div><div class="l">${lbl}</div><div class="rest">осталось ${m.rest}</div>`;
    fill('mKanji',mk,'кандзи'); fill('mWords',mw,'слов'); fill('mGram',mg,'грамматик');
    $('homeDue').textContent=SRS.counts(D.kanji,Store).due+SRS.counts(D.words,Store).due+SRS.counts(D.grammar,Store).due;
    Cal.render($('cal'));
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
    $('modal').classList.add('open'); $('mClose2').onclick=()=>$('modal').classList.remove('open');
  }

  // ---- тесты строит модуль Test ----

  // ---- настройки ----
  function applyTheme(t){ document.documentElement.setAttribute('data-theme',t); const m=document.querySelector('meta[name=theme-color]'); if(m) m.content=THEME_BG[t]||'#0b0e1a'; applyYuruBg(Store.settings().yuruBg||'none'); applyIcon(t); applyUserBg(t); }
  function bgLayer(){ let L=document.getElementById('bgLayer'); if(!L){ L=document.createElement('div'); L.id='bgLayer'; document.body.prepend(L); } return L; }
  function applyUserBg(t){ const L=bgLayer(); const bg=Store.bg(t); L.style.backgroundImage = bg ? `linear-gradient(rgba(8,10,16,.5),rgba(8,10,16,.62)),url(${bg})` : ''; L.classList.toggle('contain', Store.settings().bgFit==='contain'); }
  function applyYuruBg(v){ document.documentElement.setAttribute('data-yuru', v||'none'); }
  function applyIcon(t){ const src=t==='yurucamp'?'assets/themes/yuru/icon.jpg':'assets/icon.png'; document.querySelectorAll('.topbar .logo, .sidebar .brand img').forEach(im=>{ im.onerror=()=>{ im.onerror=null; im.src='assets/icon.png'; }; im.src=src; }); }
  function buildYuru(){ const el=$('yuruRow'); if(!el) return; const hasBg=Store.settings().theme==='yurucamp'; el.style.display=hasBg?'':'none'; if(!hasBg){ el.innerHTML=''; return; } const cur=String(Store.settings().yuruBg||'1'); const opts=[['none','Без фона'],['1','Фон 1'],['2','Фон 2']]; el.innerHTML='<div class="hint-line" style="width:100%;margin:0 0 6px">Фон темы Yuru Camp</div>'+opts.map(([v,l])=>`<span class="pill${cur===v?' on':''}" data-yb="${v}">${l}</span>`).join(''); el.onclick=e=>{ const b=e.target.closest('[data-yb]'); if(!b)return; const v=b.dataset.yb; Store.setSetting('yuruBg',v); applyYuruBg(v); buildYuru(); Sound.play('tap'); }; }
  function buildThemes(){ $('themeRow').innerHTML=THEMES.map(t=>`<button class="theme-btn" data-theme="${t.id}"><span class="sw sw-${t.id}"></span>${t.label}</button>`).join('');
    $('themeRow').onclick=e=>{ const b=e.target.closest('[data-theme]'); if(!b)return; Store.setSetting('theme',b.dataset.theme); applyTheme(b.dataset.theme); syncSettings(); Sound.play('tap'); }; }
  function libLessons(id){ return [...new Set(D.words.concat(D.kanji,D.grammar).filter(x=>x.lib===id).map(x=>x.l))].sort((a,b)=>a-b); }
  function buildLibs(){
    $('libsRow').innerHTML=D.meta.libraries.map(l=>{ const on=Store.libOn(l.id); const ls=libLessons(l.id);
      let rng='';
      if(on && ls.length>1){ const r=Store.libLess(l.id)||{min:ls[0],max:ls[ls.length-1]};
        const opt=sel=>ls.map(n=>`<option value="${n}"${n===sel?' selected':''}>${LU.lessonLabel(l.id,n)}</option>`).join('');
        rng=`<div class="lib-range"><span>уроки</span><select data-lr="${l.id}" data-b="min">${opt(r.min)}</select><span>—</span><select data-lr="${l.id}" data-b="max">${opt(r.max)}</select></div>`; }
      return `<div class="lib-item"><label class="toggle"><input type="checkbox" data-lib="${l.id}" ${on?'checked':''}> ${l.name}</label>${rng}</div>`;
    }).join('');
    $('libsRow').onchange=e=>{ const c=e.target.closest('[data-lib]'); if(c){ Store.setLib(c.dataset.lib,c.checked); buildLibs(); return; }
      const lr=e.target.closest('[data-lr]'); if(lr){ const lib=lr.dataset.lr, ls=libLessons(lib); const cur=Store.libLess(lib)||{min:ls[0],max:ls[ls.length-1]}; cur[lr.dataset.b]=+lr.value; if(cur.min>cur.max){ if(lr.dataset.b==='min')cur.max=cur.min; else cur.min=cur.max; } Store.setLibLess(lib,cur); buildLibs(); } };
  }
  function syncSettings(){
    const s=Store.settings();
    document.querySelectorAll('.theme-btn').forEach(b=>b.classList.toggle('on', b.dataset.theme===s.theme));
    $('soundToggle').checked=s.sound; $('soundStd').checked=(s.soundSet==='standard');
    $('volume').value=Math.round(s.volume*100); $('volLbl').textContent=Math.round(s.volume*100)+'%';
    $('nkLbl').textContent=s.newKanji; $('nwLbl').textContent=s.newWords; $('ngLbl').textContent=s.newGrammar;
    if($('gramCommentSel')) $('gramCommentSel').value = s.grammarComment==null?'auto':(s.grammarComment?'on':'off');
    if($('bgFit')) $('bgFit').checked = s.bgFit==='contain';
    if($('studyFuriSet')) $('studyFuriSet').checked = !!s.studyFuri;
    buildLibs(); buildYuru();
    $('aboutTxt').innerHTML=`<b>そうです</b> · версия <b>${VERSION}</b><br>Кандзи, слова и грамматика по Genki I & II + материалы.<br>Разработчик: <b>Mothman</b>.`;
  }
  function bindSettings(){
    $('soundToggle').addEventListener('change',e=>{ Store.setSetting('sound',e.target.checked); if(e.target.checked) Sound.play('correct'); });
    $('soundStd').addEventListener('change',e=>{ Store.setSetting('soundSet', e.target.checked?'standard':'theme'); Sound.play('correct'); });
    $('volume').addEventListener('input',e=>{ const v=+e.target.value; $('volLbl').textContent=v+'%'; Store.setSetting('volume',v/100); });
    $('volume').addEventListener('change',()=>Sound.play('correct'));
    const ST={newKanji:{step:5,max:40,lbl:'nkLbl'},newWords:{step:5,max:40,lbl:'nwLbl'},newGrammar:{step:1,max:20,lbl:'ngLbl'}};
    document.querySelectorAll('[data-step]').forEach(b=>b.onclick=()=>{ const key=b.dataset.step,d=+b.dataset.d,c=ST[key]; let v=Math.min(c.max,Math.max(0,(Store.settings()[key]||0)+d*c.step)); Store.setSetting(key,v); $(c.lbl).textContent=v; Sound.play('tap'); });
    if($('gramCommentSel')) $('gramCommentSel').addEventListener('change',e=>{ const v=e.target.value; Store.setSetting('grammarComment', v==='auto'?null:(v==='on')); });
    if($('bgFile')) $('bgFile').addEventListener('change',e=>{ const f=e.target.files[0]; if(!f)return; const r=new FileReader(); r.onload=()=>{ Store.setBg(Store.settings().theme,r.result); applyTheme(Store.settings().theme); alert('Фон установлен для текущей темы'); }; r.readAsDataURL(f); });
    if($('bgReset')) $('bgReset').onclick=()=>{ Store.setBg(Store.settings().theme,null); applyTheme(Store.settings().theme); };
    if($('bgFit')) $('bgFit').addEventListener('change',e=>{ Store.setSetting('bgFit', e.target.checked?'contain':'cover'); applyUserBg(Store.settings().theme); document.getElementById('bgLayer')&&document.getElementById('bgLayer').classList.toggle('contain', e.target.checked); });
    if($('studyFuriSet')) $('studyFuriSet').addEventListener('change',e=>Store.setSetting('studyFuri',e.target.checked));
    $('resetBtn').addEventListener('click',()=>{ if(confirm('Сбросить весь прогресс, активность и историю?')){ Store.reset(); home(); KList.render(); syncSettings(); } });
    // своя библиотека
    const ph={words:['Кандзи (можно пусто)','Кана','Перевод'],kanji:['Кандзи (1 символ)','Значение','(не исп.)'],grammar:['Конструкция','Шаблон','Значение']};
    const setPh=()=>{ const t=$('cType').value||'words'; if(!ph[t])return; $('cF1').placeholder=ph[t][0]; $('cF2').placeholder=ph[t][1]; $('cF3').placeholder=ph[t][2]; $('cF3').style.display=t==='kanji'?'none':''; };
    $('cType').onchange=setPh; setPh();
    $('cAdd').onclick=()=>{ const t=$('cType').value, a=$('cF1').value.trim(), b=$('cF2').value.trim(), c=$('cF3').value.trim();
      if(t==='words'){ if(!b||!c){alert('Заполни кану и перевод');return;} Store.addCustom('words',{j:a,k:b,r:c,e:''}); }
      else if(t==='kanji'){ if(!a||!b){alert('Заполни кандзи и значение');return;} Store.addCustom('kanji',{c:a,ex:[],m:b}); }
      else { if(!a||!c){alert('Заполни конструкцию и значение');return;} Store.addCustom('grammar',{t:a,p:b,m:c}); }
      $('cF1').value=$('cF2').value=$('cF3').value=''; mergeCustom(); Sound.play('known'); alert('Добавлено в «Мою библиотеку»'); };
  }

  function init(){
    baseKanji=D.kanji.map(k=>({...k,uid:'k'+k.id}));
    baseWords=D.vocab.map(v=>({...v,uid:'w'+v.id}));
    baseGrammar=D.grammar.map(g=>({...g,uid:'g'+g.id}));
    mergeCustom();
    if(!THEMES.some(t=>t.id===Store.settings().theme)) Store.setSetting('theme','dark');
    applyTheme(Store.settings().theme); Store.touchOpen(); notifyNativeActive();
    document.addEventListener('click',e=>{ const b=e.target.closest('[data-go]'); if(b) go(b.dataset.go); });
    window.addEventListener('popstate',()=>{ if(nav.length>1){ nav.pop(); go(nav[nav.length-1]||'home',true); } else { go('home',true); } });
    try{ history.replaceState({view:'home'},''); }catch(e){}
    const gc=document.querySelector('.greet-card'); if(gc) gc.addEventListener('dblclick',togglePhrase);
    const ca=$('cal'); if(ca) ca.addEventListener('click',weekStats);
    Dict.init(); Gram.init(); KList.init(); KList.setOnChange(home); Study.setOnChange(()=>{});
    buildThemes(); Test.init(); bindSettings(); Sync.init(); home();
  }
  function esc(s){ return (s||'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }
  if(document.readyState!=='loading') init(); else document.addEventListener('DOMContentLoaded',init);
  return { go };
})();
window.App = App;
