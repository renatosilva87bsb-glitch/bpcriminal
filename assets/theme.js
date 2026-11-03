(() => {
  const root = document.documentElement;
  const modes = ['auto', 'light', 'dark'];
  const labels = { auto: 'Tema automático', light: 'Tema claro', dark: 'Tema escuro' };
  const storageKey = 'bp-theme';
  const media = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  const readMode = () => {
    try {
      const stored = window.localStorage.getItem(storageKey);
      return modes.includes(stored) ? stored : 'auto';
    } catch {
      return 'auto';
    }
  };

  const systemScheme = () => (media && media.matches ? 'dark' : 'light');

  const updateButtons = mode => {
    const text = mode === 'auto' ? 'Auto' : mode === 'light' ? 'Claro' : 'Escuro';
    document.querySelectorAll('[data-theme-toggle]').forEach(button => {
      button.textContent = text;
      button.dataset.themeMode = mode;
      button.setAttribute('aria-label', `${labels[mode]}. Clique para alternar entre automático, claro e escuro.`);
      button.title = `${labels[mode]} — clique para alternar`;
    });
  };

  const apply = (requestedMode, persist = true) => {
    const mode = modes.includes(requestedMode) ? requestedMode : 'auto';
    const resolved = mode === 'auto' ? systemScheme() : mode;
    root.dataset.themeMode = mode;
    root.dataset.colorScheme = resolved;
    updateButtons(mode);
    if (persist) {
      try { window.localStorage.setItem(storageKey, mode); } catch {}
    }
  };

  const syncWithSystem = () => {
    if (readMode() === 'auto') apply('auto', false);
  };

  apply(readMode());

  if (media) {
    if (typeof media.addEventListener === 'function') media.addEventListener('change', syncWithSystem);
    else if (typeof media.addListener === 'function') media.addListener(syncWithSystem);
  }

  window.addEventListener('storage', event => {
    if (event.key === storageKey) apply(readMode(), false);
  });

  document.addEventListener('click', event => {
    const target = event.target;
    const button = target instanceof Element ? target.closest('[data-theme-toggle]') : null;
    if (!button) return;
    const current = readMode();
    apply(modes[(modes.indexOf(current) + 1) % modes.length]);
  });

  window.BPTheme = { apply, getMode: readMode };
})();
