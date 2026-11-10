export const AI_MAX_WEB_TOOL_CALLS = 3;

/** Shared canonical form for provider evidence, claim matching and safe links. */
export function normalizeSourceUrl(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 4096 || /[\u0000-\u0020\u007f]/u.test(value)) return null;
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol) || !url.hostname || url.username || url.password) return null;
    return url.href;
  } catch { return null; }
}

/** Validate an IANA zone while preserving a valid alias supplied by the client. */
export function normalizeAITimeZone(value = 'UTC') {
  if (typeof value !== 'string' || value.length > 100 || !/^[A-Za-z_+-]+(?:\/[A-Za-z0-9_+-]+)*$/u.test(value)) return null;
  try { new Intl.DateTimeFormat('en', { timeZone: value }).format(0); return value; }
  catch { return null; }
}

/** Execution evidence comes only from the provider's tool output, never prose. */
export function webCheckFromResponse(response, checkedAt) {
  const output = Array.isArray(response?.output) ? response.output : [];
  const calls = output.filter(item => item?.type === 'web_search_call');
  const searches = calls.filter(item => item.action?.type === 'search');
  const searched = searches.some(item => item.status === 'completed');
  const sources = new Map();
  const add = source => {
    const url = normalizeSourceUrl(source?.url);
    if (!url || sources.size >= 100) return;
    const title = typeof source.title === 'string' && source.title.trim() ? source.title.trim().slice(0, 500) : new URL(url).hostname;
    // Citation annotations usually carry a better title than action.sources.
    if (!sources.has(url) || title !== new URL(url).hostname) sources.set(url, { url, title });
  };
  if (searched) {
    for (const call of calls) if (call.status === 'completed' && Array.isArray(call.action?.sources)) call.action.sources.forEach(add);
    for (const item of output) if (item?.type === 'message' && Array.isArray(item.content)) {
      for (const part of item.content) if (part?.type === 'output_text' && Array.isArray(part.annotations)) {
        part.annotations.filter(annotation => annotation?.type === 'url_citation').forEach(add);
      }
    }
  }
  return { status: searched ? 'searched' : 'incomplete', checkedAt, searchCalls: searches.length, sources: [...sources.values()] };
}
