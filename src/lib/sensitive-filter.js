/**
 * Block obvious PII / sensitive patterns before processing (content script).
 */
(function (global) {
  const EMAIL = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  const PHONE_CN = /1[3-9]\d{9}|(\d{3,4}-?)?\d{7,8}/;
  const ID_CN = /\d{17}[\dXx]|\d{15}/;

  function looksLikeUrl(text) {
    const t = String(text || '').trim();
    if (/^https?:\/\//i.test(t)) return true;
    if (/^www\./i.test(t)) return true;
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(t)) return true;
    return false;
  }

  function shouldSkipText(text) {
    if (!text || typeof text !== 'string') return true;
    const t = text.trim();
    if (t.length < 2) return true;
    if (looksLikeUrl(t)) return true;
    if (EMAIL.test(t)) return true;
    if (PHONE_CN.test(t) && t.replace(/\D/g, '').length >= 10) return true;
    if (ID_CN.test(t)) return true;
    return false;
  }

  function isSensitiveElement(el) {
    if (!el || el.nodeType !== 1) return true;
    const tag = el.tagName;
    if (tag === 'INPUT') {
      const type = (el.type || '').toLowerCase();
      if (type === 'password' || type === 'hidden') return true;
      if (el.autocomplete === 'cc-number' || el.getAttribute('data-sensitive') === 'true') return true;
    }
    if (el.isContentEditable) {
      const role = el.getAttribute('role');
      if (role === 'textbox' && el.closest('[data-echo-bird-skip="1"]')) return true;
    }
    return false;
  }

  global.EchoBirdSensitive = {
    shouldSkipText,
    isSensitiveElement,
    looksLikeUrl,
    EMAIL,
    PHONE_CN,
  };
})(typeof self !== 'undefined' ? self : this);
