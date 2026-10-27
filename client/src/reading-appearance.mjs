// Appearance is the only remembered preference. Card and reading state stay
// entirely outside this controller.
export const APPEARANCE_STORAGE_KEY = 'augurwell.appearance';

const normalize = value => value === 'light' || value === 'dark' ? value : 'system';

export function resolveAppearance(preference, systemDark) {
  const value = normalize(preference);
  return value === 'system' ? (systemDark ? 'dark' : 'light') : value;
}

export function readAppearancePreference(storage) {
  try {
    return normalize(storage?.getItem(APPEARANCE_STORAGE_KEY));
  } catch {
    return 'system';
  }
}

/** Supply an already-accessible Storage object; obtaining localStorage may throw. */
export function createAppearancePreference({ storage, mediaQuery, onChange = () => {} } = {}) {
  let preference = readAppearancePreference(storage);
  let systemDark = !!mediaQuery?.matches;
  let disposed = false;
  let current = Object.freeze({ preference, theme: resolveAppearance(preference, systemDark) });

  function publish() {
    const theme = resolveAppearance(preference, systemDark);
    if (current.preference === preference && current.theme === theme) return current;
    current = Object.freeze({ preference, theme });
    onChange(current);
    return current;
  }

  function systemChanged(event) {
    if (disposed) return;
    systemDark = typeof event.matches === 'boolean' ? event.matches : !!mediaQuery?.matches;
    if (preference === 'system') publish();
  }

  mediaQuery?.addEventListener?.('change', systemChanged);
  onChange(current);

  return {
    get current() { return current; },
    set(value) {
      if (disposed) return current;
      preference = normalize(value);
      try {
        storage?.setItem(APPEARANCE_STORAGE_KEY, preference);
      } catch {
        // A blocked or full store must not prevent the current-session choice.
      }
      return publish();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      mediaQuery?.removeEventListener?.('change', systemChanged);
    },
  };
}
