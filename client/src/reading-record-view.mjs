/** Presentation only. Server authorization owns access to every stored record. */
export function recordAccessContext(value = { mode: 'shared' }) {
  if (value?.mode === 'guest') return Object.freeze({ mode: 'guest', label: '占卜记录', cloudRecords: false });
  if (value?.mode === 'shared') return Object.freeze({ mode: 'shared', label: '共享记录', cloudRecords: true });
  throw new TypeError('Unsupported record presentation context');
}

/** A display title, never a rewrite of the saved question or an AI request. */
export function recordDisplayTitle(question) {
  const text = typeof question === 'string' ? question.trim() : '';
  if (!text) return '未命名的占卜';
  const sentence = text.match(/^[\s\S]*?(?:[。！？!?](?:[”」』"])?|\.(?=\s|$)|\r?\n|$)/)?.[0].trim() || text;
  const compact = sentence.replace(/\s+/g, ' ');
  const characters = Array.from(compact);
  return characters.length > 88 ? `${characters.slice(0, 87).join('')}…` : compact;
}

export function recordDay(value) {
  const date = new Date(value);
  return {
    key: `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`,
    label: date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }),
    time: date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }),
  };
}
