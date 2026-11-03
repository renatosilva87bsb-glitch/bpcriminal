

(() => {
  const grid = document.querySelector('#official-news');
  const refresh = document.querySelector('#news-refresh');
  if (!grid) return;
  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  const formatDate = value => {
    if (!value) return 'publicação recente';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'publicação recente' : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(date);
  };
  const render = payload => {
    const items = Array.isArray(payload.items) ? payload.items : [];
    if (!items.length) {
      grid.innerHTML = '<p class="news-empty">As fontes oficiais não retornaram notícias agora. Consulte diretamente STF, STJ ou CNJ pelos links institucionais.</p>';
    } else {
      grid.innerHTML = items.map(item => `<a class="article-card news-card" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer"><div class="article-meta"><span class="article-date">${escapeHtml(formatDate(item.publishedAt))}</span><span class="news-source">${escapeHtml(item.source)}</span></div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.excerpt || 'Atualização publicada em fonte oficial.')}</p><span class="article-link">Ler na fonte oficial <span aria-hidden="true">↗</span></span></a>`).join('');
    }
    const ok = (payload.sources || []).filter(source => source.status === 'ok').map(source => source.source).join(', ');
    if (refresh) refresh.innerHTML = ok ? `Atualizado agora · fontes disponíveis: <strong>${escapeHtml(ok)}</strong>` : 'As fontes estão temporariamente indisponíveis; tente novamente em instantes.';
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
