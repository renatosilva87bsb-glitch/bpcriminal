(() => {
  if (!('serviceWorker' in navigator)) return;

  const buttons = () => document.querySelectorAll('[data-pwa-install]');
  const setVisible = visible => buttons().forEach(button => { button.hidden = !visible; });
  let installPrompt = null;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(error => {
      console.error('Falha ao registrar o service worker:', error);
    });
  });

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event;
    setVisible(true);
  });

  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    setVisible(false);
  });

  document.addEventListener('click', async event => {
    const target = event.target;
    const button = target instanceof Element ? target.closest('[data-pwa-install]') : null;
    if (!button || !installPrompt) return;
    const prompt = installPrompt;
    installPrompt = null;
    try {
      await prompt.prompt();
      await prompt.userChoice;
    } catch {}
    setVisible(false);
  });
})();
