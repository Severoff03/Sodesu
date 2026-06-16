/* ============================================================
   sound.js — звуковые эффекты (WebAudio). Громкость, наборы:
   стандарт / по теме (zen, retro и аниме-темы — свои).
   ============================================================ */
const Sound = (() => {
  let ctx=null;
  function ac(){ if(!ctx){ try{ ctx=new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} } return ctx; }
  function tone(freq,dur,type,gain,delay){
    const c=ac(); if(!c) return;
    const vol=(Store.settings().volume!=null?Store.settings().volume:0.6);
    const t=c.currentTime+(delay||0);
    const o=c.createOscillator(), g=c.createGain();
    o.type=type||'sine'; o.frequency.value=freq;
    g.gain.setValueAtTime(0,t);
    g.gain.linearRampToValueAtTime((gain||0.06)*vol,t+0.01);
    g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t+dur+0.02);
  }
  const seq=(arr,type,gain,dur,step)=>arr.forEach((f,i)=>tone(f,dur,type,gain,i*step));
  const sets = {
    normal:{ tap:()=>tone(520,0.08,'triangle',0.04), flip:()=>tone(440,0.09,'triangle',0.05),
      known:()=>{tone(660,0.10,'sine',0.06);tone(990,0.12,'sine',0.05,0.06);}, add:()=>tone(420,0.10,'sine',0.05),
      correct:()=>{tone(660,0.10,'sine',0.06);tone(880,0.12,'sine',0.06,0.07);}, wrong:()=>tone(200,0.18,'sawtooth',0.05),
      done:()=>seq([523,659,784,1046],'sine',0.05,0.16,0.09) },
    zen:{ tap:()=>tone(396,0.5,'sine',0.035), flip:()=>tone(440,0.6,'sine',0.04),
      known:()=>{tone(528,0.8,'sine',0.045);tone(792,1.0,'sine',0.03,0.12);}, add:()=>tone(352,0.7,'sine',0.04),
      correct:()=>{tone(528,0.7,'sine',0.045);tone(660,0.9,'sine',0.035,0.14);}, wrong:()=>tone(264,0.7,'sine',0.035),
      done:()=>seq([396,440,528,660,792],'sine',0.04,0.9,0.16) },
    retro:{ tap:()=>tone(330,0.06,'square',0.035), flip:()=>tone(440,0.07,'square',0.04),
      known:()=>seq([523,784,1046],'square',0.04,0.09,0.07), add:()=>seq([392,330],'square',0.035,0.08,0.06),
      correct:()=>seq([659,988],'square',0.04,0.08,0.07), wrong:()=>seq([196,147],'square',0.05,0.15,0.1),
      done:()=>seq([392,523,659,784,1046],'square',0.04,0.10,0.08) },
    // Синкай — воздушные нежные колокольчики
    shinkai:{ tap:()=>tone(660,0.18,'sine',0.04), flip:()=>tone(720,0.24,'sine',0.045),
      known:()=>seq([784,1175],'sine',0.045,0.4,0.1), add:()=>tone(587,0.3,'sine',0.04),
      correct:()=>seq([784,1046],'sine',0.045,0.35,0.12), wrong:()=>tone(330,0.4,'sine',0.04),
      done:()=>seq([659,784,988,1318],'sine',0.045,0.5,0.13) },
    // 5 невест — милые яркие колокольчики
    gotoubun:{ tap:()=>tone(880,0.10,'triangle',0.04), flip:()=>tone(988,0.12,'triangle',0.045),
      known:()=>seq([1046,1318],'triangle',0.045,0.18,0.07), add:()=>tone(660,0.12,'triangle',0.04),
      correct:()=>seq([1046,1568],'triangle',0.045,0.16,0.08), wrong:()=>tone(392,0.2,'triangle',0.04),
      done:()=>seq([1046,1318,1568,2093],'triangle',0.04,0.18,0.09) },
    // Yuru Camp — тёплая маримба
    yurucamp:{ tap:()=>tone(440,0.14,'sine',0.05), flip:()=>tone(392,0.16,'sine',0.05),
      known:()=>seq([523,659],'sine',0.05,0.22,0.09), add:()=>tone(349,0.16,'sine',0.045),
      correct:()=>seq([523,784],'sine',0.05,0.2,0.1), wrong:()=>tone(196,0.3,'sine',0.04),
      done:()=>seq([392,523,659,784],'sine',0.05,0.22,0.11) },
    // Steins;Gate — ретро-электронные сигналы
    steinsgate:{ tap:()=>tone(440,0.06,'square',0.03), flip:()=>tone(520,0.07,'square',0.035),
      known:()=>seq([660,880],'square',0.035,0.08,0.07), add:()=>tone(392,0.08,'square',0.03),
      correct:()=>seq([784,1046],'square',0.035,0.08,0.07), wrong:()=>seq([160,120],'square',0.045,0.16,0.1),
      done:()=>seq([523,392,659,784],'square',0.035,0.10,0.09) },
  };
  function play(name){
    const s=Store.settings(); if(!s.sound) return;
    let set=sets.normal;
    if(s.soundSet!=='standard' && sets[s.theme]) set=sets[s.theme];
    (set[name]||(()=>{}))();
  }
  return { play };
})();
