/**
 * Shadow DOM bird + bubble (styles from demo_updated.html).
 */
(function (global) {
  const HOST_ID = 'echo-bird-root';

  const CSS = `
    * { box-sizing: border-box; }
    :host { all: initial; }
    .wrap {
      position: fixed;
      z-index: 2147483646;
      font-family: Arial, "Yuanti SC", "STYuanti", "YouYuan", "Microsoft YaHei", sans-serif;
    }
    .bird-icon {
      position: fixed;
      width: 52px;
      height: 52px;
      background: #D14C18;
      border: 2px solid #673C33;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
      box-shadow: 0 4px 0 #673C33;
      cursor: pointer;
      z-index: 2147483646;
      transition: transform 0.2s;
      animation: gentle-swing 3s ease-in-out infinite;
    }
    .bird-icon:hover { transform: scale(1.1); }
    .bird-br { bottom: 30px; right: 30px; }
    .bird-bl { bottom: 30px; left: 30px; }
    @keyframes gentle-swing {
      0%, 100% { transform: rotate(-2deg); }
      50% { transform: rotate(2deg); }
    }
    .bird-bubble-wrapper {
      position: fixed;
      z-index: 2147483647;
      animation: bubble-pop-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .bird-bubble-wrapper.br { bottom: 100px; right: 30px; }
    .bird-bubble-wrapper.bl { bottom: 100px; left: 30px; }
    .bird-bubble {
      background: #F4D68C;
      border: 2px dashed #7C9DD2;
      border-radius: 16px;
      padding: 12px 14px;
      max-width: 220px;
      box-shadow: 0 4px 0 #673C33;
      position: relative;
      word-break: break-word;
    }
    .bird-bubble::after {
      content: '';
      position: absolute;
      bottom: -10px;
      right: 20px;
      width: 0;
      height: 0;
      border-left: 10px solid transparent;
      border-right: 0 solid transparent;
      border-top: 10px solid #7C9DD2;
    }
    .bird-bubble.bl-tip::after {
      right: auto;
      left: 20px;
    }
    .bird-bubble-text {
      font-family: Arial, "Yuanti SC", "STYuanti", "YouYuan", "Microsoft YaHei", sans-serif;
      font-weight: 700;
      font-size: 14px;
      color: #673C33;
      line-height: 1.5;
    }
    .bird-bubble-time {
      font-size: 12px;
      color: #B2AB2B;
      margin-top: 6px;
      text-align: right;
    }
    @keyframes bubble-pop-in {
      0% { opacity: 0; transform: scale(0.6) translateY(20px); }
      100% { opacity: 1; transform: scale(1) translateY(0); }
    }
    @keyframes bubble-fade-out {
      0% { opacity: 1; transform: scale(1) translateY(0); }
      100% { opacity: 0; transform: scale(0.8) translateY(10px); }
    }
    .bubble-fade { animation: bubble-fade-out 0.5s ease-out forwards; }
  `;

  function getCorner() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['echoBirdCorner'], (d) => {
        resolve(d.echoBirdCorner === 'bl' ? 'bl' : 'br');
      });
    });
  }

  function ensureHost() {
    let host = document.getElementById(HOST_ID);
    if (host) return host;
    host = document.createElement('div');
    host.id = HOST_ID;
    document.documentElement.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = CSS;
    const inner = document.createElement('div');
    inner.className = 'wrap';
    shadow.appendChild(style);
    shadow.appendChild(inner);
    host._inner = inner;
    host._shadow = shadow;
    return host;
  }

  async function ensureBirdIcon() {
    const host = ensureHost();
    const inner = host._inner;
    let icon = inner.querySelector('.bird-icon');
    if (!icon) {
      icon = document.createElement('div');
      icon.className = 'bird-icon bird-br';
      icon.textContent = '🐦';
      icon.title = 'Echo Bird';
      icon.addEventListener('click', () => {
        chrome.runtime.sendMessage({ type: 'echoBird:openOptions' });
      });
      inner.appendChild(icon);
    }
    await applyCorner(icon, inner);
    return icon;
  }

  async function applyCorner(icon, inner) {
    const c = await getCorner();
    icon.classList.remove('bird-br', 'bird-bl');
    icon.classList.add(c === 'bl' ? 'bird-bl' : 'bird-br');
    const bubble = inner.querySelector('.bird-bubble-wrapper');
    if (bubble) {
      bubble.classList.remove('br', 'bl');
      bubble.classList.add(c === 'bl' ? 'bl' : 'br');
      const b = bubble.querySelector('.bird-bubble');
      if (b) {
        b.classList.toggle('bl-tip', c === 'bl');
      }
    }
  }

  function showBirdBubble(text) {
    if (!text) return;
    const host = ensureHost();
    const inner = host._inner;
    ensureBirdIcon();

    const existing = inner.querySelector('.bird-bubble-wrapper');
    if (existing) existing.remove();

    const time = new Date().toLocaleTimeString(
      navigator.language?.startsWith('zh') ? 'zh-CN' : 'en-US',
      { hour: '2-digit', minute: '2-digit', second: '2-digit' }
    );

    getCorner().then((c) => {
      const wrap = document.createElement('div');
      wrap.className = 'bird-bubble-wrapper ' + (c === 'bl' ? 'bl' : 'br');

      const bubble = document.createElement('div');
      bubble.className = 'bird-bubble' + (c === 'bl' ? ' bl-tip' : '');

      const bubbleText = document.createElement('div');
      bubbleText.className = 'bird-bubble-text';
      bubbleText.textContent = text;

      const bubbleTime = document.createElement('div');
      bubbleTime.className = 'bird-bubble-time';
      bubbleTime.textContent = time;

      bubble.appendChild(bubbleText);
      bubble.appendChild(bubbleTime);
      wrap.appendChild(bubble);
      inner.appendChild(wrap);

      const duration = 5000 + Math.random() * 3000;
      setTimeout(() => {
        wrap.classList.add('bubble-fade');
        setTimeout(() => wrap.remove(), 500);
      }, duration);
    });
  }

  global.EchoBirdUI = { ensureBirdIcon, showBirdBubble, getCorner };
})(typeof self !== 'undefined' ? self : this);
