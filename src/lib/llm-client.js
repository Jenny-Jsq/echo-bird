/**
 * OpenAI-compatible API: token extraction (v2 遛鸟模式).
 */
(function (global) {
  const DEFAULT_BASE = 'https://api.openai.com/v1';

  const EXTRACT_SYSTEM = [
    '你是一个中文语言单元提取助手。请从用户输入中提取有意义的语言单元，用于构建个人语料库。',
    '',
    '规则：',
    '1. 每个词条为 2～4 个汉字的词汇，或不超过 7 个汉字的完整短句。',
    '2. 只保留有意义的中文词汇或短句，丢弃：英文字母、数字、标点、URL、无语义碎片。',
    '3. 不重复，不解释，直接返回 JSON 数组，格式：["词条1","词条2",...]',
    '4. 若输入中无有效中文内容，返回空数组：[]',
  ].join('\n');

  function parseTokenArray(content) {
    let s = String(content || '').trim();
    const fence = /^```(?:json)?\s*([\s\S]*?)```$/m.exec(s);
    if (fence) s = fence[1].trim();
    try {
      const v = JSON.parse(s);
      if (!Array.isArray(v)) return null;
      return v
        .filter((x) => typeof x === 'string' && x.trim())
        .map((x) => x.trim());
    } catch {
      return null;
    }
  }

  /**
   * @returns {Promise<{ ok: true, tokens: string[] } | { ok: false, tokens: null, httpStatus: number, message: string }>}
   */
  async function extractTokens({
    apiKey,
    baseUrl,
    model,
    userText,
    timeoutMs,
  }) {
    const base = (baseUrl || DEFAULT_BASE).replace(/\/$/, '');
    const url = `${base}/chat/completions`;
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs || 5000);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model || 'gpt-4o-mini',
          temperature: 0.2,
          max_tokens: 512,
          messages: [
            { role: 'system', content: EXTRACT_SYSTEM },
            { role: 'user', content: String(userText || '') },
          ],
        }),
        signal: controller.signal,
      });
      clearTimeout(t);

      const httpStatus = res.status;
      if (!res.ok) {
        const errText = await res.text();
        return {
          ok: false,
          tokens: null,
          httpStatus,
          message: `HTTP ${httpStatus}: ${errText.slice(0, 120)}`,
        };
      }

      const data = await res.json();
      const raw = data.choices?.[0]?.message?.content?.trim() || '';
      const tokens = parseTokenArray(raw);
      if (!tokens) {
        return {
          ok: false,
          tokens: null,
          httpStatus,
          message: 'Invalid JSON array',
        };
      }
      return { ok: true, tokens, httpStatus };
    } catch (e) {
      clearTimeout(t);
      const aborted = e && e.name === 'AbortError';
      return {
        ok: false,
        tokens: null,
        httpStatus: 0,
        message: aborted ? 'timeout' : String(e && e.message ? e.message : e),
      };
    }
  }

  function shouldSurfaceApiError(httpStatus) {
    return [401, 402, 403, 429].includes(httpStatus);
  }

  global.EchoBirdLLM = {
    extractTokens,
    parseTokenArray,
    shouldSurfaceApiError,
    DEFAULT_BASE,
  };
})(typeof self !== 'undefined' ? self : this);
