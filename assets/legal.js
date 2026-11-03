const lawGroups = [
 {id:'criminal',title:'Direito Penal, Processo Penal e execução penal',laws:[
  ['Constituição da República de 1988','Garantias fundamentais, devido processo legal, ampla defesa e direitos individuais.','https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm'],
  ['Código Penal — Decreto-Lei nº 2.848/1940','Parte geral e parte especial do Direito Penal.','https://www.planalto.gov.br/ccivil_03/decreto-lei/del2848compilado.htm'],
  ['Código de Processo Penal — Decreto-Lei nº 3.689/1941','Investigação, ação penal, provas, procedimentos, prisões e recursos.','https://www.planalto.gov.br/ccivil_03/decreto-lei/del3689.htm'],
  ['Lei de Execução Penal — Lei nº 7.210/1984','Execução das penas, direitos e deveres da pessoa condenada.','https://www.planalto.gov.br/ccivil_03/leis/l7210.htm'],
  ['Lei de Drogas — Lei nº 11.343/2006','Sistema Nacional de Políticas Públicas sobre Drogas e tipos penais correlatos.','https://www.planalto.gov.br/ccivil_03/_ato2004-2006/2006/lei/l11343.htm'],
  ['Lei dos Crimes Hediondos — Lei nº 8.072/1990','Regime jurídico dos crimes hediondos e equiparados.','https://www.planalto.gov.br/ccivil_03/leis/l8072.htm'],
  ['Lei de Organizações Criminosas — Lei nº 12.850/2013','Investigação, meios de obtenção de prova e definição legal de organização criminosa.','https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2013/lei/l12850.htm'],
  ['Lei de Lavagem de Dinheiro — Lei nº 9.613/1998','Crimes de lavagem ou ocultação de bens, direitos e valores.','https://www.planalto.gov.br/ccivil_03/leis/l9613.htm'],
  ['Lei de Tortura — Lei nº 9.455/1997','Definição dos crimes de tortura e disposições correlatas.','https://www.planalto.gov.br/ccivil_03/leis/l9455.htm'],
  ['Lei de Abuso de Autoridade — Lei nº 13.869/2019','Crimes de abuso de autoridade e requisitos legais.','https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2019/lei/l13869.htm'],
  ['Lei Maria da Penha — Lei nº 11.340/2006','Mecanismos de prevenção e enfrentamento à violência doméstica e familiar contra a mulher.','https://www.planalto.gov.br/ccivil_03/_ato2004-2006/2006/lei/l11340.htm'],
  ['Lei nº 14.994/2024 — alterações sobre feminicídio','Torna o feminicídio crime autônomo e altera diplomas penais e processuais.','https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2024/lei/l14994.htm'],
  ['Marco Legal do Combate ao Crime Organizado — Lei nº 15.358/2026','Institui o marco legal, tipifica delitos e altera o Código Penal, CPP, LEP e leis especiais.','https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2026/lei/l15358.htm'],
  ['Lei nº 15.397/2026 — alterações no Código Penal','Altera penas e tipos relacionados a furto, roubo, estelionato, receptação e fraudes bancárias.','https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2026/lei/l15397.htm'],
  ['Lei nº 15.353/2026 — estupro de vulnerável','Altera o art. 217-A do Código Penal sobre presunção de vulnerabilidade e aplicação das penas.','https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2026/lei/l15353.htm'],
  ['Lei nº 15.438/2026 — violência doméstica e representação','Altera CP, Lei Maria da Penha e CPP sobre prazo decadencial de queixa ou representação.','https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2026/lei/l15438.htm'],
  ['Lei nº 15.487/2026 — violência sexual contra crianças e adolescentes','Altera CP, CPP, ECA, Lei dos Crimes Hediondos e Lei de Organizações Criminosas, inclusive sobre ambiente digital e IA.','https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2026/lei/l15487.htm'],
  ['Lei nº 15.380/2026 — Lei Maria da Penha','Altera regras sobre audiência de retratação em casos de violência doméstica e familiar.','https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2026/lei/l15380.htm'],
  ['Lei nº 15.384/2026 — violência vicária','Altera a Lei Maria da Penha, a Lei dos Crimes Hediondos e o Código Penal sobre violência vicária e qualificadora de homicídio.','https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2026/lei/l15384.htm'],
  ['Lei nº 15.402/2026 — alterações no Código Penal e na LEP','Altera regras de execução penal e dispositivos do Código Penal; conhecida como Lei da Dosimetria.','https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2026/lei/l15402.htm'],
  ['Lei nº 15.407/2026 — execução penal e estabelecimentos federais','Altera a Lei nº 11.671/2008 e a Lei de Execução Penal sobre inclusão em presídios federais e regime disciplinar diferenciado.','https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2026/lei/l15407.htm'],
  ['Lei nº 15.425/2026 — exercício ilegal da medicina veterinária','Altera o Código Penal para tipificar o exercício ilegal da medicina veterinária.','https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2026/lei/l15425.htm'],
  ['Lei nº 15.455/2026 — trabalho em condição análoga à escravidão','Estabelece medidas de proteção e acolhimento e altera CP, Lei Maria da Penha e normas trabalhistas.','https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2026/lei/l15455.htm'],
  ['Lei nº 15.516/2026 — protocolo intersetorial de atendimento à violência','Institui protocolo integrado para situações de violência contra mulheres, crianças, adolescentes e pessoas vulneráveis.','https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2026/lei/l15516.htm'],
  ['Lei nº 15.517/2026 — crimes envolvendo combustíveis','Altera o Código Penal e a Lei nº 8.176/1991 sobre furto e roubo de petróleo, derivados, gás, biocombustíveis e óleos lubrificantes.','https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2026/lei/l15517.htm'],
  ['Lei nº 15.181/2025 — crimes envolvendo fios e cabos','Altera o Código Penal e a Lei de Lavagem de Dinheiro em relação a crimes envolvendo fios, cabos e equipamentos.','https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2025/lei/l15181.htm'],
  ['Estatuto do Desarmamento — Lei nº 10.826/2003','Registro, posse e comercialização de armas de fogo e crimes correlatos.','https://www.planalto.gov.br/ccivil_03/leis/2003/l10.826.htm'],
  ['Lei dos Juizados Especiais — Lei nº 9.099/1995','Juizados Especiais Cíveis e Criminais e institutos despenalizadores.','https://www.planalto.gov.br/ccivil_03/leis/l9099.htm'],
  ['Estatuto da Criança e do Adolescente — Lei nº 8.069/1990','Direitos da criança e do adolescente e sistema socioeducativo.','https://www.planalto.gov.br/ccivil_03/leis/l8069.htm']
 ]},
 {id:'constitutional',title:'Direito Constitucional e garantias',laws:[
  ['Constituição Federal de 1988','Texto constitucional compilado e emendas.','https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm'],
  ['Lei do Mandado de Segurança — Lei nº 12.016/2009','Disciplina o mandado de segurança individual e coletivo.','https://www.planalto.gov.br/ccivil_03/_ato2007-2010/2009/lei/l12016.htm'],
  ['Lei de Acesso à Informação — Lei nº 12.527/2011','Acesso a informações públicas e transparência administrativa.','https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2011/lei/l12527.htm']
 ]},
 {id:'civil',title:'Direito Civil, Processo Civil, Família e Sucessões',laws:[
  ['Código Civil — Lei nº 10.406/2002','Pessoas, bens, fatos jurídicos, obrigações, contratos, responsabilidade civil, família e sucessões.','https://www.planalto.gov.br/ccivil_03/leis/2002/l10406compilada.htm'],
  ['Código de Processo Civil — Lei nº 13.105/2015','Processo de conhecimento, tutela provisória, execução, recursos e procedimentos especiais.','https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13105compilada.htm'],
  ['Lei de Alimentos — Lei nº 5.478/1968','Ação de alimentos e procedimentos correlatos.','https://www.planalto.gov.br/ccivil_03/leis/l5478.htm'],
  ['Lei nº 15.479/2026 — prestação alimentícia','Altera o CPC para disciplinar a transferência automática de prestações alimentícias.','https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2026/lei/l15479.htm'],
  ['Lei de Registros Públicos — Lei nº 6.015/1973','Registros públicos e atos registrais.','https://www.planalto.gov.br/ccivil_03/leis/l6015compilada.htm'],
  ['Lei de Arbitragem — Lei nº 9.307/1996','Arbitragem como meio de solução de controvérsias.','https://www.planalto.gov.br/ccivil_03/leis/l9307.htm']
 ]},
 {id:'business',title:'Direito Empresarial e Tributário',laws:[
  ['Código Civil — Lei nº 10.406/2002','Regras de sociedades, empresa, contratos e obrigações.','https://www.planalto.gov.br/ccivil_03/leis/2002/l10406compilada.htm'],
  ['Lei das Sociedades por Ações — Lei nº 6.404/1976','Regime jurídico das sociedades por ações.','https://www.planalto.gov.br/ccivil_03/leis/l6404consol.htm'],
  ['Lei de Recuperação e Falências — Lei nº 11.101/2005','Recuperação judicial, extrajudicial e falência do empresário e da sociedade empresária.','https://www.planalto.gov.br/ccivil_03/_ato2004-2006/2005/lei/l11101.htm'],
  ['Código Tributário Nacional — Lei nº 5.172/1966','Sistema tributário nacional e normas gerais de Direito Tributário.','https://www.planalto.gov.br/ccivil_03/leis/l5172compilado.htm'],
  ['Lei de Execuções Fiscais — Lei nº 6.830/1980','Cobrança judicial da dívida ativa da Fazenda Pública.','https://www.planalto.gov.br/ccivil_03/leis/l6830.htm'],
  ['Lei nº 15.484/2026 — relevância no recurso especial','Regulamenta o regime de relevância das questões de direito federal infraconstitucional para admissão de recursos especiais.','https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2026/lei/l15484.htm'],
  ['Lei Complementar nº 123/2006','Estatuto Nacional da Microempresa e da Empresa de Pequeno Porte.','https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp123.htm']
 ]},
 {id:'labor',title:'Direito do Trabalho e Previdenciário',laws:[
  ['Consolidação das Leis do Trabalho — Decreto-Lei nº 5.452/1943','Normas gerais das relações individuais e coletivas de trabalho.','https://www.planalto.gov.br/ccivil_03/decreto-lei/del5452compilado.htm'],
  ['Lei nº 8.213/1991 — Planos de Benefícios da Previdência Social','Benefícios previdenciários e regras de concessão.','https://www.planalto.gov.br/ccivil_03/leis/l8213cons.htm'],
  ['Lei nº 8.212/1991 — Organização da Seguridade Social','Custeio da seguridade social.','https://www.planalto.gov.br/ccivil_03/leis/l8212cons.htm'],
  ['Lei Complementar nº 150/2015','Contrato de trabalho doméstico.','https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp150.htm'],
  ['Lei nº 15.371/2026 — licença-paternidade e salário-paternidade','Altera a CLT e as leis de custeio e benefícios da Previdência Social.','https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2026/lei/l15371.htm'],
  ['Lei nº 15.455/2026 — proteção de trabalhadores resgatados','Medidas de proteção e acolhimento de trabalhadores em condição análoga à escravidão e alterações correlatas.','https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2026/lei/l15455.htm']
 ]},
 {id:'ethics',title:'Advocacia, ética profissional e proteção de dados',laws:[
  ['Estatuto da Advocacia — Lei nº 8.906/1994','Exercício profissional, direitos, prerrogativas e organização da OAB.','https://www.planalto.gov.br/ccivil_03/leis/l8906.htm'],
  ['Código de Ética e Disciplina da OAB','Deveres éticos e disciplinares da advocacia.','https://www.oab.org.br/visualizador/19/codigo-de-etica-e-disciplina'],
  ['Provimento CFOAB nº 205/2021','Publicidade e informação na advocacia e marketing jurídico.','https://www.oab.org.br/leisnormas/legislacao/provimentos/205-2021'],
  ['Lei Geral de Proteção de Dados — Lei nº 13.709/2018','Tratamento de dados pessoais e direitos dos titulares.','https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm'],
  ['Marco Civil da Internet — Lei nº 12.965/2014','Princípios, garantias, direitos e deveres para o uso da internet.','https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2014/lei/l12965.htm']
 ]}
];
const root=document.querySelector('#law-results');let active='all';
function render(){const term=(document.querySelector('#law-search').value||'').toLocaleLowerCase('pt-BR');const groups=lawGroups.filter(g=>active==='all'||g.id===active).map(g=>({...g,laws:g.laws.filter(l=>l.join(' ').toLocaleLowerCase('pt-BR').includes(term))})).filter(g=>g.laws.length);root.innerHTML=groups.length?groups.map(g=>`<section class="law-group" id="${g.id}"><h2>${g.title}</h2>${g.laws.map(l=>`<article class="law-item"><div><strong>${l[0]}</strong><small>${l[1]}</small></div><a href="${l[2]}" target="_blank" rel="noopener noreferrer">Texto oficial ↗</a></article>`).join('')}</section>`).join(''):'<div class="empty-state">Nenhuma referência encontrada. Tente outro termo ou categoria.</div>';}
document.querySelector('#law-search').addEventListener('input',render);document.querySelectorAll('#law-filters button').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('#law-filters button').forEach(x=>x.classList.remove('active'));b.classList.add('active');active=b.dataset.filter;render()}));document.querySelector('#year').textContent=new Date().getFullYear();render();
