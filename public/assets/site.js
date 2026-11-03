(() => {
  const menuButton = document.querySelector('.menu-toggle');
  const menu = document.querySelector('#main-nav');

  const setMenuOpen = open => {
    if (!menuButton || !menu) return;
    menu.classList.toggle('open', open);
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
  };

  if (menuButton && menu) {
    menuButton.addEventListener('click', () => setMenuOpen(!menu.classList.contains('open')));
    menu.querySelectorAll('a, button').forEach(item => item.addEventListener('click', () => setMenuOpen(false)));
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && menu.classList.contains('open')) {
        setMenuOpen(false);
        menuButton.focus();
      }
    });
  }

  const year = document.querySelector('#year');
  if (year) year.textContent = String(new Date().getFullYear());

  const createRequestId = () => {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    const bytes = new Uint8Array(16);
    if (window.crypto && typeof window.crypto.getRandomValues === 'function') window.crypto.getRandomValues(bytes);
    else for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  };

  const form = document.querySelector('#lead-form');
  if (form) {
    let requestId = createRequestId();
    const feedback = form.querySelector('#form-feedback');
    const button = form.querySelector('button[type="submit"]');

    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const data = Object.fromEntries(new FormData(form).entries());
      data.consent = Boolean(form.elements.consent && form.elements.consent.checked);
      data.request_id = requestId;
      if (feedback) {
        feedback.className = 'form-feedback';
        feedback.textContent = '';
      }
      if (button) {
        button.disabled = true;
        button.textContent = 'Enviando…';
      }

      try {
        const response = await fetch('/api/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Request-ID': requestId },
          cache: 'no-store',
          body: JSON.stringify(data)
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || 'Não foi possível enviar sua solicitação.');
        if (feedback) feedback.textContent = 'Solicitação enviada. A equipe poderá retornar pelos canais informados.';
        form.reset();
        requestId = createRequestId();
      } catch (error) {
        if (!feedback) return;
        feedback.className = 'form-feedback error';
        const message = error instanceof Error && error.message ? error.message : 'O canal online está temporariamente indisponível.';
        feedback.append(document.createTextNode(`${message} `));
        const link = document.createElement('a');
        link.href = 'https://wa.me/5561994200001?text=Ol%C3%A1%2C%20preciso%20de%20orienta%C3%A7%C3%A3o%20jur%C3%ADdica.';
        link.target = '_blank';
        link.rel = 'noopener';
        link.textContent = 'Fale pelo WhatsApp';
        feedback.append(link, document.createTextNode(' ou ligue para (61) 99420-0001.'));
      } finally {
        if (button) {
          button.disabled = false;
          button.innerHTML = 'Enviar solicitação <span>↗</span>';
        }
      }
    });
  }

  const grid = document.querySelector('#official-news');
  const refresh = document.querySelector('#news-refresh');
  if (!grid) return;

  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  const safeUrl = value => {
    try {
      const url = new URL(String(value || ''), window.location.origin);
      return ['http:', 'https:'].includes(url.protocol) ? url.href : '#';
    } catch {
      return '#';
    }
  };
  const formatDate = value => {
    if (!value) return 'publicação recente';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'publicação recente' : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(date);
  };
  const render = payload => {
    const items = payload && Array.isArray(payload.items) ? payload.items : [];
    if (!items.length) {
      grid.innerHTML = '<p class="news-empty">As fontes oficiais não retornaram notícias agora. Consulte diretamente STF, STJ ou CNJ pelos links institucionais.</p>';
    } else {
      grid.innerHTML = items.map(item => `<a class="article-card news-card" href="${escapeHtml(safeUrl(item.url))}" target="_blank" rel="noopener noreferrer"><div class="article-meta"><span class="article-date">${escapeHtml(formatDate(item.publishedAt))}</span><span class="news-source">${escapeHtml(item.source)}</span></div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.excerpt || 'Atualização publicada em fonte oficial.')}</p><span class="article-link">Ler na fonte oficial <span aria-hidden="true">↗</span></span></a>`).join('');
    }
    const sources = payload && Array.isArray(payload.sources) ? payload.sources : [];
    const available = sources.filter(source => source.status === 'ok').map(source => source.source).join(', ');
    if (refresh) refresh.innerHTML = available ? `Atualizado agora · fontes disponíveis: <strong>${escapeHtml(available)}</strong>` : 'As fontes estão temporariamente indisponíveis; tente novamente em instantes.';
  };
  const loadNews = async () => {
    try {
      const response = await fetch('/api/news', { headers: { accept: 'application/json' }, cache: 'no-store' });
      if (!response.ok) throw new Error('news_unavailable');
      render(await response.json());
    } catch {
      if (!grid.querySelector('.news-card')) grid.innerHTML = '<p class="news-empty">Não foi possível carregar as fontes oficiais agora. O painel tentará novamente automaticamente.</p>';
      if (refresh) refresh.textContent = 'Aguardando nova tentativa automática…';
    }
  };
  loadNews();
  window.setInterval(loadNews, 5 * 60 * 1000);
})();
