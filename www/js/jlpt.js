/* ============================================================
   jlpt.js — ИЗОЛИРОВАННЫЙ модуль пробника JLPT (N5/N4/N3).
   Свой банк ОРИГИНАЛЬНЫХ вопросов (не связан с базой Genki).
   Меняется независимо: трогает только #jlptArea, Store.addHistory,
   Sound. Чтобы добавить уровень — допиши в BANK.
   ============================================================ */
const JLPT = (() => {
  // q: вопрос (можно ___), o: 4 варианта, a: индекс правильного
  const BANK = {
    5: [
      {q:'これは だれの かばん です＿＿。', o:['か','を','が','に'], a:0},
      {q:'わたしは まいあさ コーヒーを ＿＿。', o:['のみます','たべます','みます','ききます'], a:0},
      {q:'きのう えいがを ＿＿。', o:['みました','みます','みません','みて'], a:0},
      {q:'「ありがとう」 на русском —', o:['спасибо','извините','пожалуйста','здравствуйте'], a:0},
      {q:'やま (山) читается как', o:['やま','かわ','うみ','そら'], a:0},
      {q:'へやに ねこ＿＿ います。', o:['が','を','は','で'], a:0},
      {q:'この りんごは ＿＿ですか。いくらですか。', o:['いくら','どこ','だれ','いつ'], a:0},
      {q:'がっこう＿＿ いきます。', o:['へ','を','が','の'], a:0},
      {q:'「おおきい」 значит', o:['большой','маленький','новый','старый'], a:0},
      {q:'まいにち にほんご＿＿ べんきょうします。', o:['を','が','へ','と'], a:0},
      {q:'すみません、トイレは ＿＿ですか。', o:['どこ','だれ','いつ','なに'], a:0},
      {q:'七 (なな) — это число', o:['7','3','9','4'], a:0},
      {q:'ともだち＿＿ えいがを みました。', o:['と','を','が','の'], a:0},
      {q:'「たかい」 (о цене) значит', o:['дорогой','дешёвый','длинный','короткий'], a:0},
      {q:'あした がっこうに いき＿＿。 (отрицание, вежл.)', o:['ません','ます','ました','まして'], a:0},
    ],
    4: [
      {q:'あめが ふって いる＿＿、でかけません。', o:['から','のに','ても','まで'], a:0},
      {q:'にほんごが はなせる＿＿ なりました。', o:['ように','ことに','そうに','ために'], a:0},
      {q:'もう しゅくだいを ＿＿しまいました。', o:['やって','やった','やる','やり'], a:0},
      {q:'せんせいに ほめ＿＿。 (пассив: меня похвалили)', o:['られました','させました','ました','ています'], a:0},
      {q:'「べんり」 значит', o:['удобный','опасный','тихий','свободный'], a:0},
      {q:'ともだちに ほんを かして＿＿。 (мне одолжили)', o:['もらいました','あげました','くれました','いました'], a:0},
      {q:'たべ＿＿すぎて、おなかが いたい。', o:['','て','た','る'], a:0},
      {q:'やすみの ひは いえで ゆっくり ＿＿。', o:['したい','しろ','すれ','せず'], a:0},
      {q:'この みちを まっすぐ いく＿＿、えきが あります。', o:['と','ば','たら','なら'], a:1},
      {q:'「きけん」 значит', o:['опасность','тишина','свобода','удобство'], a:0},
      {q:'かれは いま でんわ＿＿ はなして います。', o:['で','を','に','へ'], a:0},
      {q:'あした あめが ふる＿＿。 (наверное)', o:['でしょう','ました','ましょう','ません'], a:0},
      {q:'にほんに いった こと＿＿ あります。', o:['が','を','は','に'], a:0},
      {q:'むずかしい けど、やって ＿＿。 (попробую)', o:['みます','おきます','しまいます','あげます'], a:0},
      {q:'「いそがしい」 значит', o:['занятой','скучный','весёлый','грустный'], a:0},
    ],
    3: [
      {q:'けっか＿＿、けいかくは うまく いった。', o:['として','について','にとって','によって'], a:3},
      {q:'かれは いそがしい＿＿、てつだって くれた。', o:['にもかかわらず','によって','において','について'], a:0},
      {q:'この ほんは こどもむけに かかれて いる＿＿。', o:['ようだ','そうだ','らしい','みたい'], a:2},
      {q:'しゃちょうに かわって、わたしが せつめい ＿＿。', o:['いたします','まいります','うかがいます','くださいます'], a:0},
      {q:'「あいまい」 значит', o:['неясный','точный','быстрый','тяжёлый'], a:0},
      {q:'どりょくした＿＿、ごうかくできた。', o:['かいが あって','わけで','だけに','ものの'], a:0},
      {q:'かのじょは こない ＿＿。れんらくが あった。', o:['とのことだ','わけがない','どころか','ばかりだ'], a:0},
      {q:'けいけんを いかして、あたらしい しごとに ＿＿。', o:['つく','つける','つく','たてる'], a:0},
      {q:'「めんどう」 значит', o:['хлопотный','приятный','дешёвый','редкий'], a:0},
      {q:'やまだ＿＿ ひとが あなたを たずねて きました。', o:['という','といって','とは','とか'], a:0},
      {q:'よく かんがえた ＿＿で、へんじを します。', o:['うえ','まえ','あと','とき'], a:0},
      {q:'かれの はなしは うそ＿＿ ちがいない。', o:['に','と','で','が'], a:0},
      {q:'「そうとう」 (副) значит', o:['довольно, изрядно','совсем нет','внезапно','напротив'], a:0},
      {q:'いそがしくて、ねる じかん＿＿ ない。', o:['さえ','しか','こそ','まで'], a:0},
      {q:'天気に ＿＿、しあいは ちゅうしに なる かも。', o:['よっては','ついては','たいしては','かんしては'], a:0},
    ],
  };

  let level=5, qs=[], idx=0, score=0, t0=0, timerId=null, deadline=0;
  const $=id=>document.getElementById(id);
  const esc=s=>(s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const shuffle=a=>{ a=a.slice(); for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; };
  const fmt=ms=>{ const s=Math.floor(ms/1000); return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0'); };

  function start(lvl,timeSec){
    level=lvl; qs=shuffle(BANK[lvl]); idx=0; score=0;
    if(window.App) App.go('jlpt');
    t0=Date.now(); deadline=timeSec?Date.now()+timeSec*1000:0; clearInterval(timerId);
    timerId=setInterval(()=>{ const e=$('jlptTimer'); if(e){ if(deadline){ const left=deadline-Date.now(); e.textContent='⏱ '+fmt(left); if(left<=0) finish(); } else e.textContent='⏱ '+fmt(Date.now()-t0); } },300);
    renderQ();
  }
  function renderQ(){
    if(idx>=qs.length) return finish();
    const q=qs[idx];
    // перемешиваем варианты, запоминая правильный текст
    const correct=q.o[q.a];
    const opts=shuffle(q.o);
    $('jlptArea').innerHTML=`
      <div class="test-head"><span>N${level} · ${idx+1}/${qs.length}</span><span id="jlptTimer">⏱ 00:00</span><span>✓ ${score}</span></div>
      <div class="progress" style="margin:6px 0 18px"><i style="width:${100*idx/qs.length}%"></i></div>
      <div class="card test-card">
        <div class="q-prompt" style="font-size:24px">${esc(q.q)}</div>
        <div class="q-opts">${opts.map(o=>`<button class="q-opt" data-o="${esc(o)}">${esc(o)}</button>`).join('')}</div>
      </div>`;
    $('jlptArea').querySelector('.q-opts').onclick=e=>{ const b=e.target.closest('[data-o]'); if(!b) return;
      const ok=b.dataset.o===correct; if(ok) score++; Sound.play(ok?'correct':'wrong');
      $('jlptArea').querySelectorAll('.q-opt').forEach(x=>{ x.disabled=true; if(x.dataset.o===correct) x.classList.add('ok'); else if(x===b) x.classList.add('no'); });
      idx++; setTimeout(renderQ,800);
    };
  }
  function finish(){
    clearInterval(timerId);
    const pct=Math.round(100*score/qs.length); const sec=Math.round((Date.now()-t0)/1000);
    Store.addHistory({ts:Date.now(), source:'JLPT N'+level, mode:'пробник', score, total:qs.length, sec});
    Sound.play('done');
    $('jlptArea').innerHTML=`<div class="card empty"><div class="big">${pct>=60?'🎉':'📘'}</div>
      <b>N${level}: ${score} / ${qs.length}</b><div style="margin:8px 0 4px">${pct}% · ⏱ ${fmt(sec*1000)}</div>
      <div style="font-size:12px;color:var(--muted2);margin-bottom:14px">проходной ориентир ~60%</div>
      <button class="btn primary" id="jlptAgain">Ещё раз</button></div>`;
    $('jlptAgain').onclick=()=>start(level);
  }
  return { start };
})();
window.JLPT = JLPT;
