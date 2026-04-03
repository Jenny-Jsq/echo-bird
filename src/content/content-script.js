(function () {
  const REPLY_DEBOUNCE_MS = 5000;

  /** @type {WeakMap<Element, number>} */
  const timers = new WeakMap();
  /** @type {WeakMap<Element, boolean>} */
  const composingFor = new WeakMap();
  /** @type {WeakMap<Element, string>} 聚焦时框内快照，用于忽略预填/占位 */
  const baseline = new WeakMap();
  /** @type {WeakMap<Element, string>} */
  const lastProcessed = new WeakMap();
  /** @type {WeakMap<Element, number>} */
  const lastProcessedTime = new WeakMap();

  function isEditable(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.isContentEditable) return true;
    if (el.tagName === 'TEXTAREA') return true;
    if (el.tagName === 'INPUT') {
      const t = (el.type || '').toLowerCase();
      return t === 'text' || t === 'search' || t === '';
    }
    return false;
  }

  function getTextFromTarget(el) {
    if (!el) return '';
    if (el.isContentEditable) {
      return el.innerText || el.textContent || '';
    }
    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
      return el.value || '';
    }
    return '';
  }

  function normalizeForDedup(s) {
    return s.replace(/\s+/g, ' ').trim().slice(0, 2000);
  }

  /**
   * 相对 focus 时的 baseline：仅把用户新增/改动的部分交给 NLP；整段被改掉时退回全文。
   */
  function computeEffective(current, base) {
    const c = current;
    const b = base == null ? '' : base;
    if (!b) return c;
    if (c === b) return '';
    if (c.startsWith(b)) {
      const rest = c.slice(b.length).replace(/^\s+/, '');
      return rest.length ? rest : '';
    }
    return c;
  }

  function clearTimer(el) {
    const id = timers.get(el);
    if (id != null) clearTimeout(id);
    timers.delete(el);
  }

  function scheduleProcess(el) {
    const snap = normalizeForDedup(getTextFromTarget(el));
    if (snap.length < 2) return;
    if (EchoBirdSensitive.shouldSkipText(snap)) return;

    clearTimer(el);

    if (composingFor.get(el)) return;

    const id = setTimeout(() => {
      timers.delete(el);
      if (composingFor.get(el)) return;

      const snap2 = normalizeForDedup(getTextFromTarget(el));
      if (snap2.length < 2) return;

      const lastText = lastProcessed.get(el);
      const lastTime = lastProcessedTime.get(el) || 0;
      if (lastText === snap2 && Date.now() - lastTime < 8000) {
        console.debug('EchoBird: skip duplicate text in short interval', { snap2, lastTime });
        return;
      }

      const base = baseline.has(el) ? baseline.get(el) : '';
      const effective = computeEffective(snap2, base);
      let textForNlp = effective;
      if (textForNlp.length < 2 && snap2.length >= 2 && snap2 !== base) {
        textForNlp = snap2;
      }
      if (textForNlp.length < 2) return;

      chrome.runtime.sendMessage(
        { type: 'echoBird:process', text: textForNlp, fullText: snap2 },
        (res) => {
          if (chrome.runtime.lastError) return;
          lastProcessed.set(el, snap2);
          lastProcessedTime.set(el, Date.now());
          if (res && res.reply !== undefined && res.reply !== null) {
            EchoBirdUI.showBirdBubble(res.reply);
          } else {
            EchoBirdUI.showBirdBubble('啾啾');
          }
        }
      );
    }, REPLY_DEBOUNCE_MS);

    timers.set(el, id);
  }

  function onInput(ev) {
    const el = ev.target;
    if (!isEditable(el)) return;
    if (EchoBirdSensitive.isSensitiveElement(el)) return;
    if (composingFor.get(el)) return;
    scheduleProcess(el);
  }

  document.addEventListener(
    'focusin',
    (e) => {
      const el = e.target;
      if (!isEditable(el)) return;
      if (EchoBirdSensitive.isSensitiveElement(el)) return;
      baseline.set(el, normalizeForDedup(getTextFromTarget(el)));
    },
    true
  );

  document.addEventListener(
    'compositionstart',
    (e) => {
      const el = e.target;
      if (!isEditable(el)) return;
      composingFor.set(el, true);
      clearTimer(el);
    },
    true
  );

  document.addEventListener(
    'compositionend',
    (e) => {
      const el = e.target;
      if (!isEditable(el)) return;
      composingFor.set(el, false);
      if (EchoBirdSensitive.isSensitiveElement(el)) return;
      scheduleProcess(el);
    },
    true
  );

  function bindRoot(root) {
    root.addEventListener('input', onInput, true);
  }

  bindRoot(document);

  EchoBirdUI.ensureBirdIcon();

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.echoBirdCorner) {
      EchoBirdUI.ensureBirdIcon();
    }
  });
})();
