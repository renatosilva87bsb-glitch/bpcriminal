/* Supabase: publishable key no navegador; autorização real por Auth + RLS. */
var SB_URL = '';
var SB_KEY = '';
var _sbClient = null;
var authSession = null;
window.authSession = null;

/* ════════════════════════════════════════════════════════════════
   STORE — dados em memória por tabela
   ════════════════════════════════════════════════════════════════ */
var store = {};       // { tableName: [rows] }
var editingId = null; // id do registro sendo editado (null = novo)
var currentView = 'dashboard';
var currentTable = null;
var confirmCallback = null;
var filterText = {};  // { tableName: '' }
var pageIndex = {};   // { tableName: 0 }
var PAGE_SIZE = 15;

/* ════════════════════════════════════════════════════════════════
   SUPABASE HELPER
   ════════════════════════════════════════════════════════════════ */
async function sbFetch(path, opts) {
  if (!_sbClient || !authSession) return { data: null, error: { message: 'Sessão não autenticada.' } };
  var headers = { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + authSession.access_token, 'Content-Type': 'application/json', 'Prefer': 'return=representation' };
  try {
    var response = await fetch(SB_URL + '/rest/v1/' + path, Object.assign({ headers: headers }, opts || {}));
    if (!response.ok) return { data: null, error: await response.json().catch(function(){return {message:'Erro de banco de dados.'};}) };
    if (response.status === 204) return { data: null, error: null };
    return { data: await response.json(), error: null };
  } catch (error) { return { data: null, error: { message: 'Falha de comunicação com o banco de dados.' } }; }
}
function sbSelect(table, order) { return sbFetch(table + '?select=*&order=' + (order || 'created_at.desc')); }
function sbInsert(table, row) { return sbFetch(table, { method: 'POST', body: JSON.stringify(row) }); }
function sbUpdate(table, id, row) { return sbFetch(table + '?id=eq.' + encodeURIComponent(id), { method: 'PATCH', body: JSON.stringify(row) }); }
function sbDelete(table, id) { return sbFetch(table + '?id=eq.' + encodeURIComponent(id), { method: 'DELETE' }); }

/* ════════════════════════════════════════════════════════════════
   SCHEMA — define campos de cada tabela
   ════════════════════════════════════════════════════════════════ */
