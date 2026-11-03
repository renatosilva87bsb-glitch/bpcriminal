(() => {
  const button = document.getElementById('enable-push');
  const feedback = document.getElementById('push-feedback');
  if (!button || !feedback) return;
  const setMessage = message => { feedback.textContent = message; };
  const toBytes = value => { const pad = '='.repeat((4 - value.length % 4) % 4); const raw = atob((value + pad).replace(/-/g,'+').replace(/_/g,'/')); return Uint8Array.from(raw, c => c.charCodeAt(0)); };
  button.addEventListener('click', async () => {
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) throw new Error('Este navegador não oferece suporte a notificações push.');
      if (!window.authSession?.access_token) throw new Error('Entre no painel antes de ativar as notificações.');
      const configResponse = await fetch('/api/config', {cache:'no-store'});
      if (!configResponse.ok) throw new Error('Configuração do serviço indisponível.');
      const config = await configResponse.json();
      if (!config.vapidPublicKey) throw new Error('Chaves de push ainda não configuradas na Vercel.');
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') throw new Error('Permissão de notificações não concedida.');
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:toBytes(config.vapidPublicKey)});
      const response = await fetch('/api/push-subscribe', {method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+window.authSession.access_token},body:JSON.stringify({subscription})});
      const result = await response.json().catch(()=>({}));
      if (!response.ok) throw new Error(result.error || 'Não foi possível registrar este dispositivo.');
      setMessage('Notificações ativadas neste dispositivo.');
    } catch (error) { setMessage(error.message || 'Falha ao ativar notificações.'); }
  });
})();
