# Plano de implementação — B&P Advocacia

A direção aprovada é aproveitar o projeto enviado e preservar sua identidade sóbria: paleta grafite, off-white e bronze, tipografia editorial, retratos existentes e imagens licenciadas do STF/TJDFT com atribuição. O destaque de plantão usa vermelho pulsante lento e redução de movimento. A interface deve parecer institucional, sem promessa de resultado, comparação profissional ou vínculo com o Judiciário.

## Estrutura e publicação

As páginas HTML e `assets/` permanecem a fonte; `public/` é a distribuição equivalente. `assets/themes.css` controla temas sem substituir o CSS principal. `admin/` contém o CRM, os menus e os controles explícitos de Google, equipe, senha, IA e revisão editorial. `api/` reúne handlers Node; `_auth.js` valida sessão e tenant, `_google.js` centraliza Google, cifragem e estado OAuth. `server.mjs` entrega conteúdo público e APIs no mesmo listener. O Dockerfile instala dependências para publicação container; Vercel reconhece o servidor Node e serve o domínio solicitado. Não é necessário criar uma Function para cada caminho Google: sua disponibilidade deve ser confirmada por HTTP no deployment real.

`supabase/migrations/` registra mudanças aditivas de CRM, RLS, auditoria, limites, tokens Google, vínculos/locks de contatos, equipe e referências cross-tenant. Auth e banco já conectado são preservados; não reaplicar o schema legado. Secrets existem só nos ambientes de backend, nunca em arquivos públicos. Checkpoint e publicação são ações separadas; confirmar ambos.

## Produto e limites materiais

O CRM usa `tenants`/`tenant_members`, papéis owner/admin/manager/agent/viewer e seletor quando houver múltiplos escritórios. Leads validados entram no tenant institucional; contatos WhatsApp registram apenas eventos operacionais. A conta master de teste deve trocar a senha. Associados existentes são liberados pelo administrador, não recebem acesso por entrar com Google.

A IA é interna, autenticada e limitada. Gera rascunhos com sanitização prévia e revisão humana; armazena hashes/metadados, não texto. O modelo padrão é o estável disponível validado na conta. Filtros de padrões não garantem remoção de todo dado pessoal ou sigiloso.

Google usa consentimento individual e tokens cifrados server-side. Agenda e Contatos são exportações explícitas CRM→Google, com idempotência e locks; não há importação automática de alterações externas. Drive usa pasta do app e escopo restrito, upload/listagem até 2 MB, sem compartilhar publicamente. Dados sigilosos não são incluídos em eventos de calendário. Google APIs, consentimento e eventual verificação do aplicativo são requisitos externos do titular.

Temas persistem e acompanham o sistema no modo automático. O PWA cacheia somente páginas públicas. Push requer consentimento de dispositivo e usa mensagens genéricas, sem dados de casos. Alertas processuais no dashboard e lembretes de eventos Google não equivalem a monitoramento de sistemas judiciais ou a um serviço de push agendado com o painel fechado.

O canal de notícias consulta fontes oficiais em janelas de cinco minutos, sem geração automática de análise jurídica nem alegação de streaming. O checklist editorial organiza revisão do Provimento 205/2021, mas a confirmação cadastral e ética pertence ao advogado responsável/TED competente. Remover dados fictícios é obrigatório; não inventar os dados ainda não fornecidos.
