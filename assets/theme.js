(() => {
  const root = document.documentElement;
  const modes = ['auto', 'light', 'dark'];
  const labels = { auto: 'Tema automático', light: 'Tema claro', dark: 'Tema escuro' };
  const getMode = () => localStorage.getItem('bp-theme') || 'auto';
  const apply = mode => {
    const safe = modes.includes(mode) ? mode : 'auto';
    root.dataset.theme = safe;
    localStorage.setItem('bp-theme', safe);
    document.querySelectorAll('[data-theme-toggle]').forEach(button => {
      button.textContent = safe === 'auto' ? 'Auto' : safe === 'light' ? 'Claro' : 'Escuro';
      button.setAttribute('aria-label', `${labels[safe]}. Clique para alternar.`);
      button.title = `${labels[safe]} — clique para alternar`;
    });
  };
  apply(getMode());
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-theme-toggle]');
    if (!button) return;
    const current = getMode();
    apply(modes[(modes.indexOf(current) + 1) % modes.length]);
  });
})();
