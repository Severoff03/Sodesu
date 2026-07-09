const WordAudio = (() => {
  const attr = s => (s || '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let currentAudio = null;
  let voicesLoaded = false;
  const canWebSpeech = () => 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  function pickVoice(){
    if(!canWebSpeech()) return null;
    const voices = window.speechSynthesis.getVoices ? window.speechSynthesis.getVoices() : [];
    voicesLoaded = voicesLoaded || voices.length > 0;
    return voices.find(v => /^ja[-_]?JP$/i.test(v.lang)) || voices.find(v => /^ja/i.test(v.lang)) || null;
  }
  function unavailable(){
    if(window.toast) toast('Озвучка недоступна');
  }
  function playAudio(src){
    src = (src || '').trim();
    if(!src) return false;
    try{
      if(currentAudio) currentAudio.pause();
      currentAudio = new Audio(src);
      currentAudio.play().catch(() => unavailable());
      return true;
    }catch(e){ return false; }
  }
  function speak(text, audio){
    if(playAudio(audio)) return true;
    text = (text || '').trim();
    if(!text){ unavailable(); return false; }
    if(canWebSpeech()){
      try{
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'ja-JP';
        u.rate = 0.9;
        u.pitch = 1;
        const voice = pickVoice();
        if(voice) u.voice = voice;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(u);
        return true;
      }catch(e){}
    }
    if(window.Android && typeof Android.speakJa === 'function'){
      try{ Android.speakJa(text); return true; }catch(e){}
    }
    unavailable();
    return false;
  }
  function button(text, label, audio){
    return `<button class="speak-btn" type="button" data-speak="${attr(text || '')}" data-audio="${attr(audio || '')}" aria-label="${attr(label || 'Прослушать')}">▶</button>`;
  }
  function init(){
    if(canWebSpeech()){
      pickVoice();
      if(!voicesLoaded && 'onvoiceschanged' in window.speechSynthesis){
        window.speechSynthesis.onvoiceschanged = pickVoice;
      }
    }
    document.addEventListener('click', e => {
      const b = e.target.closest('[data-speak]');
      if(!b) return;
      e.preventDefault();
      e.stopPropagation();
      speak(b.dataset.speak, b.dataset.audio);
    }, true);
  }
  return { speak, button, init };
})();
WordAudio.init();