var VIEWS = {
  leads: {
    title: 'Leads / Triagem',
    table: 'leads',
    order: 'created_at.desc',
    fields: [
      { key: 'name',       label: 'Nome',         type: 'text',     required: true },
      { key: 'phone',      label: 'Telefone',      type: 'text' },
      { key: 'email',      label: 'E-mail',        type: 'text' },
      { key: 'practice_area', label: 'Área de atuação', type: 'text' },
      { key: 'urgency',    label: 'Urgência',      type: 'select', options: ['urgent','priority','routine'] },
      { key: 'status',     label: 'Status',        type: 'select', options: ['Novo','Contatado','Convertido','Descartado'] },
      { key: 'notes',      label: 'Observações',   type: 'textarea', inTable: false },
      { key: 'created_at', label: 'Data',          type: 'datetime', inTable: true, readOnly: true }
    ],
    tableKeys: ['name','phone','practice_area','urgency','status','created_at']
  },
  clients: {
    title: 'Clientes',
    table: 'clients',
    order: 'name.asc',
    fields: [
      { key: 'name',         label: 'Nome completo',  type: 'text', required: true },
      { key: 'cpf',          label: 'CPF',             type: 'text' },
      { key: 'phone',        label: 'Telefone',        type: 'text' },
      { key: 'email',        label: 'E-mail',          type: 'text' },
      { key: 'address',      label: 'Endereço',        type: 'text', inTable: false },
      { key: 'date_of_birth',label: 'Data de nasc.',   type: 'date', inTable: false },
      { key: 'status',       label: 'Status',          type: 'select', options: ['Ativo','Inativo','Prospecto'] },
      { key: 'notes',        label: 'Observações',     type: 'textarea', inTable: false }
    ],
    tableKeys: ['name','cpf','phone','email','status']
  },
  appointments: {
    title: 'Consultas / Agenda',
    table: 'appointments',
    order: 'date_time.asc',
    fields: [
      { key: 'client_name',  label: 'Cliente',         type: 'text', required: true },
      { key: 'lawyer',       label: 'Advogado',        type: 'text' },
      { key: 'date_time',    label: 'Data e hora',     type: 'datetime', required: true },
      { key: 'type',         label: 'Tipo',            type: 'select', options: ['Consulta inicial','Retorno','Urgência','Videoconferência'] },
      { key: 'status',       label: 'Status',          type: 'select', options: ['Agendado','Confirmado','Realizado','Cancelado'] },
      { key: 'location',     label: 'Local',           type: 'text' },
      { key: 'notes',        label: 'Observações',     type: 'textarea', inTable: false }
    ],
    tableKeys: ['client_name','lawyer','date_time','type','status']
  },
  processes: {
    title: 'Processos',
    table: 'processes',
    order: 'created_at.desc',
    fields: [
      { key: 'process_number', label: 'Nº do Processo',  type: 'text', required: true },
      { key: 'client_name',    label: 'Cliente',          type: 'text', required: true },
      { key: 'crime',          label: 'Crime/Delito',     type: 'text' },
      { key: 'court',          label: 'Vara / Tribunal',  type: 'text' },
      { key: 'judge',          label: 'Juiz(a)',          type: 'text' },
      { key: 'lawyer',         label: 'Advogado resp.',   type: 'text' },
      { key: 'status',         label: 'Status',           type: 'select', options: ['Ativo','Aguardando julgamento','Encerrado','Recurso','Arquivado'] },
      { key: 'phase',          label: 'Fase',             type: 'select', options: ['Inquérito','Denúncia','Instrução','Alegações finais','Sentença','Recurso','Execução'] },
      { key: 'open_date',      label: 'Data abertura',    type: 'date', inTable: false },
      { key: 'notes',          label: 'Observações',      type: 'textarea', inTable: false }
    ],
    tableKeys: ['process_number','client_name','crime','court','lawyer','status']
  },
  deadlines: {
    title: 'Prazos',
    table: 'deadlines',
    order: 'due_date.asc',
    fields: [
      { key: 'title',          label: 'Descrição',        type: 'text', required: true },
      { key: 'process_number', label: 'Nº do Processo',   type: 'text' },
      { key: 'client_name',    label: 'Cliente',          type: 'text' },
      { key: 'lawyer',         label: 'Responsável',      type: 'text' },
      { key: 'due_date',       label: 'Vencimento',       type: 'date', required: true },
      { key: 'type',           label: 'Tipo',             type: 'select', options: ['Prazo processual','Prazo legal','Audiência','Outros'] },
      { key: 'done',           label: 'Concluído',        type: 'checkbox' },
      { key: 'notes',          label: 'Observações',      type: 'textarea', inTable: false }
    ],
    tableKeys: ['title','process_number','client_name','lawyer','due_date','done']
  },
  fees: {
    title: 'Honorários',
    table: 'fees',
    order: 'created_at.desc',
    fields: [
      { key: 'client_name',   label: 'Cliente',            type: 'text', required: true },
      { key: 'process_number',label: 'Nº do Processo',     type: 'text' },
      { key: 'description',   label: 'Descrição',          type: 'text' },
      { key: 'amount',        label: 'Valor (R$)',          type: 'number', required: true },
      { key: 'due_date',      label: 'Vencimento',         type: 'date' },
      { key: 'paid',          label: 'Pago',               type: 'checkbox' },
      { key: 'paid_date',     label: 'Data pagamento',     type: 'date' },
      { key: 'payment_method',label: 'Forma',              type: 'select', options: ['PIX','TED','Boleto','Dinheiro','Cartão'] },
      { key: 'notes',         label: 'Observações',        type: 'textarea', inTable: false }
    ],
    tableKeys: ['client_name','description','amount','due_date','paid','payment_method']
  },
  powers_of_attorney: {
    title: 'Procurações',
    table: 'powers_of_attorney',
    order: 'created_at.desc',
    fields: [
      { key: 'client_name',  label: 'Cliente',           type: 'text', required: true },
      { key: 'lawyer',       label: 'Advogado',          type: 'text' },
      { key: 'scope',        label: 'Poderes',           type: 'select', options: ['Ad judicia','Ad negocia','Plenos','Especiais'] },
      { key: 'issued_date',  label: 'Data emissão',      type: 'date' },
      { key: 'expiry_date',  label: 'Validade',          type: 'date' },
      { key: 'notarized',    label: 'Reconhecida firma', type: 'checkbox' },
      { key: 'notes',        label: 'Observações',       type: 'textarea', inTable: false }
    ],
    tableKeys: ['client_name','lawyer','scope','issued_date','expiry_date','notarized']
  },
  case_movements: {
    title: 'Movimentações Processuais',
    table: 'case_movements',
    order: 'date.desc',
    fields: [
      { key: 'process_number', label: 'Nº do Processo', type: 'text', required: true },
      { key: 'client_name',    label: 'Cliente',        type: 'text' },
      { key: 'date',           label: 'Data',           type: 'date', required: true },
      { key: 'type',           label: 'Tipo',           type: 'select', options: ['Despacho','Decisão','Sentença','Acórdão','Citação','Intimação','Juntada','Outros'] },
      { key: 'description',    label: 'Descrição',      type: 'text', required: true },
      { key: 'lawyer',         label: 'Advogado resp.', type: 'text' },
      { key: 'notes',          label: 'Observações',    type: 'textarea', inTable: false }
    ],
    tableKeys: ['process_number','date','type','description','lawyer']
  }
};

async function showApp() {
  if (document.getElementById('app').classList.contains('visible')) return;
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').classList.add('visible');
  loadAllData();
  navigateTo('dashboard');
}

