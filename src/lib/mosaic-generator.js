/**
 * v2 reply: 啾啾前缀 + 已掌握词条，总字数（不计空格）≤10。
 */
(function (global) {
  const STYLES = ['philosophy', 'funny', 'abstract'];

  function charCountNoSpace(s) {
    return s.replace(/\s/g, '').length;
  }

  function weightedPick(pool, count, style) {
    const copy = pool.slice();
    const out = [];
    const weight = (tok) => {
      const L = charCountNoSpace(tok);
      if (style === 'philosophy') return L >= 3 ? 1.4 : 1;
      if (style === 'funny') return L <= 2 ? 1.5 : 1;
      return 1 + Math.random() * 0.3;
    };
    const n = Math.min(count, copy.length);
    while (out.length < n && copy.length) {
      let sum = 0;
      const w = copy.map((t) => {
        const x = weight(t);
        sum += x;
        return x;
      });
      let r = Math.random() * sum;
      let idx = 0;
      for (let i = 0; i < copy.length; i++) {
        r -= w[i];
        if (r <= 0) {
          idx = i;
          break;
        }
      }
      out.push(copy.splice(idx, 1)[0]);
    }
    return out;
  }

  /**
   * @param {string[]} masteredTexts count>=2 only
   * @param {string} style philosophy|funny|abstract
   */
  function generateChuchuReply(masteredTexts, style) {
    const chirps = ['啾', '啾啾', '啾啾啾'];
    let line = chirps[Math.floor(Math.random() * chirps.length)];
    const pool = (masteredTexts || []).filter(Boolean);
    const st = STYLES.includes(style) ? style : 'philosophy';

    if (!pool.length) return line;

    const maxExtra = 3;
    const pickN = 1 + Math.floor(Math.random() * maxExtra);
    const candidates = weightedPick(pool, Math.min(pickN, pool.length), st);

    for (const tok of candidates) {
      const next = `${line} ${tok}`;
      if (charCountNoSpace(next) <= 10) line = next;
      else break;
    }
    return line;
  }

  global.EchoBirdMosaic = {
    generateChuchuReply,
    charCountNoSpace,
  };
})(typeof self !== 'undefined' ? self : this);
