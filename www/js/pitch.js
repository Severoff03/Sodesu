const Pitch = (() => {
  const data = () => window.PITCH_DATA || {};
  const small = new Set('ゃゅょぁぃぅぇぉャュョァィゥェォゎヮ');
  const esc = s => LU.esc(s || '');
  function hira(s){
    return (s || '').replace(/[\u30a1-\u30f6]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60));
  }
  function morae(kana){
    const out = [];
    for(const ch of (kana || '')){
      if(small.has(ch) && out.length) out[out.length - 1] += ch;
      else out.push(ch);
    }
    return out;
  }
  function parseCustom(value){
    if(value == null || value === '') return [];
    if(Array.isArray(value)) return value.map(Number).filter(n => !Number.isNaN(n));
    return String(value).split(/[,\s;/]+/).map(x => Number(x.trim())).filter(n => !Number.isNaN(n));
  }
  function variants(word, kana, custom){
    const manual = parseCustom(custom);
    if(manual.length) return manual;
    const d = data();
    const keys = [
      `${word || ''}|${kana || ''}`,
      `${word || ''}|${hira(kana || '')}`,
      `${kana || ''}|${kana || ''}`,
      `${hira(kana || '')}|${hira(kana || '')}`,
      kana || '',
      hira(kana || '')
    ].filter(Boolean);
    for(const k of keys){
      if(d[k]) return Array.isArray(d[k]) ? d[k] : [d[k]];
    }
    return [];
  }
  function pattern(len, accent){
    accent = Number(accent) || 0;
    return Array.from({length:len}, (_, i) => {
      const n = i + 1;
      return accent === 0 ? n > 1 : (accent === 1 ? n === 1 : n > 1 && n <= accent);
    });
  }
  function render(kana, word, custom){
    kana = kana || word || '';
    if(window.Store && Store.settings && Store.settings().pitchAccent === false) return `<span class="pitch plain">${esc(kana)}</span>`;
    const ms = morae(kana);
    const vars = variants(word, kana, custom);
    if(!ms.length) return '';
    if(!vars.length) return `<span class="pitch plain">${esc(kana)}</span>`;
    const accent = Number(vars[0]) || 0;
    const highs = pattern(ms.length, accent);
    const body = ms.map((m, i) => {
      return `<span class="mora ${highs[i] ? 'hi' : 'lo'}">${esc(m)}</span>`;
    }).join('');
    const more = vars.length > 1 ? `<span class="pitch-var">+${vars.length - 1}</span>` : '';
    return `<span class="pitch" title="Pitch accent: ${esc(String(vars.join(', ')))}">${body}${more}</span>`;
  }
  return { render, variants };
})();
