(() => {
  const menuButton = document.querySelector('.menu-toggle');
  const menu = document.querySelector('#main-nav');
  if (menuButton && menu) {
    menuButton.addEventListener('click', () => {
      const open = menu.classList.toggle('open');
      menuButton.setAttribute('aria-expanded', String(open)); menuButton.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    });
    menu.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
      menu.classList.remove('open'); menuButton.setAttribute('aria-expanded', 'false'); menuButton.setAttribute('aria-label', 'Abrir menu');
    }));
  }
  const year = document.querySelector('#year'); if (year) year.textContent = String(new Date().getFullYear());
  const form = document.querySelector('#lead-form');
  if (form) {
    let requestId = crypto.randomUUID();
    form.addEventListener('submit', async event => {
    event.preventDefault();
    const feedback = document.querySelector('#form-feedback');
    const button = form.querySelector('button[type="submit"]');
    feedback.className = 'form-feedback'; feedback.textContent = '';
    if (!form.reportValidity()) return;
    const data = Object.fromEntries(new FormData(form).entries());
    data.consent = form.elements.consent.checked;
    data.request_id = requestId;
    button.disabled = true; button.textContent = 'Enviando…';
    try {
      const response = await fetch('/api/leads', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Não foi possível enviar sua solicitação.');
      feedback.textContent = 'Solicitação enviada. A equipe poderá retornar pelos canais informados.';
      form.reset();
      requestId = crypto.randomUUID();
    } catch (error) {
      feedback.classList.add('error'); feedback.innerHTML = 'O canal online está temporariamente indisponível. <a href="https://wa.me/5561994200001?text=Ol%C3%A1%2C%20preciso%20de%20orienta%C3%A7%C3%A3o%20jur%C3%ADdica." target="_blank" rel="noopener">Fale pelo WhatsApp</a> ou ligue para (61) 99420-0001.';
    } finally { button.disabled = false; button.innerHTML = 'Enviar solicitação <span>↗</span>'; }
    });
  }
})();