async function verifyMembershipAndShow() {
  var membership = await sbFetch('firm_memberships?select=id&limit=1');
  if (membership.error || !membership.data || membership.data.length === 0) {
    await _sbClient.auth.signOut(); authSession = null; window.authSession = null;
    var err = document.getElementById('login-error');
    err.textContent = 'Conta sem vínculo ativo com um escritório. Solicite a liberação ao administrador.'; err.style.display = 'block';
    document.getElementById('login-screen').style.display = 'flex'; document.getElementById('app').classList.remove('visible'); return;
  }
  showApp();
}
async function initializeAuth() {
  try {
    var response = await fetch('/api/config', {cache:'no-store'});
    if (!response.ok) throw new Error('Supabase não configurado. Defina as variáveis de ambiente na Vercel.');
    var config = await response.json(); SB_URL = config.url; SB_KEY = config.key;
    if (!window.supabase || !window.supabase.createClient) throw new Error('Biblioteca de autenticação indisponível.');
    _sbClient = window.supabase.createClient(SB_URL, SB_KEY, {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    var result = await _sbClient.auth.getSession(); authSession = result.data.session; window.authSession = authSession;
    if (authSession) await verifyMembershipAndShow();
    _sbClient.auth.onAuthStateChange(function(_event, session) { authSession=session; window.authSession=session; if(session) setTimeout(verifyMembershipAndShow,0); else { document.getElementById('app').classList.remove('visible'); document.getElementById('login-screen').style.display='flex'; } });
  } catch(error) { var el=document.getElementById('login-error'); el.textContent=error.message || 'Falha ao inicializar autenticação.'; el.style.display='block'; }
}
document.getElementById('toggle-pass').addEventListener('click', function() {
  var input=document.getElementById('login-pass'), show=document.getElementById('eye-show'), hide=document.getElementById('eye-hide');
  if(input.type==='password'){input.type='text';show.style.display='none';hide.style.display='';this.setAttribute('aria-label','Ocultar senha');}
  else{input.type='password';show.style.display='';hide.style.display='none';this.setAttribute('aria-label','Mostrar senha');}
});
document.getElementById('login-form').addEventListener('submit', async function(e) {
  e.preventDefault(); var email=document.getElementById('login-email').value.trim(), password=document.getElementById('login-pass').value;
  var btn=e.target.querySelector('button[type="submit"]'), error=document.getElementById('login-error'); error.style.display='none';
  if(!_sbClient){error.textContent='Autenticação indisponível. Verifique a configuração do Supabase.';error.style.display='block';return;}
  if(btn){btn.disabled=true;btn.textContent='Autenticando…';}
  try { var result=await _sbClient.auth.signInWithPassword({email:email,password:password}); if(result.error) throw result.error; authSession=result.data.session; window.authSession=authSession; await verifyMembershipAndShow(); }
  catch(_error){error.textContent='Não foi possível autenticar. Confira e-mail, senha e status da conta.';error.style.display='block';document.getElementById('login-pass').value='';}
  finally{if(btn){btn.disabled=false;btn.textContent='Entrar';}}
});
document.getElementById('logout-btn').addEventListener('click', async function(){if(_sbClient) await _sbClient.auth.signOut();authSession=null;window.authSession=null;document.getElementById('app').classList.remove('visible');document.getElementById('login-screen').style.display='flex';});

/* ════════════════════════════════════════════════════════════════
   DATA LOADING
   ════════════════════════════════════════════════════════════════ */
function loadAllData() {
  Object.keys(VIEWS).forEach(function(key) {
    var v = VIEWS[key];
    sbSelect(v.table, v.order).then(function(res) {
      store[v.table] = res.data || [];
      updateBadges();
      if (currentView === key || currentView === 'dashboard') renderView(currentView);
    });
  });
}

function loadTable(tableName, order) {
  var v = findView(tableName);
  return sbSelect(tableName, order || (v && v.order) || 'created_at.desc').then(function(res) {
    store[tableName] = res.data || [];
    return store[tableName];
  });
}

function findView(tableName) {
  return Object.values(VIEWS).find(function(v) { return v.table === tableName; });
}

function updateBadges() {
  var leads = store['leads'] || [];
  var newLeads = leads.filter(function(r) { return r.status === 'Novo' || !r.status; }).length;
  var badge = document.getElementById('badge-leads');
  if (badge) { badge.textContent = newLeads > 0 ? newLeads : ''; badge.style.display = newLeads > 0 ? '' : 'none'; }

  var today = new Date(); today.setHours(0,0,0,0);
  var tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate()+1);
  var appts = (store['appointments'] || []).filter(function(r) {
    if (r.status === 'Cancelado' || r.status === 'Realizado') return false;
    var d = new Date(r.date_time);
    return d >= today && d < new Date(today.getTime() + 7*86400000);
  });
  var ab = document.getElementById('badge-appts');
  if (ab) { ab.textContent = appts.length > 0 ? appts.length : ''; ab.style.display = appts.length > 0 ? '' : 'none'; }

  var deadlines = (store['deadlines'] || []).filter(function(r) {
    if (r.done) return false;
    var d = new Date(r.due_date + 'T00:00:00');
    return d <= tomorrow;
  });
  var db = document.getElementById('badge-deadlines');
  if (db) { db.textContent = deadlines.length > 0 ? deadlines.length : ''; db.style.display = deadlines.length > 0 ? '' : 'none'; }
}

/* ════════════════════════════════════════════════════════════════
   NAVIGATION
   ════════════════════════════════════════════════════════════════ */
document.querySelectorAll('.nav-item[data-view]').forEach(function(btn) {
  btn.addEventListener('click', function() {
    navigateTo(btn.getAttribute('data-view'));
    closeMobileMenu();
  });
});

function navigateTo(view) {
  currentView = view;
  document.querySelectorAll('.nav-item').forEach(function(b) {
    b.classList.toggle('active', b.getAttribute('data-view') === view);
  });
  var addBtn = document.getElementById('add-btn');
  if (view === 'dashboard') {
    addBtn.style.display = 'none';
    document.getElementById('view-title').textContent = 'Dashboard';
  } else if (view === 'ia_juridica') {
    addBtn.style.display = 'none';
    document.getElementById('view-title').textContent = 'IA Jurídica';
  } else {
    var cfg = VIEWS[view];
    if (cfg) {
      addBtn.style.display = '';
      addBtn.onclick = function() { openDrawer(cfg, null); };
      document.getElementById('view-title').textContent = cfg.title;
      currentTable = cfg.table;
      if (!store[cfg.table]) {
        store[cfg.table] = [];
        loadTable(cfg.table).then(function() { renderView(view); });
      }
    }
  }
  renderView(view);
}

/* ════════════════════════════════════════════════════════════════
   RENDER DASHBOARD
   ════════════════════════════════════════════════════════════════ */
function renderDashboard() {
  var leads     = store['leads'] || [];
  var clients   = store['clients'] || [];
  var appts     = store['appointments'] || [];
  var procs     = store['processes'] || [];
  var deadlines = store['deadlines'] || [];
  var fees      = store['fees'] || [];

  var today = new Date(); today.setHours(0,0,0,0);
  var tomorrow = new Date(today); tomorrow.setDate(today.getDate()+1);

  var newLeads   = leads.filter(function(r) { return r.status === 'Novo' || !r.status; }).length;
  var todayAppts = appts.filter(function(r) {
    var d = new Date(r.date_time); d.setHours(0,0,0,0);
    return d.getTime() === today.getTime();
  }).length;
  var urgDead    = deadlines.filter(function(r) { return !r.done && new Date(r.due_date+'T00:00:00') <= tomorrow; }).length;
  var unpaid     = fees.filter(function(r) { return !r.paid; }).length;
  var activeProcs= procs.filter(function(r) { return r.status === 'Ativo'; }).length;

  var recentLeads = leads.slice(0,5).map(function(r) {
    return '<tr><td style="color:var(--text)">' + esc(r.name || '—') + '</td>'
      + '<td>' + esc(r.phone || '—') + '</td>'
      + '<td>' + esc(r.practice_area || '—') + '</td>'
      + '<td><span class="status ' + statusClass(r.status) + '">' + (r.status || 'Novo') + '</span></td>'
      + '<td>' + fmtDate(r.created_at) + '</td>'
      + '<td><div class="td-actions">'
      + '<button class="btn btn-outline btn-sm" data-action="edit" data-table="leads" data-id="' + esc(r.id) + '">Editar</button>'
      + '</div></td></tr>';
  }).join('');

  var nextAppts = appts.filter(function(r) {
    return r.status !== 'Cancelado' && r.status !== 'Realizado';
  }).slice(0,5).map(function(r) {
    return '<tr><td style="color:var(--text)">' + esc(r.client_name || '—') + '</td>'
      + '<td>' + esc(r.lawyer || '—') + '</td>'
      + '<td>' + fmtDatetime(r.date_time) + '</td>'
      + '<td><span class="status ' + statusClass(r.status) + '">' + esc(r.status || '') + '</span></td></tr>';
  }).join('');

  var urgDeadlines = deadlines.filter(function(r) {
    return !r.done && new Date(r.due_date+'T00:00:00') <= new Date(today.getTime() + 7*86400000);
  }).slice(0,5).map(function(r) {
    var d = new Date(r.due_date+'T00:00:00');
    var diff = Math.ceil((d - today) / 86400000);
    var cls = diff <= 0 ? 'status-urgente' : diff <= 2 ? 'status-aberto' : 'status-aguardando';
    var label = diff <= 0 ? 'Vencido' : diff === 1 ? 'Amanhã' : 'Em ' + diff + 'd';
    return '<tr><td style="color:var(--text)">' + esc(r.title || '—') + '</td>'
      + '<td>' + esc(r.process_number || '—') + '</td>'
      + '<td>' + esc(r.lawyer || '—') + '</td>'
      + '<td>' + fmtDate(r.due_date) + '</td>'
      + '<td><span class="status ' + cls + '">' + label + '</span></td></tr>';
  }).join('');

  return '<div class="kpi-row">'
    + kpi('Novos Leads', newLeads, 'Aguardando contato', '', svgIcon('users'))
    + kpi('Consultas Hoje', todayAppts, 'Agendamentos do dia', 'success', svgIcon('calendar'))
    + kpi('Prazos Urgentes', urgDead, 'Vencidos ou amanhã', urgDead > 0 ? 'danger' : 'success', svgIcon('clock'))
    + kpi('Processos Ativos', activeProcs, 'Em andamento', '', svgIcon('file'))
    + '</div>'
    + section('Leads Recentes', recentLeads
        ? '<div class="table-wrap"><table><thead><tr><th>Nome</th><th>Telefone</th><th>Situação</th><th>Status</th><th>Data</th><th></th></tr></thead><tbody>' + recentLeads + '</tbody></table></div>'
        : emptyState('Nenhum lead registrado.'),
      '<button class="btn btn-outline btn-sm" data-action="navigate" data-view="leads">Ver todos</button>')
    + section('Próximas Consultas', nextAppts
        ? '<div class="table-wrap"><table><thead><tr><th>Cliente</th><th>Advogado</th><th>Data/Hora</th><th>Status</th></tr></thead><tbody>' + nextAppts + '</tbody></table></div>'
        : emptyState('Nenhuma consulta agendada.'),
      '<button class="btn btn-outline btn-sm" data-action="navigate" data-view="appointments">Ver todos</button>')
    + section('Prazos Urgentes', urgDeadlines
        ? '<div class="table-wrap"><table><thead><tr><th>Prazo</th><th>Processo</th><th>Responsável</th><th>Vencimento</th><th></th></tr></thead><tbody>' + urgDeadlines + '</tbody></table></div>'
        : emptyState('Nenhum prazo urgente. ✓'),
      '<button class="btn btn-outline btn-sm" data-action="navigate" data-view="deadlines">Ver todos</button>');
}

function kpi(label, value, sub, type, icon) {
  return '<div class="kpi-card ' + (type||'') + '">'
    + '<div class="kpi-label">' + label + '</div>'
    + '<div class="kpi-value">' + value + '</div>'
    + '<div class="kpi-sub">' + sub + '</div>'
    + '<div class="kpi-icon">' + icon + '</div>'
    + '</div>';
}

function section(title, content, action) {
  return '<div style="margin-bottom:28px">'
    + '<div class="section-head"><span class="section-label">' + title + '</span>'
    + (action ? action : '')
    + '</div>' + content + '</div>';
}

function emptyState(msg) {
  return '<div class="empty-state"><p>' + msg + '</p></div>';
}

/* ────────────────────────────────────────────────────────────────
   GOOGLE CALENDAR HELPER
   ────────────────────────────────────────────────────────────────
   Generates a pre-filled calendar.google.com link for an appointment
   row. Works for any record that has a date_time field.
*/
function gcalLink(r) {
  if (!r.date_time) return '';
  try {
    var start = new Date(r.date_time);
    var end   = new Date(start.getTime() + 60 * 60 * 1000); // +1h
    function fmt(d) {
      return d.toISOString().replace(/[-:]/g,'').split('.')[0] + 'Z';
    }
    var title    = encodeURIComponent('B&P – ' + (r.type || 'Consulta') + (r.client_name ? ' – ' + r.client_name : ''));
    var details  = encodeURIComponent(
      (r.lawyer  ? 'Advogado: ' + r.lawyer + '\n' : '') +
      (r.status  ? 'Status: '   + r.status + '\n' : '') +
      (r.notes   ? 'Obs: '      + r.notes         : '')
    );
    var location = encodeURIComponent(r.location || 'B&P Advocacia Criminal');
    var dates    = fmt(start) + '/' + fmt(end);
    return 'https://calendar.google.com/calendar/render?action=TEMPLATE'
      + '&text='     + title
      + '&dates='    + dates
      + '&details='  + details
      + '&location=' + location;
  } catch(e) { return ''; }
}

/* ════════════════════════════════════════════════════════════════
   RENDER TABLE VIEW
   ════════════════════════════════════════════════════════════════ */
function renderTableView(viewKey) {
  var cfg = VIEWS[viewKey];
  if (!cfg) return '<p style="color:var(--text-3)">Módulo não encontrado.</p>';
  var rows = store[cfg.table] || [];
  var term = (filterText[cfg.table] || '').toLowerCase().trim();
  var cols = cfg.fields.filter(function(f) { return cfg.tableKeys.indexOf(f.key) !== -1; });

  var filtered = term ? rows.filter(function(r) {
    return cols.some(function(c) { return String(r[c.key]||'').toLowerCase().includes(term); });
  }) : rows;

  var page = pageIndex[cfg.table] || 0;
  var total = filtered.length;
  var pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  page = Math.min(page, pages - 1);
  pageIndex[cfg.table] = page;
  var visible = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  var head = cols.map(function(c) { return '<th>' + c.label + '</th>'; }).join('') + '<th style="width:120px"></th>';

  var body = visible.length === 0
    ? '<tr><td colspan="' + (cols.length+1) + '" style="padding:40px;text-align:center;color:var(--text-3)">Nenhum registro encontrado.</td></tr>'
    : visible.map(function(r) {
        var cells = cols.map(function(c) {
          var val = r[c.key];
          if (c.type === 'checkbox') return '<td><span class="status ' + (val ? 'status-ok' : 'status-encerrado') + '">' + (val ? 'Sim' : 'Não') + '</span></td>';
          if (c.type === 'datetime') return '<td>' + fmtDatetime(val) + '</td>';
          if (c.type === 'date') return '<td>' + fmtDate(val) + '</td>';
          if (c.key === 'status') return '<td><span class="status ' + statusClass(val) + '">' + esc(val||'—') + '</span></td>';
          if (c.key === 'urgency') return '<td><span class="status ' + urgencyClass(val) + '">' + esc(val||'—') + '</span></td>';
          return '<td title="' + esc(String(val||'')) + '">' + esc(String(val===null||val===undefined?'—':val)) + '</td>';
        }).join('');
        var calBtn = '';
        if (cfg.table === 'appointments') {
          var cal = gcalLink(r);
          if (cal) calBtn = '<a class="btn btn-outline btn-sm" href="' + cal + '" target="_blank" rel="noopener" title="Adicionar ao Google Calendar" style="text-decoration:none">📅</a>';
        }
        return '<tr>' + cells
          + '<td><div class="td-actions">'
          + calBtn
          + '<button class="btn btn-outline btn-sm" data-action="edit" data-table="' + esc(cfg.table) + '" data-id="' + esc(r.id) + '">Editar</button>'
          + '<button class="btn btn-danger btn-sm" data-action="delete" data-table="' + esc(cfg.table) + '" data-id="' + esc(r.id) + '">Excluir</button>'
          + '</div></td></tr>';
      }).join('');

  var paginationInfo = 'Mostrando ' + (total === 0 ? 0 : page*PAGE_SIZE+1) + '–' + Math.min((page+1)*PAGE_SIZE, total) + ' de ' + total;
  var pageButtons = '';
  for (var i = 0; i < pages; i++) {
    pageButtons += '<button class="page-btn ' + (i===page?'active':'') + '" data-action="page" data-table="' + esc(cfg.table) + '" data-index="' + i + '">' + (i+1) + '</button>';
  }

  return '<div class="section-head">'
    + '<div class="section-head-left">'
    + '<input class="search-input" type="search" placeholder="Buscar…" value="' + esc(filterText[cfg.table]||'') + '" data-action="search" data-table="' + esc(cfg.table) + '">'
    + '<span class="section-label">' + total + ' registro' + (total!==1?'s':'') + '</span>'
    + '</div>'
    + '</div>'
    + '<div class="table-wrap"><table><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table></div>'
    + '<div class="pagination"><span>' + paginationInfo + '</span><div class="page-btns">' + pageButtons + '</div></div>';
}

/* ════════════════════════════════════════════════════════════════
   RENDER VIEW DISPATCHER
   ════════════════════════════════════════════════════════════════ */
var adminActionRoot = document.getElementById('view-area');
adminActionRoot.addEventListener('click', function(event) {
  var control = event.target.closest('[data-action]'); if (!control) return;
  var action = control.getAttribute('data-action');
  var table = control.getAttribute('data-table');
  if (action === 'edit') editRecord(table, control.getAttribute('data-id'));
  else if (action === 'delete') deleteRecord(table, control.getAttribute('data-id'));
  else if (action === 'navigate') navigateTo(control.getAttribute('data-view'));
  else if (action === 'page') goPage(table, Number(control.getAttribute('data-index')));
});
adminActionRoot.addEventListener('input', function(event) {
  var control = event.target.closest('[data-action="search"]');
  if (control) onSearch(control.getAttribute('data-table'), control.value);
});

function renderView(view) {
  var area = document.getElementById('view-area');
  if (view === 'dashboard') {
    area.innerHTML = renderDashboard();
  } else if (view === 'ia_juridica') {
    area.innerHTML = renderIAJuridica();
  } else if (VIEWS[view]) {
    area.innerHTML = renderTableView(view);
  }
}

/* IA jurídica foi desativada nesta entrega. Não enviar chaves de provedores nem dados de casos do browser. */
function renderIAJuridica(){return '<div class="ia-card"><h3 class="ia-card-title">Assistente jurídico desativado</h3><p class="ia-hint">A integração será reativada somente por backend autenticado, com segredos server-side, controle de acesso e política de tratamento de dados.</p></div>';}

function onSearch(table, val) {
  filterText[table] = val;
  pageIndex[table] = 0;
  renderView(currentView);
}

function goPage(table, idx) {
  pageIndex[table] = idx;
  renderView(currentView);
}

/* ════════════════════════════════════════════════════════════════
   DRAWER — ADD / EDIT
   ════════════════════════════════════════════════════════════════ */
function openDrawer(cfg, row) {
  editingId = row ? row.id : null;
  var isNew = !row;
  document.getElementById('drawer-title').textContent = isNew ? 'Novo — ' + cfg.title : 'Editar — ' + cfg.title;

  var html = '';
  var midpoint = Math.ceil(cfg.fields.filter(function(f) { return !f.readOnly; }).length / 2);
  var editableFields = cfg.fields.filter(function(f) { return !f.readOnly; });

  editableFields.forEach(function(f) {
    var val = row ? (row[f.key] !== null && row[f.key] !== undefined ? row[f.key] : '') : '';
    html += '<div class="form-group">';
    html += '<label class="form-label" for="f-' + f.key + '">' + f.label + (f.required ? ' *' : '') + '</label>';
    if (f.type === 'textarea') {
      html += '<textarea class="form-textarea" id="f-' + f.key + '" name="' + f.key + '" rows="3">' + esc(String(val)) + '</textarea>';
    } else if (f.type === 'select') {
      html += '<select class="form-select" id="f-' + f.key + '" name="' + f.key + '">';
      html += '<option value="">— Selecione —</option>';
      (f.options || []).forEach(function(o) {
        html += '<option value="' + esc(o) + '"' + (String(val) === o ? ' selected' : '') + '>' + esc(o) + '</option>';
      });
      html += '</select>';
    } else if (f.type === 'checkbox') {
      html += '<div class="form-checkbox-group"><input type="checkbox" id="f-' + f.key + '" name="' + f.key + '"' + (val ? ' checked' : '') + '><label for="f-' + f.key + '">' + f.label + '</label></div>';
    } else if (f.type === 'date') {
      var dval = val ? String(val).slice(0,10) : '';
      html += '<input class="form-input" type="date" id="f-' + f.key + '" name="' + f.key + '" value="' + esc(dval) + '"' + (f.required ? ' required' : '') + '>';
    } else if (f.type === 'datetime') {
      var dtval = '';
      if (val) { try { var dt = new Date(val); dtval = new Date(dt.getTime() - dt.getTimezoneOffset()*60000).toISOString().slice(0,16); } catch(e){} }
      html += '<input class="form-input" type="datetime-local" id="f-' + f.key + '" name="' + f.key + '" value="' + esc(dtval) + '"' + (f.required ? ' required' : '') + '>';
    } else if (f.type === 'number') {
      html += '<input class="form-input" type="number" id="f-' + f.key + '" name="' + f.key + '" value="' + esc(String(val)) + '" min="0" step="0.01"' + (f.required ? ' required' : '') + '>';
    } else {
      html += '<input class="form-input" type="text" id="f-' + f.key + '" name="' + f.key + '" value="' + esc(String(val)) + '" maxlength="300"' + (f.required ? ' required' : '') + '>';
    }
    html += '</div>';
  });

  document.getElementById('drawer-body').innerHTML = html;
  document.getElementById('drawer-overlay').classList.add('open');
  document.getElementById('drawer-save').onclick = function() { saveDrawer(cfg); };

  // autofocus first input
  setTimeout(function() {
    var first = document.querySelector('#drawer-body input, #drawer-body textarea, #drawer-body select');
    if (first) first.focus();
  }, 60);
}

function closeDrawer() {
  document.getElementById('drawer-overlay').classList.remove('open');
  editingId = null;
}

document.getElementById('drawer-close').addEventListener('click', closeDrawer);
document.getElementById('drawer-cancel').addEventListener('click', closeDrawer);
document.getElementById('drawer-overlay').addEventListener('click', function(e) {
  if (e.target === this) closeDrawer();
});

function saveDrawer(cfg) {
  var saveBtn = document.getElementById('drawer-save');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Salvando…';

  var payload = {};
  cfg.fields.filter(function(f) { return !f.readOnly; }).forEach(function(f) {
    var el = document.getElementById('f-' + f.key);
    if (!el) return;
    if (f.type === 'checkbox') { payload[f.key] = el.checked; return; }
    var raw = el.value.trim();
    if (f.type === 'datetime') { payload[f.key] = raw ? new Date(raw).toISOString() : null; return; }
    payload[f.key] = raw === '' ? null : raw;
  });

  var p = editingId
    ? sbUpdate(cfg.table, editingId, payload)
    : sbInsert(cfg.table, payload);

  p.then(function(res) {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Salvar';
    if (res.error) { toast('Erro: ' + (res.error.message || 'verifique os campos'), 'error'); return; }
    toast('Salvo com sucesso', 'success');
    closeDrawer();
    loadTable(cfg.table).then(function() {
      updateBadges();
      renderView(currentView);
    });
  });
}

/* ════════════════════════════════════════════════════════════════
   EDIT / DELETE
   ════════════════════════════════════════════════════════════════ */
function editRecord(table, id) {
  var cfg = Object.values(VIEWS).find(function(v) { return v.table === table; });
  var row = (store[table] || []).find(function(r) { return String(r.id) === String(id); });
  if (cfg && row) openDrawer(cfg, row);
}
window.editRecord = editRecord;

function deleteRecord(table, id) {
  var cfg = Object.values(VIEWS).find(function(v) { return v.table === table; });
  openConfirm(
    'Excluir registro',
    'Este registro será excluído permanentemente. Deseja continuar?',
    function() {
      sbDelete(table, id).then(function(res) {
        if (res.error) { toast('Erro ao excluir: ' + res.error.message, 'error'); return; }
        toast('Excluído', 'success');
        loadTable(table).then(function() {
          updateBadges();
          renderView(currentView);
        });
      });
    }
  );
}
window.deleteRecord = deleteRecord;

/* ════════════════════════════════════════════════════════════════
   CONFIRM DIALOG
   ════════════════════════════════════════════════════════════════ */
function openConfirm(title, msg, callback) {
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-msg').textContent = msg;
  confirmCallback = callback;
  document.getElementById('confirm-overlay').classList.add('open');
}

document.getElementById('confirm-ok').addEventListener('click', function() {
  document.getElementById('confirm-overlay').classList.remove('open');
  if (confirmCallback) { confirmCallback(); confirmCallback = null; }
});
document.getElementById('confirm-cancel').addEventListener('click', function() {
  document.getElementById('confirm-overlay').classList.remove('open');
  confirmCallback = null;
});

/* ════════════════════════════════════════════════════════════════
   TOAST
   ════════════════════════════════════════════════════════════════ */
function toast(msg, type) {
  var c = document.getElementById('toast-container');
  var t = document.createElement('div');
  t.className = 'toast ' + (type || '');
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(function() { if (t.parentNode) t.parentNode.removeChild(t); }, 3500);
}

/* ════════════════════════════════════════════════════════════════
   MOBILE SIDEBAR
   ════════════════════════════════════════════════════════════════ */
document.getElementById('mob-menu-btn').addEventListener('click', function() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('mob-overlay').classList.toggle('open');
});
document.getElementById('mob-overlay').addEventListener('click', closeMobileMenu);
function closeMobileMenu() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('mob-overlay').classList.remove('open');
}

