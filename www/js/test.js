/* ============================================================
   test.js — тесты. Вариант: Слова/Кандзи/Грамматика/JLPT/Аудио/Текст(WIP).
   Мультивыбор библиотек и уроков, статус (все/новое/учу/знаю/недавно),
   режим, число вопросов, лимит времени, фуригана. История с разбором.
   ============================================================ */
const Test = (() => {
  const D = window.GENKI_DATA;
  const $ = id=>document.getElementById(id);
  const esc=s=>(s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const norm=s=>(s||'').toLowerCase().replace(/[.,!?;()]/g,' ').trim();
  const shuffle=a=>{ a=a.slice(); for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; };
  const fmt=ms=>{ const s=Math.max(0,Math.floor(ms/1000)); return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0'); };

  // настройки сетапа
  let variant='words', vLib=new Set(), vLess=new Set(), vStatus='all', vRecent=false,
      vMode='choose_ru', vCount=10, vTime=0, vFuri=false, vJlpt=5;
  // прохождение
  let pool=[], qs=[], idx=0, score=0, t0=0, timerId=null, deadline=0, answers=[], label='';

  function srcItems(){ return variant==='kanji'?D.kanji: variant==='grammar'?D.grammar : D.words; }
  function libsForVariant(){ return LU.activeLibs().filter(l=> srcItems().some(it=>it.lib===l.id)); }
  function statusOf(it){ const s=Store.status(it.uid); return (s==='learning'||s==='review')?'learning':s; }
  function kMeaning(k){ const w=(k.ex||[]).map(i=>D.vocab[i]).find(Boolean); return w?w.r:k.c; }
  const jpPlain=it=> variant==='grammar'?it.t : variant==='kanji'?it.c : (it.j||it.k);
  const ruv=it=> variant==='grammar'?it.m : variant==='kanji'?kMeaning(it) : it.r;
  const audioText=it=>it.k||it.j||'';
  const audioSrc=it=>it.a||it.audio||'';
  function jpHtml(it){ if(variant==='grammar') return esc(it.t); if(variant==='kanji') return esc(it.c);
    if(vFuri && it.j && /[一-鿿]/.test(it.j)) return `<ruby>${esc(it.j)}<rt>${esc(it.k)}</rt></ruby>`; return esc(it.j||it.k); }

  // ---------- сетап ----------
  function chip(label,on,attr,val){ return `<span class="pill${on?' on':''}" data-${attr}="${val}">${label}</span>`; }
  function buildSetup(){
    if(vLib.size===0) libsForVariant().forEach(l=>vLib.add(l.id));
    const setup=$('testSetup');
    const variants=[['words','Слова'],['kanji','Кандзи'],['grammar','Грамматика'],['audio','Аудио'],['jlpt','JLPT'],['text','Текст']];
    let html=`<div class="field"><label>Вариант теста</label><div class="chips" id="tVariant">`+
      variants.map(([v,l])=>{ const wip=v==='text'; return `<span class="pill${v===variant&&!wip?' on':''}${wip?' wip':''}" ${wip?'':`data-variant="${v}"`}>${l}${wip?' (WIP)':''}</span>`; }).join('')+`</div></div>`;
    if(variant==='jlpt'){
      html+=`<div class="field"><label>Уровень</label><div class="chips" id="tJlpt">`+[5,4,3].map(n=>chip('N'+n,vJlpt===n,'jl',n)).join('')+`</div></div>`;
      html+=countTimeRows();
      html+=`<button class="btn primary" id="testStart" style="width:100%">Начать тест</button>`;
    } else {
      html+=`<div class="field"><label>Библиотеки</label><div class="chips" id="tLibs">`+
        libsForVariant().map(l=>chip(l.name,vLib.has(l.id),'lib',l.id)).join('')+`</div></div>`;
      html+=`<div class="field"><label>Уроки / темы (можно несколько; пусто = все)</label><div class="chips" id="tLess">`+lessChips()+`</div></div>`;
      html+=`<div class="field"><label>Что включать</label><div class="chips" id="tStatus">`+
        [['all','Все'],['new','Новое'],['learning','Учу'],['known','Знаю'],['recent','Недавно изученные']]
        .map(([v,l])=>chip(l,(vRecent?v==='recent':vStatus===v&&!vRecent),'st',v)).join('')+`</div></div>`;
      const typeOption=variant==='audio'?'':`<option value="type"${vMode==='type'?' selected':''}>Напечатать ответ</option>`;
      html+=`<div class="field"><label>Режим</label><select id="tMode">
        <option value="choose_ru"${vMode==='choose_ru'||vMode==='type'&&variant==='audio'?' selected':''}>Выбрать перевод (рус)</option>
        <option value="choose_jp"${vMode==='choose_jp'?' selected':''}>Выбрать кандзи/слово</option>
        ${typeOption}</select></div>`;
      if(variant!=='audio') html+=`<label class="toggle"><input type="checkbox" id="tFuri" ${vFuri?'checked':''}> Фуригана (над кандзи)</label>`;
      html+=countTimeRows();
      html+=`<button class="btn primary" id="testStart" style="width:100%">Начать тест</button>`;
    }
    setup.innerHTML=html; setup.style.display='';
    $('testArea').innerHTML=''; bindSetup();
  }
  function lessChips(){
    // Ключ chips — составной «lib|l», чтобы уроки и темы разных библиотек не путались.
    let out='';
    [...vLib].forEach(lib=>{ const ls=[...new Set(srcItems().filter(it=>it.lib===lib).map(it=>it.l))].sort((a,b)=>a-b);
      out+=ls.map(l=>chip(LU.lessonLabel(lib,l), vLess.has(lib+'|'+l), 'less', lib+'|'+l)).join(''); });
    return out||'<span class="hint-line">нет уроков/тем</span>';
  }
  function countTimeRows(){
    return `<div class="field"><label>Число вопросов</label><select id="tCount">`+
      [5,10,15,20,30].map(n=>`<option${n===vCount?' selected':''}>${n}</option>`).join('')+`</select></div>`+
      `<div class="field"><label>Лимит времени</label><select id="tTime">`+
      [[0,'Без лимита'],[60,'1 мин'],[180,'3 мин'],[300,'5 мин'],[600,'10 мин']].map(([v,l])=>`<option value="${v}"${v===vTime?' selected':''}>${l}</option>`).join('')+`</select></div>`;
  }
  function bindSetup(){
    const v=$('tVariant'); if(v) v.onclick=e=>{ const p=e.target.closest('[data-variant]'); if(!p)return; variant=p.dataset.variant; vLib.clear(); vLess.clear(); buildSetup(); };
    const jl=$('tJlpt'); if(jl) jl.onclick=e=>{ const p=e.target.closest('[data-jl]'); if(!p)return; vJlpt=+p.dataset.jl; buildSetup(); };
    const lb=$('tLibs'); if(lb) lb.onclick=e=>{ const p=e.target.closest('[data-lib]'); if(!p)return; const id=p.dataset.lib; if(vLib.has(id))vLib.delete(id); else vLib.add(id); vLess.clear(); buildSetup(); };
    const le=$('tLess'); if(le) le.onclick=e=>{ const p=e.target.closest('[data-less]'); if(!p)return; const k=p.dataset.less; if(vLess.has(k))vLess.delete(k); else vLess.add(k); buildSetup(); };
    const st=$('tStatus'); if(st) st.onclick=e=>{ const p=e.target.closest('[data-st]'); if(!p)return; const s=p.dataset.st; if(s==='recent'){vRecent=true;} else {vRecent=false; vStatus=s;} buildSetup(); };
    if($('tMode')) $('tMode').onchange=e=>vMode=e.target.value;
    if($('tFuri')) $('tFuri').onchange=e=>vFuri=e.target.checked;
    if($('tCount')) $('tCount').onchange=e=>vCount=+e.target.value;
    if($('tTime')) $('tTime').onchange=e=>vTime=+e.target.value;
    $('testStart').onclick=start;
    renderHistory();
  }

  // ---------- запуск ----------
  function buildPool(){
    let list=srcItems().filter(it=>vLib.has(it.lib));
    if(vLess.size) list=list.filter(it=>vLess.has(it.lib+'|'+it.l));
    if(vRecent){ list=list.filter(it=>Store.status(it.uid)==='known').sort((a,b)=>((Store.get(b.uid)||{}).kt||0)-((Store.get(a.uid)||{}).kt||0)).slice(0,50); }
    else if(vStatus!=='all') list=list.filter(it=>statusOf(it)===vStatus);
    return list;
  }
  // Дистракторы: сперва из того же занятия/темы и библиотеки, затем добор из общего пула.
  function distractors(it){ let p=pool.filter(x=>x!==it && x.lib===it.lib && x.l===it.l); if(p.length<3){ const more=pool.filter(x=>x!==it && !(x.lib===it.lib&&x.l===it.l)); p=p.concat(shuffle(more).slice(0,3-p.length)); } return shuffle(p).slice(0,3); }
  function makeQuestions(list,count){
    const items=shuffle(list).slice(0,count);
    return items.map(it=>{ let prompt,correctKey,options;
      if(variant==='audio'){
        prompt=`<div class="audio-prompt">${WordAudio.button(audioText(it),'Прослушать',audioSrc(it))}</div>`;
        if(vMode==='choose_jp'){ correctKey=jpPlain(it); options=shuffle([it,...distractors(it)]).map(x=>({key:jpPlain(x),html:jpHtml(x)})); }
        else { correctKey=ruv(it); options=shuffle([it,...distractors(it)]).map(x=>({key:ruv(x),html:esc(ruv(x))})); }
      }
      else if(vMode==='choose_jp'){ prompt=esc(ruv(it)); correctKey=jpPlain(it); options=shuffle([it,...distractors(it)]).map(x=>({key:jpPlain(x),html:jpHtml(x)})); }
      else { prompt=jpHtml(it); correctKey=ruv(it); options=shuffle([it,...distractors(it)]).map(x=>({key:ruv(x),html:esc(ruv(x))})); }
      return { it, prompt, correctKey, options }; });
  }
  function start(){
    if(variant==='jlpt'){ JLPT.start(vJlpt, vTime); return; }
    vFuri=$('tFuri')?$('tFuri').checked:vFuri; vMode=$('tMode')?$('tMode').value:vMode; if(variant==='audio'&&vMode==='type') vMode='choose_ru'; vCount=$('tCount')?+$('tCount').value:vCount; vTime=$('tTime')?+$('tTime').value:vTime;
    pool=buildPool();
    const vn={words:'Слова',kanji:'Кандзи',grammar:'Грамматика',audio:'Аудио'}[variant];
    label=vn+(vRecent?' · недавние':'')+(vLess.size?' · разделов: '+vLess.size:'');
    if(pool.length<4){ $('testSetup').style.display='none'; $('testArea').innerHTML=card(`<div class="empty">Недостаточно карточек для теста (нужно ≥4). <button class="btn" id="bk">Назад</button></div>`); $('bk').onclick=backToSetup; return; }
    qs=makeQuestions(pool,Math.min(vCount,pool.length)); idx=0; score=0; answers=[];
    $('testSetup').style.display='none'; $('testHistory').style.display='none';
    t0=Date.now(); deadline=vTime?Date.now()+vTime*1000:0; startTimer(); renderQ();
  }
  function card(i){ return `<div class="card test-card">${i}</div>`; }
  function startTimer(){ stopTimer(); timerId=setInterval(()=>{ const e=$('testTimer'); if(e){ if(deadline){ const left=deadline-Date.now(); e.textContent='⏱ '+fmt(left); if(left<=0){ finish(true); } } else e.textContent='⏱ '+fmt(Date.now()-t0); } },300); }
  function stopTimer(){ if(timerId){ clearInterval(timerId); timerId=null; } }
  function renderQ(){
    if(idx>=qs.length) return finish();
    const q=qs[idx];
    const head=`<div class="test-head"><span>${idx+1}/${qs.length}</span><span id="testTimer">⏱ 00:00</span><span>✓ ${score}</span></div>
      <div class="progress" style="margin:6px 0 18px"><i style="width:${100*idx/qs.length}%"></i></div>`;
    let body;
    if(vMode==='type') body=`<div class="q-prompt">${q.prompt}</div><input id="typeAns" class="q-input" type="text" autocomplete="off" placeholder="Ответ (рус)…"><button class="btn primary" id="typeSubmit" style="width:100%;margin-top:12px">Проверить</button><div id="qFb"></div>`;
    else body=`<div class="q-prompt">${q.prompt}</div><div class="q-opts">${q.options.map(o=>`<button class="q-opt" data-o="${esc(o.key)}">${o.html}</button>`).join('')}</div><div id="qFb"></div>`;
    $('testArea').innerHTML=head+card(body);
    if(variant==='audio') setTimeout(()=>WordAudio.speak(audioText(q.it), audioSrc(q.it)),120);
    if(vMode==='type'){ const inp=$('typeAns'); inp.focus(); const go=()=>checkType(inp.value,q); $('typeSubmit').onclick=go; inp.addEventListener('keydown',e=>{ if(e.key==='Enter') go(); }); }
    else $('testArea').querySelector('.q-opts').onclick=e=>{ const b=e.target.closest('[data-o]'); if(b) choose(b.dataset.o,q,b); };
  }
  function logAns(q,given,ok){ answers.push({p:(variant==='grammar'?q.it.t:(q.it.j||q.it.k||q.it.c)), correct:q.correctKey, given, ok}); }
  function choose(ans,q,btn){ const ok=ans===q.correctKey; grade(ok); logAns(q,ans,ok);
    $('testArea').querySelectorAll('.q-opt').forEach(b=>{ b.disabled=true; if(b.dataset.o===q.correctKey) b.classList.add('ok'); else if(b===btn) b.classList.add('no'); }); advance(); }
  function checkType(val,q){ const a=norm(val); const cands=[ruv(q.it),variant==='words'?q.it.e:''].join('/').split(/[\/,;]/).map(norm).filter(Boolean);
    const ok=a.length>0&&cands.some(c=>c===a||c.includes(a)||a.includes(c)); grade(ok); logAns(q,val,ok);
    $('qFb').innerHTML=`<div class="q-fb ${ok?'ok':'no'}">${ok?'✓ Верно':'✗ '+esc(ruv(q.it))}</div>`; $('typeSubmit').disabled=true; $('typeAns').disabled=true; advance(); }
  function grade(ok){ if(ok){ score++; Sound.play('correct'); } else Sound.play('wrong'); Store.logActivity(1); }
  function advance(){ idx++; setTimeout(()=>{ if(timerId||idx<=qs.length) renderQ(); },650); }
  function finish(timeout){ stopTimer(); if(answers._done) return; answers._done=true;
    const total=qs.length, sec=Math.round((Date.now()-t0)/1000); const pct=total?Math.round(100*score/total):0;
    Store.addHistory({ts:Date.now(),source:label,mode:vMode,score,total,sec,answers:answers.slice()});
    $('testArea').innerHTML=card(`<div class="empty"><div class="big">${pct>=80?'🎉':pct>=50?'👍':'📘'}</div>
      <b>${score} / ${total}</b><div style="margin:8px 0 4px">${pct}%${timeout?' · время вышло':''} · ⏱ ${fmt(sec*1000)}</div>
      <button class="btn primary" id="testAgain" style="margin-top:12px">Новый тест</button>
      <button class="btn ghost" id="testHist" style="margin-top:8px;width:100%">📜 История</button></div>`);
    Sound.play('done'); answers._done=false; answers=[];
    $('testAgain').onclick=backToSetup; $('testHist').onclick=openHistory;
  }
  function backToSetup(){ stopTimer(); $('testHistory').style.display=''; buildSetup(); }

  // ---------- история ----------
  function renderHistory(){
    const box=$('testHistory'); if(!box) return; const h=Store.history();
    box.innerHTML=`<button class="btn ghost" id="histBtn" style="width:100%">📜 История тестов (${h.length})</button>`;
    $('histBtn').onclick=openHistory;
  }
  function openHistory(){
    const h=Store.history();
    const rows=h.length? h.slice(0,40).map((r,i)=>{ const d=new Date(r.ts); const dt=`${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; const pct=Math.round(100*r.score/r.total);
      return `<div class="entry card" data-h="${i}"><div class="mean"><div class="ru ru-main">${esc(r.source)}</div><div class="en en-sub">${dt} · ⏱ ${fmt((r.sec||0)*1000)}</div></div>
        <div class="lz"><b style="color:${pct>=70?'var(--green)':pct>=40?'var(--amber)':'var(--red)'}">${r.score}/${r.total}</b><br>${pct}%${r.answers?'<br><span class="kbadge" style="background:var(--accent)">разбор</span>':''}</div></div>`; }).join('') : '<p class="hint-line">Пока нет пройденных тестов.</p>';
    $('sheet').innerHTML=`<div class="grip"></div><div class="block-title" style="margin-top:0">История тестов</div>${rows}
      <div class="actions" style="grid-template-columns:1fr"><button class="btn ghost" id="hClose">Закрыть</button></div>`;
    $('modal').classList.add('open'); $('hClose').onclick=()=>$('modal').classList.remove('open');
    $('sheet').querySelectorAll('[data-h]').forEach(el=>el.onclick=()=>{ const r=h[+el.dataset.h]; if(r&&r.answers) openReview(r); });
  }
  function openReview(r){
    const list=r.answers.map(a=>`<div class="ex"><span class="w" style="min-width:auto;font-size:16px">${esc(a.p)}</span>
      <span class="mn" style="margin-left:auto">${a.ok?'<span style="color:var(--green)">✓ '+esc(a.given)+'</span>':'<span style="color:var(--red)">✗ '+esc(a.given||'—')+'</span><br><span style="color:var(--muted2)">→ '+esc(a.correct)+'</span>'}</span></div>`).join('');
    $('sheet').innerHTML=`<div class="grip"></div><div class="block-title" style="margin-top:0">${esc(r.source)} · ${r.score}/${r.total}</div>${list}
      <div class="actions"><button class="btn" id="rBack">← К истории</button><button class="btn ghost" id="rClose">Закрыть</button></div>`;
    $('rBack').onclick=openHistory; $('rClose').onclick=()=>$('modal').classList.remove('open');
  }
  function init(){ buildSetup(); }
  return { init, backToSetup, renderHistory };
})();
