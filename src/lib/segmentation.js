/**
 * Lightweight segmentation: tokens must be substrings of the source text.
 * Chinese: 2–4 character windows; optional 5–7 char clause from a single run.
 * English: words length >= 2.
 */
(function (global) {
  const CJK = /[\u3400-\u9FFF\uF900-\uFAFF]/;

  function extractChineseRuns(text) {
    const runs = [];
    let i = 0;
    while (i < text.length) {
      if (CJK.test(text[i])) {
        let j = i;
        while (j < text.length && CJK.test(text[j])) j++;
        runs.push(text.slice(i, j));
        i = j;
      } else {
        i++;
      }
    }
    return runs;
  }

  function windowsFromRun(run, minLen, maxLen) {
    const out = [];
    const n = run.length;
    for (let len = minLen; len <= maxLen && len <= n; len++) {
      for (let start = 0; start + len <= n; start++) {
        out.push(run.slice(start, start + len));
      }
    }
    return out;
  }

  function extractEnglishTokens(text) {
    const words = text.match(/[A-Za-z][A-Za-z'-]{1,}/g) || [];
    return words.map((w) => w.toLowerCase());
  }

  const CJK_ONLY = /^[\u3400-\u9FFF\uF900-\uFAFF]+$/;

  /**
   * @param {string} text
   * @param {{ chineseOnly?: boolean }} [options]
   * @returns {string[]} unique candidate tokens appearing in text
   */
  function parseInput(text, options) {
    if (!text || typeof text !== 'string') return [];
    const chineseOnly = Boolean(options && options.chineseOnly);
    const normalized = text.replace(/\s+/g, ' ').trim();
    if (normalized.length < 2) return [];

    const seen = new Set();
    const add = (t) => {
      if (!t || t.length < 2) return;
      if (chineseOnly && !CJK_ONLY.test(t)) return;
      if (seen.has(t)) return;
      if (!normalized.includes(t) && !text.includes(t)) return;
      seen.add(t);
    };

    for (const run of extractChineseRuns(text)) {
      for (const w of windowsFromRun(run, 2, 4)) add(w);
      if (run.length >= 5 && run.length <= 7) add(run);
      else if (run.length > 7) {
        for (let len = 5; len <= 7; len++) {
          for (let start = 0; start + len <= run.length; start++) {
            add(run.slice(start, start + len));
          }
        }
      }
    }

    if (!chineseOnly) {
      const lower = text.toLowerCase();
      for (const w of extractEnglishTokens(text)) {
        const idx = lower.indexOf(w.toLowerCase());
        if (idx >= 0) add(text.slice(idx, idx + w.length));
      }
    }

    return Array.from(seen);
  }

  global.EchoBirdSegmentation = { parseInput, extractChineseRuns };
})(typeof self !== 'undefined' ? self : this);
