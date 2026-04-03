(async function () {
  const d = await chrome.storage.local.get('echoBirdLocale');
  const loc = d.echoBirdLocale === 'en' ? 'en-US' : 'zh-CN';
  const res = await fetch(chrome.runtime.getURL(`locales/${loc}.json`));
  const m = await res.json();
  document.getElementById('hint').textContent = m.popupHint || '';
  document.getElementById('openOpt').textContent = m.popupOpenSettings || 'Settings';
  document.getElementById('openOpt').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
})();
