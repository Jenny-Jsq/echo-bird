importScripts(
  '../lib/segmentation.js',
  '../lib/mosaic-generator.js',
  '../lib/corpus-manager.js',
  '../lib/llm-client.js'
);

const STORAGE_KEYS = {
  style: 'echoBirdStyle',
  walkMode: 'echoBirdWalkMode',
  apiKey: 'echoBirdApiKey',
  baseUrl: 'echoBirdBaseUrl',
  model: 'echoBirdModel',
  corner: 'echoBirdCorner',
  locale: 'echoBirdLocale',
};

const API_ERROR_KEY = 'echoBirdApiError';

let sensitiveWordsCache = null;

function extensionUrl(path) {
  return chrome.runtime.getURL(path);
}

async function fetchJson(path) {
  const res = await fetch(extensionUrl(path));
  if (!res.ok) throw new Error(`fetch ${path}: ${res.status}`);
  return res.json();
}

async function loadSensitiveWords() {
  if (!sensitiveWordsCache) {
    try {
      sensitiveWordsCache = await fetchJson('config/sensitive-words.json');
    } catch {
      sensitiveWordsCache = [];
    }
  }
  return sensitiveWordsCache;
}

function hasBlockedWord(text, list) {
  if (!text || !list || !list.length) return false;
  const t = String(text);
  return list.some((w) => w && t.includes(w));
}

async function getSettings() {
  const d = await chrome.storage.local.get([
    STORAGE_KEYS.style,
    STORAGE_KEYS.walkMode,
    STORAGE_KEYS.apiKey,
    STORAGE_KEYS.baseUrl,
    STORAGE_KEYS.model,
  ]);
  return {
    style: d[STORAGE_KEYS.style] || 'philosophy',
    walkMode: Boolean(d[STORAGE_KEYS.walkMode]),
    apiKey: d[STORAGE_KEYS.apiKey] || '',
    baseUrl: d[STORAGE_KEYS.baseUrl] || '',
    model: d[STORAGE_KEYS.model] || 'gpt-4o-mini',
  };
}

chrome.runtime.onStartup.addListener(() => {
  sensitiveWordsCache = null;
});

/**
 * @param {string} textNlp 供本地分词（通常为去掉焦点 baseline 后的增量；无 fullText 时与全文相同）
 * @param {string} [fullText] 当前框内全文，遛鸟抽词用；缺省则等于 textNlp
 */
async function processUserText(textNlp, fullText) {
  const body = String(textNlp || '').trim();
  const full = String(fullText || body || '').trim();
  const blocked = await loadSensitiveWords();
  if (hasBlockedWord(full, blocked)) return { reply: null, reason: 'blocked' };
  if (body.length < 2 && full.length < 2) return { reply: null, reason: 'short' };

  const settings = await getSettings();
  let tokens = [];

  const forLlm = full.length >= 2 ? full : body;
  const forNlp = body.length >= 2 ? body : full;

  if (settings.walkMode && settings.apiKey) {
    const ext = await EchoBirdLLM.extractTokens({
      apiKey: settings.apiKey,
      baseUrl: settings.baseUrl || EchoBirdLLM.DEFAULT_BASE,
      model: settings.model,
      userText: forLlm,
      timeoutMs: 5000,
    });

    if (ext.ok && Array.isArray(ext.tokens)) {
      const cjk = /^[\u3400-\u9FFF\uF900-\uFAFF]+$/;
      tokens = ext.tokens
        .filter((t) => typeof t === 'string' && cjk.test(t.trim()))
        .map((t) => t.trim());
      await chrome.storage.local.remove([API_ERROR_KEY]);
    } else {
      if (EchoBirdLLM.shouldSurfaceApiError(ext.httpStatus)) {
        await chrome.storage.local.set({
          [API_ERROR_KEY]: ext.message || `API ${ext.httpStatus}`,
        });
      } else {
        await chrome.storage.local.remove([API_ERROR_KEY]);
      }
      tokens = EchoBirdSegmentation.parseInput(forNlp, { chineseOnly: true });
    }
  } else {
    tokens = EchoBirdSegmentation.parseInput(forNlp, { chineseOnly: true });
  }

  const unique = [...new Set(tokens.filter(Boolean))];
  console.debug('EchoBird: incrementTokens', unique);
  await EchoBirdCorpus.incrementTokens(unique);

  const mastered = await EchoBirdCorpus.getMasteredTexts();
  console.debug('EchoBird: masteredTexts', mastered);
  const reply = EchoBirdMosaic.generateChuchuReply(mastered, settings.style);
  return { reply: reply || '啾啾' };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'echoBird:openOptions') {
    chrome.runtime.openOptionsPage();
    sendResponse({ ok: true });
    return false;
  }
  if (msg?.type === 'echoBird:ping') {
    sendResponse({ ok: true });
    return false;
  }
  if (msg?.type === 'echoBird:process') {
    processUserText(msg.text || '', msg.fullText)
      .then((r) => sendResponse(r))
      .catch((e) => {
        console.error(e);
        sendResponse({ reply: null, error: String(e) });
      });
    return true;
  }
  if (msg?.type === 'echoBird:corpusCount') {
    EchoBirdCorpus.getStats()
      .then((s) =>
        sendResponse({
          mastered: s.mastered,
          learning: s.learning,
          total: s.total,
        })
      )
      .catch(() =>
        sendResponse({ mastered: 0, learning: 0, total: 0 })
      );
    return true;
  }
  if (msg?.type === 'echoBird:clearCorpus') {
    EchoBirdCorpus.clear()
      .then(() => sendResponse({ ok: true }))
      .catch((e) => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
  return false;
});
