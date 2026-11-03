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
      const subscription = await registration.pushManager.getSubscription() || await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:toBytes(config.vapidPublicKey)});
      const response = await fetch('/api/push-subscribe', {method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+window.authSession.access_token},body:JSON.stringify({subscription})});
      const result = await response.json().catch(()=>({}));
      if (!response.ok) throw new Error(result.error || 'Não foi possível registrar este dispositivo.');
      setMessage('Notificações ativadas neste dispositivo. Prazos devem ser conferidos no CRM e no processo oficial.');
      const testButton=document.createElement('button');testButton.type='button';testButton.className='nav-item';testButton.textContent='Testar notificação neste dispositivo';button.parentNode.insertBefore(testButton,feedback);
      testButton.addEventListener('click',async()=>{testButton.disabled=true;try{const r=await fetch('/api/push-send',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+window.authSession.access_token,'X-BP-Tenant-Id':window.currentTenantId},body:JSON.stringify({type:'test',url:'/admin'})});const data=await r.json();setMessage(r.ok&&data.sent?'Teste enviado. Verifique as notificações do dispositivo.':data.error||'Nenhum dispositivo recebeu o teste.');}catch{setMessage('Não foi possível enviar o teste.');}finally{testButton.disabled=false;}});
    } catch (error) { setMessage(error.message || 'Falha ao ativar notificações.'); }
  });
})();
