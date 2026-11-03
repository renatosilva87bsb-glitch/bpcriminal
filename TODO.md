# TODO — B&P Advocacia Criminal

## Concluído — Base institucional e posicionamento

- [x] O site deve ser um escritório de advocacia completo, com especialização em Direito Penal e Prática Criminal.
- [x] A comunicação principal deve destacar: “Defesa intransigente dos seus direitos. Escritório com forte atuação em Direito Penal e Prática Criminal, preparado para intervir com rapidez e técnica nas situações mais delicadas.”
- [x] O site deve apresentar também assessoria jurídica integral nas áreas Cível, Família, Trabalhista e Previdenciária, com soluções seguras e acompanhamento próximo.
- [x] O endereço institucional deve aparecer como SCS Quadra 6, Bloco A, Lote 71, Sala 202 — Edifício José Severo, Asa Sul, Brasília/DF, CEP 70326-900.
- [x] O telefone principal do escritório deve aparecer como (61) 99420-0001 e o telefone de contato criminal como (61) 98289-3164.

## Concluído — Prontidão e contato

- [x] O site deve oferecer uma chamada de “Plantão Criminal 24h” para atendimento em flagrantes, delegacias e audiências de custódia, usando os canais informados pelo escritório.
- [x] A home deve permitir contato rápido por telefone e WhatsApp, além do formulário de solicitação inicial.
- [x] O formulário deve solicitar apenas dados mínimos de retorno, consentimento e área/natureza do contato; não deve solicitar relatos detalhados, documentos processuais ou informações sigilosas.
- [x] O site deve deixar claro que o envio do formulário não cria, por si só, relação advogado-cliente nem garante resultado.

## Concluído — Equipe profissional

- [x] Exibir Dr. Fernando — OAB 45.171/DF — admin@fernandoadv.com.br — (61) 9 9313-7555.
- [x] Exibir Dr. Diego — OAB 65.432/DF — diegobandeira.ad@gmail.com — (61) 9 8289-3164.
- [x] Exibir Dr. Antônio — OAB 68.791/DF — antoniojuniorajadv@gmail.com.
- [x] Preservar os retratos fornecidos em `assets/team/` e manter navegação para as páginas de atuação e biblioteca jurídica.

## Concluído — Qualidade de produto

- [x] Manter páginas públicas rastreáveis com conteúdo HTML inicial, metadados e sitemap/robots coerentes.
- [x] Manter navegação responsiva, menu mobile, skip link, foco visível e suporte a `prefers-reduced-motion`.
- [x] Registrar as rotas públicas em `public/manus-routes.json`.
- [x] Preservar a base server-side de leads e a área administrativa, sem expor segredos no frontend.
- [x] Executar checagens de sintaxe e testes existentes antes do checkpoint.

## Pendente antes de publicação definitiva

- [ ] Substituir o CNPJ informado pelo escritório após validação cadastral; o número fornecido na base é tratado como dado de demonstração.
- [ ] Configurar Supabase, secrets do endpoint de leads, domínio e canal oficial de privacidade antes de produção.
- [ ] Confirmar escala e capacidade operacional do Plantão Criminal 24h em todos os períodos anunciados.
- [ ] Confirmar autorização de uso institucional das fotografias e revisar textos conforme as regras éticas aplicáveis à publicidade da advocacia.


## Concluído — CRM jurídico interno e segurança operacional

- [x] Reaproveitar o Supabase conectado com isolamento por `tenant_id`, permissões `owner`, `admin`, `manager`, `agent` e `viewer`, sem criar um segundo modelo de escritório.
- [x] Integrar leads públicos diretamente a `customers`, com status `lead`, área, urgência, consentimento e `lead_request_id` idempotente.
- [x] Entregar módulos internos para processos, prazos, agenda, movimentações, honorários e procurações, com RLS por escritório e edição restrita a perfis operacionais.
- [x] Entregar histórico de contato via `legal_contact_events` com canal, direção, tipo e resumo operacional; a interface rejeita conteúdo de mensagens, documentos e dados sigilosos.
- [x] Entregar IA exclusivamente interna com autenticação, rate limit por usuário/tenant, bloqueio de dados sensíveis, backend Gemini, logs sem prompt/resposta e revisão humana obrigatória.
- [x] Entregar checklist editorial interno baseado no Provimento 205/2021, explicitamente sem certificação automática ou substituição da revisão do advogado/TED.
- [x] Registrar migrações SQL no projeto e manter scripts de sintaxe/testes executáveis.

## Pendente antes de ativar o CRM em produção

- [ ] Configurar no ambiente server-side `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` e `GEMINI_API_KEY`; nunca colocar `SUPABASE_SECRET_KEY` ou `GEMINI_API_KEY` no navegador.
- [ ] Criar o primeiro tenant, o usuário owner e os membros do escritório no Supabase Auth/`tenant_members`.
- [ ] Validar retenção, controle de acesso e exportação/eliminação de dados com o advogado responsável e o encarregado de proteção de dados.
- [ ] Validar presencialmente todas as afirmações institucionais, dados de OAB/CNPJ, autorização de fotografias, capacidade real do Plantão Criminal 24h e versão final dos textos com o responsável ou TED/OAB competente.

## Concluído — Publicação, OAuth e plantão

- [x] Criar o projeto Vercel `bandeiraepaulo`, publicar em produção e associar `https://bandeiraepaulo.vercel.app` como alias.
- [x] Configurar secrets de produção sem exibir valores, validar `/api/config` e manter as chaves secretas fora do bundle público.
- [x] Implementar `/api/google/oauth/start` e `/api/google/oauth/callback` com state anti-CSRF, troca server-side e sessão Supabase.
- [x] Destacar “Plantão Criminal 24h” em vermelho pulsante, preservando a ressalva de escala operacional e o suporte a `prefers-reduced-motion`.

## Concluído — Imagens institucionais de Brasília

- [x] Substituir os fundos genéricos da home por imagens locais do STF e do TJDFT, com enquadramento responsivo e otimização para web.
- [x] Exibir créditos, links de licença e aviso de ausência de vínculo institucional no rodapé.