/* ════════════════════════════════════════════════════════════════
   HELPERS
   ════════════════════════════════════════════════════════════════ */
function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

function fmtDate(v) {
  if (!v) return '—';
  try {
    var d = new Date(String(v).slice(0,10) + 'T00:00:00');
    return d.toLocaleDateString('pt-BR');
  } catch(e) { return String(v); }
}

function fmtDatetime(v) {
  if (!v) return '—';
  try {
    return new Date(v).toLocaleString('pt-BR', { dateStyle:'short', timeStyle:'short' });
  } catch(e) { return String(v); }
}

function statusClass(s) {
  var map = { 'Novo':'status-novo','novo':'status-novo','Ativo':'status-ok','ativo':'status-ok',
    'Aberto':'status-aberto','aberto':'status-aberto','Agendado':'status-aberto',
    'Urgência':'status-urgente','Alta':'status-urgente',
    'Confirmado':'status-ok','Realizado':'status-ok','Convertido':'status-ok','Pago':'status-ok',
    'Contatado':'status-aguardando','Aguardando julgamento':'status-aguardando','Média':'status-aguardando',
    'Cancelado':'status-encerrado','Inativo':'status-encerrado','Encerrado':'status-encerrado',
    'Descartado':'status-encerrado','Arquivado':'status-encerrado','Baixa':'status-encerrado' };
  return Object.prototype.hasOwnProperty.call(map, s) ? map[s] : 'status-aberto';
}

function urgencyClass(s) {
  if (s === 'urgent') return 'status-urgente';
  if (s === 'priority') return 'status-aguardando';
  return 'status-encerrado';
}

function svgIcon(name) {
  var icons = {
    users: '<svg width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>',
    calendar: '<svg width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
    clock: '<svg width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
    file: '<svg width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>'
  };
  return icons[name] || '';
}

/* ════════════════════════════════════════════════════════════════
   NOTE: Supabase não configurado
   Mostre banner se SB_URL estiver vazio
   ════════════════════════════════════════════════════════════════ */
['ia_key_claude','ia_key_openai','ia_key_gemini','ia_key_deepseek'].forEach(function(k){try{localStorage.removeItem(k);}catch(e){}});
initializeAuth();
