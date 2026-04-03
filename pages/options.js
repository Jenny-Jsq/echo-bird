const KEYS = {
  style: 'echoBirdStyle',
  walkMode: 'echoBirdWalkMode',
  apiKey: 'echoBirdApiKey',
  baseUrl: 'echoBirdBaseUrl',
  model: 'echoBirdModel',
  corner: 'echoBirdCorner',
  locale: 'echoBirdLocale',
};

const API_ERROR_KEY = 'echoBirdApiError';

let messages = {};

async function loadMessages(lang) {
  const file = lang === 'en' ? 'en-US' : 'zh-CN';
  const url = chrome.runtime.getURL(`locales/${file}.json`);
  const res = await fetch(url);
  messages = await res.json();
}

function t(key) {
  return messages[key] || key;
}

function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const k = el.getAttribute('data-i18n');
    if (messages[k]) el.textContent = messages[k];
  });
  document.title = t('optionsTitle');
}

async function refreshApiError() {
  const d = await chrome.storage.local.get(API_ERROR_KEY);
  const el = document.getElementById('apiError');
  if (el) el.textContent = d[API_ERROR_KEY] || '';
}

async function refreshCorpusCount() {
  chrome.runtime.sendMessage({ type: 'echoBird:corpusCount' }, (res) => {
    const el = document.getElementById('corpusStats');
    if (el && res && typeof res.mastered === 'number') {
      el.textContent = `${t('corpusMasteredLabel')}: ${res.mastered} ${t('corpusEntries')} ｜ ${t('corpusLearningLabel')}: ${res.learning} ${t('corpusEntries')}`;
    }
  });
}

async function loadForm() {
  const d = await chrome.storage.local.get([
    KEYS.style,
    KEYS.walkMode,
    KEYS.apiKey,
    KEYS.baseUrl,
    KEYS.model,
    KEYS.corner,
    KEYS.locale,
  ]);
  const locale = d[KEYS.locale] === 'en' ? 'en' : 'zh';
  document.querySelector(`input[name="locale"][value="${locale}"]`).checked = true;
  await loadMessages(locale);
  applyI18n();

  const style = d[KEYS.style] || 'philosophy';
  const sEl = document.querySelector(`input[name="style"][value="${style}"]`);
  if (sEl) sEl.checked = true;

  const corner = d[KEYS.corner] === 'bl' ? 'bl' : 'br';
  document.querySelector(`input[name="corner"][value="${corner}"]`).checked = true;

  document.getElementById('walkMode').checked = Boolean(d[KEYS.walkMode]);
  document.getElementById('apiKey').value = d[KEYS.apiKey] || '';
  document.getElementById('baseUrl').value = d[KEYS.baseUrl] || '';
  document.getElementById('model').value = d[KEYS.model] || 'gpt-4o-mini';

  await refreshCorpusCount();
  await refreshApiError();
}

function setStatus(text, ok) {
  const el = document.getElementById('status');
  el.textContent = text;
  el.className = ok ? 'ok' : 'err';
}

document.getElementById('saveBtn').addEventListener('click', async () => {
  const locale = document.querySelector('input[name="locale"]:checked').value;
  const style = document.querySelector('input[name="style"]:checked').value;
  const corner = document.querySelector('input[name="corner"]:checked').value;
  await chrome.storage.local.set({
    [KEYS.locale]: locale === 'en' ? 'en' : 'zh',
    [KEYS.style]: style,
    [KEYS.corner]: corner,
    [KEYS.walkMode]: document.getElementById('walkMode').checked,
    [KEYS.apiKey]: document.getElementById('apiKey').value.trim(),
    [KEYS.baseUrl]: document.getElementById('baseUrl').value.trim(),
    [KEYS.model]: document.getElementById('model').value.trim() || 'gpt-4o-mini',
  });
  await chrome.storage.local.remove([API_ERROR_KEY]);
  await refreshApiError();
  await loadMessages(locale);
  applyI18n();
  setStatus(t('saved'), true);
});

document.getElementById('clearBtn').addEventListener('click', async () => {
  chrome.runtime.sendMessage({ type: 'echoBird:clearCorpus' }, async (res) => {
    if (res && res.ok) {
      setStatus(t('cleared'), true);
      await refreshCorpusCount();
    } else setStatus(t('testFail'), false);
  });
});

document.getElementById('testBtn').addEventListener('click', async () => {
  const apiKey = document.getElementById('apiKey').value.trim();
  const baseUrl = document.getElementById('baseUrl').value.trim() || 'https://api.openai.com/v1';
  const model = document.getElementById('model').value.trim() || 'gpt-4o-mini';
  if (!apiKey) {
    setStatus(t('testFail'), false);
    return;
  }
  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
  setStatus('…', true);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: 5,
        messages: [{ role: 'user', content: 'ping' }],
      }),
    });
    if (res.ok) {
      await chrome.storage.local.remove([API_ERROR_KEY]);
      await refreshApiError();
      setStatus(t('testOk'), true);
    } else {
      if ([401, 402, 403, 429].includes(res.status)) {
        const errText = await res.text();
        await chrome.storage.local.set({
          [API_ERROR_KEY]: `HTTP ${res.status}: ${errText.slice(0, 120)}`,
        });
        await refreshApiError();
      }
      setStatus(`${t('testFail')} (${res.status})`, false);
    }
  } catch (e) {
    setStatus(t('testFail'), false);
  }
});

document.querySelectorAll('input[name="locale"]').forEach((r) => {
  r.addEventListener('change', async () => {
    const locale = document.querySelector('input[name="locale"]:checked').value;
    await loadMessages(locale);
    applyI18n();
    await refreshCorpusCount();
  });
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[API_ERROR_KEY]) {
    refreshApiError();
  }
});

loadForm();
