/* Supabase: publishable key no navegador; autorização real por Auth + RLS. */
var SB_URL = '';
var SB_KEY = '';
var _sbClient = null;
var authSession = null;
var currentTenantId = '';
var currentRole = 'viewer';
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
function sbSelect(table, order, query) { return sbFetch(table + '?select=*&tenant_id=eq.' + encodeURIComponent(currentTenantId) + (query ? '&' + query : '') + '&order=' + (order || 'created_at.desc') + '&limit=1000'); }
function sbInsert(table, row) { return sbFetch(table, { method: 'POST', body: JSON.stringify(row) }); }
function sbUpdate(table, id, row) { return sbFetch(table + '?tenant_id=eq.' + encodeURIComponent(currentTenantId) + '&id=eq.' + encodeURIComponent(id), { method: 'PATCH', body: JSON.stringify(row) }); }
function sbDelete(table, id) { return sbFetch(table + '?tenant_id=eq.' + encodeURIComponent(currentTenantId) + '&id=eq.' + encodeURIComponent(id), { method: 'DELETE' }); }

/* ════════════════════════════════════════════════════════════════
   SCHEMA — define campos de cada tabela
   ════════════════════════════════════════════════════════════════ */
var VIEWS = {
  leads: { title:'Leads / Triagem', table:'customers', query:'status=eq.lead', order:'created_at.desc', entity:'lead', fields:[
    {key:'full_name',label:'Nome',type:'text',required:true},{key:'phone_e164',label:'Telefone',type:'text'},{key:'email',label:'E-mail',type:'text'},
    {key:'lead_practice_area',label:'Área informada',type:'text'},{key:'lead_urgency',label:'Urgência',type:'select',options:['urgent','priority','routine']},{key:'status',label:'Status',type:'select',options:['lead','active','inactive','blocked']},{key:'created_at',label:'Data',type:'datetime',readOnly:true}
  ], tableKeys:['full_name','phone_e164','lead_practice_area','lead_urgency','status','created_at']},
  clients: { title:'Clientes', table:'customers', query:'status=in.(active,inactive,blocked)', order:'full_name.asc', entity:'client', fields:[
    {key:'full_name',label:'Nome completo',type:'text',required:true},{key:'phone_e164',label:'Telefone',type:'text'},{key:'email',label:'E-mail',type:'text'},
    {key:'status',label:'Status',type:'select',options:['active','inactive','blocked']},{key:'consent_status',label:'Consentimento',type:'select',options:['unknown','opted_in','opted_out']},{key:'notes',label:'Observações',type:'textarea',inTable:false}
  ], tableKeys:['full_name','phone_e164','email','status','consent_status']},
  appointments: { title:'Agenda', table:'legal_appointments', order:'starts_at.asc', fields:[
    {key:'title',label:'Título',type:'text',required:true},{key:'starts_at',label:'Data e hora',type:'datetime',required:true},{key:'kind',label:'Tipo',type:'select',options:['initial_consultation','follow_up','urgency','video','hearing','other']},{key:'status',label:'Status',type:'select',options:['scheduled','confirmed','completed','cancelled']},{key:'location',label:'Local',type:'text'},{key:'notes',label:'Observações',type:'textarea',inTable:false}
  ], tableKeys:['title','starts_at','kind','status','location']},
  legal_cases: { title:'Processos', table:'legal_cases', order:'updated_at.desc', fields:[
    {key:'title',label:'Caso',type:'text',required:true},{key:'process_number',label:'Nº do processo',type:'text'},{key:'crime',label:'Crime/Delito',type:'text'},{key:'court',label:'Vara / Tribunal',type:'text'},{key:'status',label:'Status',type:'select',options:['active','awaiting_judgment','closed','appeal','archived']},{key:'phase',label:'Fase',type:'select',options:['investigation','indictment','instruction','closing_arguments','sentence','appeal','execution']},{key:'notes',label:'Observações',type:'textarea',inTable:false}
  ], tableKeys:['title','process_number','crime','court','status','phase']},
  legal_deadlines: { title:'Prazos', table:'legal_deadlines', order:'due_at.asc', fields:[
    {key:'title',label:'Descrição',type:'text',required:true},{key:'due_at',label:'Vencimento',type:'datetime',required:true},{key:'kind',label:'Tipo',type:'select',options:['processual','legal','hearing','other']},{key:'completed_at',label:'Concluído em',type:'datetime'},{key:'notes',label:'Observações',type:'textarea',inTable:false}
  ], tableKeys:['title','due_at','kind','completed_at']},
  legal_case_movements: { title:'Movimentações', table:'legal_case_movements', order:'moved_on.desc', fields:[
    {key:'process_number',label:'Nº do processo',type:'text'},{key:'moved_on',label:'Data',type:'date',required:true},{key:'kind',label:'Tipo',type:'select',options:['order','decision','sentence','judgment','service','filing','citation','other']},{key:'description',label:'Descrição',type:'text',required:true},{key:'notes',label:'Observações',type:'textarea',inTable:false}
  ], tableKeys:['process_number','moved_on','kind','description']},
  legal_fees: { title:'Honorários', table:'legal_fees', order:'created_at.desc', fields:[
    {key:'description',label:'Descrição',type:'text',required:true},{key:'amount_cents',label:'Valor (centavos)',type:'number',required:true},{key:'due_on',label:'Vencimento',type:'date'},{key:'paid_at',label:'Pago em',type:'datetime'},{key:'payment_method',label:'Forma',type:'select',options:['pix','ted','boleto','cash','card','other']},{key:'notes',label:'Observações',type:'textarea',inTable:false}
  ], tableKeys:['description','amount_cents','due_on','paid_at','payment_method']},
  legal_powers_of_attorney: { title:'Procurações', table:'legal_powers_of_attorney', order:'created_at.desc', fields:[
    {key:'scope',label:'Poderes',type:'select',options:['ad_judicia','ad_negocia','full','special']},{key:'issued_on',label:'Emissão',type:'date'},{key:'expires_on',label:'Validade',type:'date'},{key:'notarized',label:'Firma reconhecida',type:'checkbox'},{key:'notes',label:'Observações',type:'textarea',inTable:false}
  ], tableKeys:['scope','issued_on','expires_on','notarized']},
  legal_contact_events: { title:'Contatos seguros', table:'legal_contact_events', order:'created_at.desc', readOnly:true, fields:[
    {key:'channel',label:'Canal',type:'text'},{key:'direction',label:'Direção',type:'text'},{key:'event_type',label:'Tipo',type:'text'},{key:'safe_summary',label:'Resumo operacional',type:'text'},{key:'created_at',label:'Data',type:'datetime',readOnly:true}
  ], tableKeys:['channel','direction','event_type','safe_summary','created_at']}
};
async function showApp() {
  if (document.getElementById('app').classList.contains('visible')) return;
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').classList.add('visible');
  loadAllData();
  navigateTo('dashboard');
  if(authSession.user.user_metadata&&authSession.user.user_metadata.temporary_test_account)toast('Conta de teste: troque a senha em Minha conta antes do uso real.','error');
}

