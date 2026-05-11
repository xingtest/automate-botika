function toArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function parseList(value, fallback = []) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
  } catch (_) {}
  return trimmed.split(',').map(part => part.trim()).filter(Boolean);
}

function getEnvelope(input) {
  if (!input) return {};
  if (input.trigger_data && typeof input.trigger_data === 'object') {
    return { ...input.trigger_data, _trigger_meta: { ...input, trigger_data: undefined } };
  }
  return input;
}

function getItems(input) {
  const envelope = getEnvelope(input);
  return toArray(
    envelope.results ||
    envelope.evaluations ||
    envelope.items ||
    envelope.test_cases ||
    envelope.generated_test_cases ||
    []
  );
}

function withResults(input, results, extra = {}) {
  const envelope = getEnvelope(input);
  return {
    ...envelope,
    ...extra,
    results,
    total_items: results.length
  };
}

function firstValue(item, names, fallback = '') {
  if (!item || typeof item !== 'object') return fallback;
  const entries = Object.entries(item);
  for (const name of names) {
    const match = entries.find(([key]) => key.toLowerCase() === name.toLowerCase());
    if (match && match[1] !== undefined && match[1] !== null && String(match[1]).trim() !== '') {
      return match[1];
    }
  }
  return fallback;
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeItem(item, index = 0) {
  const question = normalizeText(firstValue(item, ['question', 'pertanyaan', 'test_case', 'user']));
  const expected = normalizeText(firstValue(item, ['response_kb', 'expected', 'expected_answer', 'context', 'reference']));
  const actual = normalizeText(firstValue(item, ['response_llm', 'actual', 'bot_response', 'response', 'answer']));
  return {
    ...item,
    no: firstValue(item, ['no', 'number', 'id'], index + 1),
    title: normalizeText(firstValue(item, ['title', 'topic', 'category'], `Test ${index + 1}`)),
    question,
    response_kb: expected,
    response_llm: actual,
    expected,
    actual
  };
}

function tokenize(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9\u00c0-\u024f]+/gi, ' ')
    .split(/\s+/)
    .filter(token => token.length > 2);
}

function similarity(a, b) {
  const left = new Set(tokenize(a));
  const right = new Set(tokenize(b));
  if (!left.size || !right.size) return 0;
  let overlap = 0;
  for (const token of left) {
    if (right.has(token)) overlap++;
  }
  return overlap / Math.max(left.size, right.size);
}

function clampScore(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(1, number));
}

module.exports = {
  clampScore,
  getEnvelope,
  getItems,
  firstValue,
  normalizeItem,
  normalizeText,
  parseList,
  similarity,
  tokenize,
  withResults
};