async function verifyMembershipAndShow() {
  var membership = await sbFetch('tenant_members?select=tenant_id,role&user_id=eq.' + encodeURIComponent(authSession.user.id) + '&order=created_at.asc&limit=100');
  if (membership.error || !membership.data || membership.data.length === 0) {
    await _sbClient.auth.signOut(); authSession = null; window.authSession = null;
    var err = document.getElementById('login-error');
    err.textContent = 'Conta sem vínculo ativo com um escritório. Solicite a liberação ao administrador.'; err.style.display = 'block';
    document.getElementById('login-screen').style.display = 'flex'; document.getElementById('app').classList.remove('visible'); return;
  }
  currentTenantId = membership.data[0].tenant_id; currentRole = membership.data[0].role || 'viewer';
  applyRoleVisibility();
  showApp();
}
function applyRoleVisibility() {
  document.querySelectorAll('[data-view=\"legal_fees\"]').forEach(function(el) { el.hidden = !['owner','admin','manager'].includes(currentRole);el.style.display=el.hidden?'none':''; });
  document.querySelectorAll('[data-view=\"ia_juridica\"]').forEach(function(el) { el.hidden = !['owner','admin','manager','agent'].includes(currentRole);el.style.display=el.hidden?'none':''; });
}
async function initializeAuth() {
  try {
    var response = await fetch('/api/config', {cache:'no-store'});
    if (!response.ok) throw new Error('Supabase não configurado. Defina as variáveis de ambiente na Vercel.');
    var config = await response.json(); SB_URL = config.url; SB_KEY = config.key;
    if (!window.supabase || !window.supabase.createClient) throw new Error('Biblioteca de autenticação indisponível.');
    _sbClient = window.supabase.createClient(SB_URL, SB_KEY, {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
    var fragment = new URLSearchParams(window.location.hash.slice(1));
    if (fragment.has('access_token') && fragment.has('refresh_token')) {
      var oauth = await _sbClient.auth.setSession({access_token:fragment.get('access_token'),refresh_token:fragment.get('refresh_token')});
      history.replaceState(null,document.title,window.location.pathname + window.location.search);
      if (oauth.error) throw new Error('A sessão Google expirou. Entre novamente.');
    }
    var result = await _sbClient.auth.getSession(); authSession = result.data.session; window.authSession = authSession;
    if (authSession) await verifyMembershipAndShow();
    _sbClient.auth.onAuthStateChange(function(_event, session) { authSession=session; window.authSession=session; if(session) setTimeout(verifyMembershipAndShow,0); else { store={};currentTenantId=''; document.getElementById('app').classList.remove('visible'); document.getElementById('login-screen').style.display='flex'; } });
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
  var seen = {};
  var requestedTenant = currentTenantId;
  Object.keys(VIEWS).forEach(function(key) {
    var v = VIEWS[key];
    if (seen[v.table]) return; seen[v.table] = true;
    sbSelect(v.table, v.order).then(function(res) {
      if (requestedTenant !== currentTenantId) return;
      store[v.table] = res.data || [];
      updateBadges();
      if (currentView === key || currentView === 'dashboard') renderView(currentView);
    });
  });
}

function loadTable(tableName, order) {
  var v = (VIEWS[currentView] && VIEWS[currentView].table === tableName) ? VIEWS[currentView] : findView(tableName);
  var requestedTenant = currentTenantId;
  return sbSelect(tableName, order || (v && v.order) || 'created_at.desc').then(function(res) {
    if (requestedTenant !== currentTenantId) return [];
    store[tableName] = res.data || [];
    return store[tableName];
  });
}

function findView(tableName) {
  return Object.values(VIEWS).find(function(v) { return v.table === tableName; });
}

function updateBadges() {
  var leads = store['customers'] || [];
  var newLeads = leads.filter(function(r) { return r.status === 'lead'; }).length;
  var badge = document.getElementById('badge-leads');
  if (badge) { badge.textContent = newLeads > 0 ? newLeads : ''; badge.style.display = newLeads > 0 ? '' : 'none'; }

  var today = new Date(); today.setHours(0,0,0,0);
  var tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate()+1);
  var appts = (store['legal_appointments'] || []).filter(function(r) {
    if (r.status === 'cancelled' || r.status === 'completed') return false;
    var d = new Date(r.starts_at);
    return d >= today && d < new Date(today.getTime() + 7*86400000);
  });
  var ab = document.getElementById('badge-appts');
  if (ab) { ab.textContent = appts.length > 0 ? appts.length : ''; ab.style.display = appts.length > 0 ? '' : 'none'; }

  var deadlines = (store['legal_deadlines'] || []).filter(function(r) {
    if (r.completed_at) return false;
    var d = new Date(r.due_at);
    return d <= new Date(today.getTime() + 48*3600000);
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
  } else if (view === 'ia_juridica' || view === 'compliance' || view === 'integrations' || view === 'account') {
    addBtn.style.display = 'none';
    document.getElementById('view-title').textContent = view === 'ia_juridica' ? 'IA Jurídica' : view === 'integrations' ? 'Google e documentos' : view === 'account' ? 'Minha conta' : 'Conformidade editorial';
  } else {
    var cfg = VIEWS[view];
    if (cfg) {
      addBtn.style.display = cfg.readOnly || currentRole === 'viewer' ? 'none' : '';
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
  var leads     = store['customers'] || [];
  var clients   = store['customers'] || [];
  var appts     = store['legal_appointments'] || [];
  var procs     = store['legal_cases'] || [];
  var deadlines = store['legal_deadlines'] || [];
  var fees      = store['legal_fees'] || [];

  var today = new Date(); today.setHours(0,0,0,0);
  var tomorrow = new Date(today); tomorrow.setDate(today.getDate()+1);

  var newLeads   = leads.filter(function(r) { return r.status === 'lead'; }).length;
  var todayAppts = appts.filter(function(r) {
    var d = new Date(r.starts_at); d.setHours(0,0,0,0);
    return d.getTime() === today.getTime();
  }).length;
  var urgDead    = deadlines.filter(function(r) { return !r.completed_at && new Date(r.due_at) <= new Date(today.getTime() + 48*3600000); }).length;
  var unpaid     = fees.filter(function(r) { return !r.paid_at; }).length;
  var activeProcs= procs.filter(function(r) { return r.status === 'active'; }).length;

  var recentLeads = leads.filter(function(r){return r.status === 'lead';}).slice(0,5).map(function(r) {
    return '<tr><td style="color:var(--text)">' + esc(r.full_name || '—') + '</td>'
      + '<td>' + esc(r.phone_e164 || '—') + '</td>'
      + '<td>' + esc(r.lead_practice_area || '—') + '</td>'
      + '<td><span class="status ' + statusClass(r.status) + '">' + (r.status || 'lead') + '</span></td>'
      + '<td>' + fmtDate(r.created_at) + '</td>'
      + '<td><div class="td-actions">'
      + '<button class="btn btn-outline btn-sm" data-action="edit" data-table="customers" data-id="' + esc(r.id) + '">Editar</button>'
      + '</div></td></tr>';
  }).join('');

  var nextAppts = appts.filter(function(r) {
    return r.status !== 'cancelled' && r.status !== 'completed';
  }).slice(0,5).map(function(r) {
    return '<tr><td style="color:var(--text)">' + esc(r.title || '—') + '</td>'
      + '<td>' + esc(r.responsible_user_id || '—') + '</td>'
      + '<td>' + fmtDatetime(r.starts_at) + '</td>'
      + '<td><span class="status ' + statusClass(r.status) + '">' + esc(r.status || '') + '</span></td></tr>';
  }).join('');

  var urgDeadlines = deadlines.filter(function(r) {
    return !r.completed_at && new Date(r.due_at) <= new Date(today.getTime() + 7*86400000);
  }).slice(0,5).map(function(r) {
    var d = new Date(r.due_at);
    var diff = Math.ceil((d - today) / 86400000);
    var cls = diff <= 0 ? 'status-urgente' : diff <= 2 ? 'status-aberto' : 'status-aguardando';
    var label = diff <= 0 ? 'Vencido' : diff === 1 ? 'Amanhã' : 'Em ' + diff + 'd';
    return '<tr><td style="color:var(--text)">' + esc(r.title || '—') + '</td>'
      + '<td>' + esc(r.process_number || '—') + '</td>'
      + '<td>' + esc(r.responsible_user_id || '—') + '</td>'
      + '<td>' + fmtDatetime(r.due_at) + '</td>'
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
      '<button class="btn btn-outline btn-sm" data-action="navigate" data-view="legal_deadlines">Ver todos</button>');
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
  if (!r.starts_at && !r.date_time) return '';
  try {
    var start = new Date(r.starts_at || r.date_time);
    var end   = new Date(start.getTime() + 60 * 60 * 1000); // +1h
    function fmt(d) {
      return d.toISOString().replace(/[-:]/g,'').split('.')[0] + 'Z';
    }
    var title    = encodeURIComponent('B&P – ' + (r.kind || r.type || 'Consulta') + (r.title ? ' – ' + r.title : ''));
    var details  = encodeURIComponent(
      (r.responsible_user_id  ? 'Responsável: ' + r.responsible_user_id + '\n' : '') +
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

async function googleApi(path, options) {
  if (!authSession) throw new Error('Sessão não autenticada.');
  var settings = Object.assign({}, options || {});
  settings.headers = Object.assign({}, settings.headers || {}, { 'Authorization': 'Bearer ' + authSession.access_token, 'X-BP-Tenant-Id': currentTenantId, 'Content-Type': 'application/json' });
  var response = await fetch(path, settings);
  var data = await response.json().catch(function(){ return {}; });
  if (!response.ok) throw new Error(data.error || 'Não foi possível concluir a integração Google.');
  return data;
}
async function connectGoogleCalendar() {
  try { var data = await googleApi('/api/google/calendar/connect', { method: 'POST', body: '{}' }); window.location.href = data.url; } catch (error) { toast(error.message,'error'); }
}
async function prepareGoogleDrive() {
  try { var data = await googleApi('/api/google/drive/folder', { method: 'POST', body: '{}' }); if(document.getElementById('google-drive-link')){var link=document.getElementById('google-drive-link');link.href=data.webViewLink;link.hidden=false;}toast('Pasta privada do CRM preparada. Abra pelo link no painel.','success'); } catch (error) { toast(error.message,'error'); }
}
async function syncGoogleCalendar(id) {
  try { var data = await googleApi('/api/google/calendar/sync', { method: 'POST', body: JSON.stringify({ appointment_id: id }) }); toast('Compromisso enviado ao Google Agenda (sem anotações sigilosas).','success'); } catch (error) { toast(error.message,'error'); }
}
async function syncGoogleContact(id) {
  try { await googleApi('/api/google/contacts/sync', { method: 'POST', body: JSON.stringify({ customer_id: id }) }); toast('Contato autorizado sincronizado sem duplicação.','success'); } catch (error) { toast(error.message,'error'); }
}

/* ════════════════════════════════════════════════════════════════
   RENDER TABLE VIEW
   ════════════════════════════════════════════════════════════════ */
function renderTableView(viewKey) {
  var cfg = VIEWS[viewKey];
  if (!cfg) return '<p style="color:var(--text-3)">Módulo não encontrado.</p>';
  var rows = store[cfg.table] || [];
  if(cfg.entity==='lead') rows=rows.filter(function(row){return row.status==='lead';});
  if(cfg.entity==='client') rows=rows.filter(function(row){return row.status!=='lead';});
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
        var calendarSyncBtn = '';
        var contactsSyncBtn = '';
        var whatsappBtn = '';
        if (cfg.entity === 'lead' && r.phone_e164) whatsappBtn = '<a class="btn btn-outline btn-sm" href="https://wa.me/'+esc(String(r.phone_e164).replace(/\D/g,''))+'" target="_blank" rel="noopener" title="Abrir WhatsApp">WA</a><button class="btn btn-outline btn-sm" data-action="log-contact" data-id="'+esc(r.id)+'" title="Registrar contato sem conteúdo">Registrar</button>';
        if (cfg.table === 'legal_appointments') {
          var cal = gcalLink(r);
          if (cal) calBtn = '<a class="btn btn-outline btn-sm" href="' + cal + '" target="_blank" rel="noopener" title="Adicionar ao Google Calendar" style="text-decoration:none">📅</a>';
          calendarSyncBtn = '<button class="btn btn-outline btn-sm" data-action="calendar-sync" data-id="' + esc(cfg.table === 'legal_appointments' ? r.id : '') + '" title="Enviar compromisso operacional ao Google Agenda">Agenda</button>';
        }
        if (cfg.table === 'customers' && cfg.entity === 'client') {
          contactsSyncBtn = '<button class="btn btn-outline btn-sm" data-action="contact-sync" data-id="' + esc(r.id) + '" title="Sincronizar contato com Google Contatos">Contato</button>';
        }
        return '<tr>' + cells
          + '<td><div class="td-actions">'
          + calBtn + calendarSyncBtn + contactsSyncBtn + whatsappBtn
          + (cfg.readOnly || currentRole === 'viewer' ? '' : '<button class="btn btn-outline btn-sm" data-action="edit" data-table="' + esc(cfg.table) + '" data-id="' + esc(r.id) + '">Editar</button>')
          + (cfg.readOnly || !['owner','admin'].includes(currentRole) ? '' : '<button class="btn btn-danger btn-sm" data-action="delete" data-table="' + esc(cfg.table) + '" data-id="' + esc(r.id) + '">Excluir</button>')
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
    + (cfg.table === 'legal_appointments' ? '<button class="btn btn-outline btn-sm" data-action="calendar-connect">Conectar Google Agenda</button><button class="btn btn-outline btn-sm" data-action="drive-connect">Preparar Google Drive</button>' : '')
    + (cfg.table === 'customers' && cfg.entity === 'client' ? '<button class="btn btn-outline btn-sm" data-action="calendar-connect">Conectar Google</button>' : '')
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
  else if (action === 'run-ai') runInternalAI();
  else if (action === 'log-contact') openContactLog(control.getAttribute('data-id'));
  else if (action === 'delete') deleteRecord(table, control.getAttribute('data-id'));
  else if (action === 'navigate') navigateTo(control.getAttribute('data-view'));
  else if (action === 'page') goPage(table, Number(control.getAttribute('data-index')));
  else if (action === 'calendar-connect') connectGoogleCalendar();
  else if (action === 'drive-connect') prepareGoogleDrive();
  else if (action === 'calendar-sync') syncGoogleCalendar(control.getAttribute('data-id'));
  else if (action === 'contact-sync') syncGoogleContact(control.getAttribute('data-id'));
  else if (action === 'google-refresh') refreshGoogleIntegrations();
  else if (action === 'google-disconnect') disconnectGoogleIntegration();
  else if (action === 'drive-upload') uploadGoogleDocument();
  else if (action === 'change-password') changeAccountPassword();
  else if (action === 'team-authorize') manageTeamAccess(true);
  else if (action === 'team-revoke') manageTeamAccess(false);
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
  } else if (view === 'integrations') {
    area.innerHTML = renderGoogleIntegrations();
    refreshGoogleIntegrations();
  } else if (view === 'account') {
    area.innerHTML = renderAccountSettings()+renderTeamSettings();
    if(['owner','admin'].includes(currentRole))refreshTeamSettings();
  } else if (view === 'compliance') {
    area.innerHTML = renderCompliance();
  } else if (VIEWS[view]) {
    area.innerHTML = renderTableView(view);
  }
}

/* IA interna: chave e geração somente no backend; entrada sanitizada e revisão humana. */
function renderIAJuridica(){return '<div class="ia-layout"><div><div class="ia-card"><h3 class="ia-card-title"><span class="ia-dot ia-dot-blue"></span>Assistente interno</h3><p class="ia-hint">A IA apoia a equipe. Ela não atende clientes, não decide estratégia e não recebe dados pessoais, números de processo ou documentos.</p><label class="form-label" for="ia-mode">Tarefa</label><select class="form-select" id="ia-mode"><option value="triage">Triagem operacional</option><option value="summary">Resumo de texto sanitizado</option><option value="deadline_plan">Plano de conferência de prazo</option><option value="petition_review">Melhorar petição sanitizada</option><option value="contract_review">Revisar contrato sanitizado</option><option value="legal_update">Atualização normativa com fontes oficiais</option><option value="internal_draft">Rascunho interno</option></select><label class="form-label" for="ia-input" style="margin-top:12px">Texto interno sem dados pessoais</label><textarea class="form-textarea" id="ia-input" rows="10" maxlength="12000" placeholder="Cole somente texto sanitizado: remova nomes, CPF, telefone, e-mail, número de processo, documentos e informações sigilosas."></textarea><label class="consent" style="margin-top:12px"><input type="checkbox" id="ia-safe"> <span>Confirmei que o texto foi sanitizado e que a resposta será revisada por advogado antes de qualquer uso.</span></label><button class="btn btn-primary" type="button" data-action="run-ai" style="margin-top:14px">Gerar análise interna</button><p class="ia-hint" id="ia-feedback"></p></div></div><div class="ia-card"><h3 class="ia-card-title">Resultado</h3><div id="ia-result" class="ia-results-placeholder"><p>O resultado aparecerá aqui com o selo “revisão humana obrigatória” e links oficiais quando a tarefa exigir atualização normativa.</p></div></div></div>';}
function renderCompliance(){var items=['Nome, razão social, CNPJ, inscrições e qualificações confirmados','Texto objetivo, verdadeiro, sóbrio e informativo','Sem promessa de resultado, comparação ou autoengrandecimento','Sem preço, desconto, gratuidade ou oferta agressiva de contratação','Plantão, horários e canais confirmados pela operação real','Fotos, biografias, títulos e especialidades autorizados e comprováveis','Aviso de privacidade, bases legais e canal do controlador preenchidos','Revisão final pelo advogado responsável e, se necessário, consulta ao TED/OAB'];return '<div class="ia-card"><h3 class="ia-card-title">Checklist editorial · Provimento 205/2021</h3><p class="ia-hint">Checklist operacional. Não é parecer jurídico nem certificação automática.</p>'+items.map(function(item,i){return '<label class="consent" style="display:flex;margin:12px 0"><input type="checkbox" data-compliance="'+i+'"> <span>'+esc(item)+'</span></label>';}).join('')+'<div class="ia-card" style="margin-top:18px;background:rgba(185,138,87,.08)"><strong>Estado atual</strong><p class="ia-hint">A publicação só deve ser liberada depois da validação humana dos itens acima. A ferramenta organiza evidências; não substitui a análise do advogado ou do TED/OAB.</p></div></div>';}
async function runInternalAI(){var mode=document.getElementById('ia-mode').value,input=document.getElementById('ia-input').value.trim(),safe=document.getElementById('ia-safe').checked,feedback=document.getElementById('ia-feedback'),result=document.getElementById('ia-result');if(!safe||input.length<10){feedback.textContent='Confirme a sanitização e informe um texto interno suficiente.';return;}feedback.textContent='Gerando com backend seguro…';result.innerHTML='<div class="ia-loading"><span class="ia-spinner"></span>Processando sem armazenar prompt ou resposta.</div>';var controller=new AbortController(),timeout=setTimeout(function(){controller.abort();},30000);try{var response=await fetch('/api/ia',{method:'POST',headers:{Authorization:'Bearer '+authSession.access_token,'X-BP-Tenant-Id':currentTenantId,'Content-Type':'application/json'},body:JSON.stringify({mode:mode,input:input}),signal:controller.signal});var data=await response.json().catch(function(){return{};});if(!response.ok)throw new Error(data.error||'Falha ao gerar.');result.innerHTML='<div class="ia-result-body"><strong style="color:var(--gold)">Rascunho interno · revisão humana obrigatória</strong><p class="ia-strategy-text">'+esc(data.output||'')+'</p></div>';feedback.textContent='Execução registrada sem salvar o texto enviado ou a resposta.';}catch(error){var message=error.name==='AbortError'?'A IA não respondeu no tempo esperado. Verifique a configuração do provedor e tente novamente.':(error.message||'Não foi possível gerar o rascunho.');result.innerHTML='<div class="ia-error">'+esc(message)+'</div>';feedback.textContent='';}finally{clearTimeout(timeout);}}

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
  if(currentRole==='viewer'){toast('Seu perfil permite somente leitura.','error');return;}
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

  if (!editingId) { payload.tenant_id = currentTenantId; payload.created_by = authSession && authSession.user ? authSession.user.id : null; if (cfg.entity === 'lead') payload.status = 'lead'; if (cfg.entity === 'client' && !payload.status) payload.status = 'active'; }
  var invalidField=cfg.fields.find(function(f){return f.required&&!payload[f.key];});
  if(invalidField){saveBtn.disabled=false;saveBtn.textContent='Salvar';toast('Preencha: '+invalidField.label,'error');return;}
  var p = editingId ? sbUpdate(cfg.table, editingId, payload) : sbInsert(cfg.table, payload);

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
  var cfg = (VIEWS[currentView] && VIEWS[currentView].table === table) ? VIEWS[currentView] : Object.values(VIEWS).find(function(v) { return v.table === table; });
  var row = (store[table] || []).find(function(r) { return String(r.id) === String(id); });
  if (cfg && row) openDrawer(cfg, row);
}
window.editRecord = editRecord;

function deleteRecord(table, id) {
  if(!['owner','admin'].includes(currentRole)){toast('Exclusão restrita ao administrador.','error');return;}
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

function openContactLog(customerId){var row=(store.customers||[]).find(function(r){return String(r.id)===String(customerId);});if(!row)return;document.getElementById('drawer-title').textContent='Registrar contato seguro';document.getElementById('drawer-body').innerHTML='<p class="ia-hint">Registre apenas o fato operacional. Não copie mensagens, documentos, nomes de terceiros, números de processo ou dados pessoais.</p><label class="form-label">Direção</label><select class="form-select" id="contact-direction"><option value="outbound">Saída do escritório</option><option value="inbound">Entrada do contato</option><option value="internal">Nota interna</option></select><label class="form-label" style="margin-top:12px">Tipo</label><select class="form-select" id="contact-type"><option value="contact">Contato</option><option value="handoff">Encaminhamento ao advogado</option><option value="callback">Retorno solicitado</option><option value="appointment">Agendamento</option><option value="consent">Consentimento</option><option value="opt_out">Opt-out</option></select><label class="form-label" style="margin-top:12px">Resumo operacional</label><textarea class="form-textarea" id="contact-summary" maxlength="500" rows="4" placeholder="Ex.: retorno solicitado; equipe orientou aguardar contato do advogado."></textarea>';document.getElementById('drawer-overlay').classList.add('open');document.getElementById('drawer-save').onclick=async function(){var summary=document.getElementById('contact-summary').value.trim();if(summary.length<2){toast('Informe um resumo operacional curto.','error');return;}var response=await fetch('/api/contact-events',{method:'POST',headers:{Authorization:'Bearer '+authSession.access_token,'X-BP-Tenant-Id':currentTenantId,'Content-Type':'application/json'},body:JSON.stringify({customer_id:customerId,direction:document.getElementById('contact-direction').value,event_type:document.getElementById('contact-type').value,safe_summary:summary})});var data=await response.json().catch(function(){return{};});if(!response.ok){toast(data.error||'Não foi possível registrar.','error');return;}toast('Contato registrado sem conteúdo de mensagem.','success');closeDrawer();};}

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


/* Integrações e conta: operações explícitas com estado e instruções visíveis. */
function renderGoogleIntegrations() {
  var editable = ['owner','admin','manager','agent'].includes(currentRole);
  return '<div class="ia-card"><h3 class="ia-card-title">Sua conta Google no escritório</h3>'
    + '<p class="ia-hint">A conexão é individual. Autorize uma conta profissional em que você possa manter os documentos do escritório. O CRM não importa seu Drive inteiro nem seus contatos pessoais.</p>'
    + '<p id="google-connection-status" role="status">Consultando a conexão…</p>'
    + (editable ? '<div style="display:flex;gap:12px;flex-wrap:wrap;margin:20px 0"><button class="btn btn-gold" data-action="calendar-connect">Conectar / reconectar Google</button><button class="btn btn-outline" data-action="google-refresh">Atualizar estado</button><button class="btn btn-outline" data-action="google-disconnect">Desconectar do CRM</button></div>' : '')
    + '<p class="ia-hint">Se o Google indicar acesso bloqueado ou API desativada, o administrador precisa habilitar Calendar API, Drive API e People API no mesmo projeto Google Cloud. Em modo de teste, cadastre o e-mail como usuário de teste. O consentimento precisa ser dado pelo titular da conta.</p></div>'
    + '<div class="ia-card" style="margin-top:20px"><h3 class="ia-card-title">Agenda e contatos</h3><p class="ia-hint">Em Agenda, use o botão Agenda de cada compromisso para enviar ou atualizar um evento privado de uma hora, sem nomes de clientes e sem anotações. O Google exibe um lembrete 30 minutos antes. Em Clientes, use Contato para enviar nome, telefone e e-mail de um cliente ativo com consentimento autorizado. As sincronizações são do CRM para o Google, acionadas por você; alterações feitas no Google não retornam automaticamente ao CRM.</p></div>'
    + '<div class="ia-card" style="margin-top:20px"><h3 class="ia-card-title">Documentos no Google Drive</h3><p class="ia-hint">Arquivos privados na pasta criada por este aplicativo, acessíveis somente pela conta Google autorizada e pelas pessoas com quem você decidir compartilhá-los. Não há compartilhamento público automático. PDF, DOCX, JPG, PNG ou TXT até 2 MB. Confira a política do escritório antes de enviar documentos sigilosos.</p>'
    + (editable ? '<button class="btn btn-outline" data-action="drive-connect">Preparar pasta privada</button> <a id="google-drive-link" class="btn btn-outline" target="_blank" rel="noopener" hidden>Abrir pasta no Drive</a><div style="margin:20px 0"><input id="drive-file" type="file" accept=".pdf,.docx,.jpg,.jpeg,.png,.txt"><button class="btn btn-gold" data-action="drive-upload">Enviar documento</button></div>' : '')
    + '<div id="google-documents" role="status">Conecte o Google para consultar documentos.</div></div>';
}
async function refreshGoogleIntegrations() {
  var status = document.getElementById('google-connection-status');
  if(!status) return;
  try {
    var data = await googleApi('/api/google/calendar/status');
    if(!document.getElementById('google-connection-status')) return;
    status.textContent = data.connected ? 'Conectado: '+data.googleEmail+' · Agenda: '+(data.capabilities.calendar?'autorizada':'pendente')+' · Drive: '+(data.capabilities.drive?'autorizado':'pendente')+' · Contatos: '+(data.capabilities.contacts?'autorizados':'pendentes') : 'Não conectado. Clique em Conectar Google e autorize os serviços.';
    if(data.connected && data.capabilities.drive){
      var docs=await googleApi('/api/google/drive/files');
      var target=document.getElementById('google-documents');
      if(target) target.innerHTML=docs.files.length?docs.files.map(function(file){
        var href=String(file.webViewLink||'');
        if(!href.startsWith('https://')) href='https://drive.google.com/file/d/'+encodeURIComponent(file.id)+'/view';
        return '<p><a href="'+esc(href)+'" target="_blank" rel="noopener" style="text-decoration:underline">'+esc(file.name)+'</a> <small>'+fmtDatetime(file.modifiedTime)+'</small></p>';
      }).join(''):'Nenhum documento na pasta do aplicativo.';
    }
  }catch(error){status.textContent=error.message;}
}
async function disconnectGoogleIntegration(){
  openConfirm('Desconectar conta Google','O CRM deixará de usar sua autorização. Os arquivos e eventos que você já criou continuarão na conta Google. Para revogar completamente a autorização, use também as configurações de segurança da conta Google.',async function(){
    try{await googleApi('/api/google/calendar/disconnect',{method:'POST',body:'{}'});toast('Conta desconectada do CRM.','success');refreshGoogleIntegrations();}catch(error){toast(error.message,'error');}
  });
}
async function uploadGoogleDocument(){
  var input=document.getElementById('drive-file');var file=input&&input.files[0];
  if(!file){toast('Selecione um documento.','error');return;}
  if(file.size>2*1024*1024){toast('O limite é 2 MB por documento.','error');return;}
  var button=document.querySelector('[data-action="drive-upload"]');button.disabled=true;button.textContent='Enviando…';
  try{
    var encoded=await new Promise(function(resolve,reject){var reader=new FileReader();reader.onload=function(){resolve(String(reader.result).split(',')[1]);};reader.onerror=reject;reader.readAsDataURL(file);});
    var mime=file.type||(/\.docx$/i.test(file.name)?'application/vnd.openxmlformats-officedocument.wordprocessingml.document':/\.txt$/i.test(file.name)?'text/plain':'application/octet-stream');
    await googleApi('/api/google/drive/upload',{method:'POST',body:JSON.stringify({name:file.name,mime_type:mime,base64:encoded})});
    toast('Documento enviado à pasta privada.','success');input.value='';await refreshGoogleIntegrations();
  }catch(error){toast(error.message,'error');}finally{button.disabled=false;button.textContent='Enviar documento';}
}
function renderAccountSettings(){
  return '<div class="ia-card"><h3 class="ia-card-title">Minha conta</h3><p class="ia-hint">Conta: '+esc(authSession.user.email||'')+' · Papel no escritório: '+esc(currentRole)+'. A senha de teste não deve ser usada em produção. Troque-a por uma senha exclusiva com pelo menos 12 caracteres.</p><label class="form-label" for="new-account-password">Nova senha</label><input class="form-input" type="password" id="new-account-password" autocomplete="new-password" minlength="12"><label class="form-label" for="confirm-account-password" style="margin-top:18px">Confirme a nova senha</label><input class="form-input" type="password" id="confirm-account-password" autocomplete="new-password"><button class="btn btn-gold" data-action="change-password" style="margin-top:20px">Atualizar senha</button><p class="ia-hint" style="margin-top:16px">Não compartilhe a conta master. Cada advogado deve ter um acesso próprio e uma permissão correspondente ao trabalho realizado.</p></div>';
}
async function changeAccountPassword(){
  var password=document.getElementById('new-account-password').value;var confirm=document.getElementById('confirm-account-password').value;
  if(password.length<12||password!==confirm){toast('Use pelo menos 12 caracteres e confirme a mesma senha.','error');return;}
  var button=document.querySelector('[data-action="change-password"]');button.disabled=true;
  try{var result=await _sbClient.auth.updateUser({password:password,data:{temporary_test_account:false}});if(result.error)throw result.error;toast('Senha atualizada. Guarde-a em local seguro.','success');document.getElementById('new-account-password').value='';document.getElementById('confirm-account-password').value='';}
  catch(error){toast('Não foi possível atualizar a senha. Confira sua sessão.','error');}finally{button.disabled=false;}
}
(function addUtilityNavigation(){
  var nav=document.querySelector('.sidebar-nav');if(!nav)return;
  [['ia_juridica','IA interna · revisão humana'],['compliance','Conformidade editorial'],['integrations','Google e documentos'],['account','Minha conta / senha']].forEach(function(entry){
    var button=document.createElement('button');button.type='button';button.className='nav-item';button.dataset.view=entry[0];button.textContent=entry[1];button.addEventListener('click',function(){navigateTo(entry[0]);closeMobileMenu();});nav.appendChild(button);
  });
})();

function renderTeamSettings(){
  if(!['owner','admin'].includes(currentRole))return '';
  return '<div class="ia-card" style="margin-top:20px"><h3 class="ia-card-title">Equipe do escritório</h3><p class="ia-hint">Cadastre o e-mail Google do advogado diretamente aqui. A autorização fica pendente até ele entrar com o mesmo e-mail; depois do primeiro login, o acesso é liberado automaticamente. Usuários fora desta lista continuam bloqueados.</p><label class="form-label" for="team-email">E-mail a autorizar ou revogar</label><input class="form-input" id="team-email" type="email" autocomplete="off"><label class="form-label" for="team-role" style="margin-top:16px">Permissão</label><select class="form-select" id="team-role"><option value="agent">Advogado / associado — operação jurídica</option><option value="viewer">Somente leitura</option><option value="manager">Gestão — inclui honorários</option><option value="admin">Administrador — gestão de acesso</option></select><div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px"><button class="btn btn-gold" data-action="team-authorize">Autorizar e-mail</button><button class="btn btn-outline" data-action="team-revoke">Revogar acesso</button></div><div id="team-member-list" style="margin-top:20px" role="status">Carregando autorizações…</div><p class="ia-hint">Cada pessoa usa seu próprio login. O CRM é compartilhado somente dentro deste escritório e o proprietário não pode ser removido nesta tela.</p></div>';
}
async function refreshTeamSettings(){
  var target=document.getElementById('team-member-list');if(!target)return;
  var result=await sbFetch('rpc/legal_team_access',{method:'POST',body:JSON.stringify({p_tenant_id:currentTenantId})});
  if(result.error){target.textContent='Não foi possível consultar a equipe.';return;}
  target.innerHTML=(result.data||[]).map(function(member){return '<p><strong>'+esc(member.email)+'</strong> · '+esc(member.role)+' · '+(member.active?(member.registered?'ativo':'autorizado, aguardando primeiro login'):'revogado')+'</p>';}).join('') || '<p class="ia-hint">Nenhum e-mail autorizado.</p>';
}
async function manageTeamAccess(active){
  var email=document.getElementById('team-email').value.trim();var role=document.getElementById('team-role').value;
  if(!/^\S+@\S+\.\S+$/.test(email)){toast('Informe um e-mail válido.','error');return;}
  openConfirm(active?'Autorizar acesso ao escritório':'Revogar acesso ao escritório',active?'Autorizar '+email+' com o papel '+role+'? O acesso será liberado automaticamente quando essa pessoa entrar com o mesmo e-mail Google.':'Revogar '+email+'? A conta perderá o acesso a este escritório.',async function(){
    var result=await sbFetch('rpc/legal_manage_team_access',{method:'POST',body:JSON.stringify({p_tenant_id:currentTenantId,p_email:email,p_role:role,p_active:active})});
    if(result.error){toast('Não foi possível atualizar o acesso. Confira sua permissão e o e-mail.','error');return;}
    toast(active?'E-mail autorizado. O acesso será liberado no primeiro login Google.':'Acesso revogado.','success');refreshTeamSettings();
  });
}

async function setupOfficeSelector(memberships){
  var existing=document.getElementById('office-context-select');if(existing)existing.remove();
  if(memberships.length<2)return;
  var names=await sbFetch('tenants?select=id,name&limit=100');
  var select=document.createElement('select');select.id='office-context-select';select.className='form-select';select.style.maxWidth='270px';select.setAttribute('aria-label','Escritório em uso');
  memberships.forEach(function(member){var option=document.createElement('option');option.value=member.tenant_id;var tenant=(names.data||[]).find(function(item){return item.id===member.tenant_id;});option.textContent=(tenant?tenant.name:'Escritório '+member.tenant_id.slice(0,8))+' · '+member.role;option.selected=member.tenant_id===currentTenantId;select.appendChild(option);});
  var topbar=document.querySelector('.topbar');if(topbar)topbar.appendChild(select);
  select.addEventListener('change',function(){var member=memberships.find(function(item){return item.tenant_id===select.value;});if(!member)return;currentTenantId=member.tenant_id;currentRole=member.role;store={};applyRolePermissions();loadAllData();navigateTo('dashboard');toast('Escritório em uso atualizado.','success');});
}
