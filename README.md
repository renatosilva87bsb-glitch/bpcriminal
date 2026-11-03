# B&P Advocacia — Site institucional v3

Site institucional estático, com páginas jurídicas editoriais, biblioteca de legislação, formulário público protegido por função server-side e painel administrativo autenticado pelo Supabase.

## Estrutura

- `index.html`: página institucional.
- `direito-criminal.html`: página principal do núcleo criminal.
- `areas-de-atuacao.html`: áreas jurídicas complementares.
- `legislacao.html`: índice pesquisável de legislação com links para fontes oficiais.
- `privacidade.html`: aviso inicial de privacidade (requer validação e preenchimento pelo escritório).
- `admin/index.html`: painel administrativo legado preservado visualmente, agora com login Supabase Auth e chamadas REST usando JWT do usuário.
- `api/config.js`: entrega somente URL e publishable key do Supabase.
- `api/leads.js`: valida e recebe solicitações; usa segredo Supabase exclusivamente no servidor, honeypot, validação e rate limit no banco.
- `api/push-subscribe.js` e `api/push-send.js`: inscrição autenticada e envio administrativo de notificações Web Push.
- `manifest.webmanifest`, `sw.js` e `assets/pwa.js`: PWA instalável com cache de shell e suporte a notificações push.
- `deploy/setup-github-ssh.ps1`: gera uma chave SSH Ed25519 local para autenticação GitHub no Windows.
- `supabase/schema.sql`: schema inicial com RLS, isolamento por escritório e função server-side para leads.
- `archive/`: cópia dos HTML originais enviados, para referência/rollback. A pasta é excluída do deploy Vercel por `.vercelignore`, pois contém a implementação antiga e insegura.

## Requisitos

- Projeto Supabase.
- Projeto Vercel conectado ao repositório.
- Node.js 22+ para verificações locais (não é necessário build para o site estático).

## Configuração Supabase

1. Crie um projeto Supabase na região mais próxima do público atendido.
2. No SQL Editor, execute `supabase/schema.sql` em um projeto novo.
3. Em Authentication > Providers, mantenha habilitado Email/Password.
4. Desabilite public sign-ups para o painel interno. Crie usuários administrativos manualmente em Authentication > Users.
5. Crie a banca e vincule o primeiro usuário. Substitua os valores no exemplo abaixo pelos UUIDs reais:

```sql
insert into public.firms(legal_name, display_name)
values ('RAZÃO SOCIAL OFICIAL VALIDADA', 'B&P Advocacia')
returning id;

insert into public.firm_memberships(firm_id, user_id, role)
values ('UUID_DA_FIRMA', 'UUID_DO_USUARIO_AUTH', 'owner');
```

6. Configure as URLs de redirect do Supabase Auth para o domínio final e para o domínio de preview necessário.
7. Nunca coloque `SUPABASE_SECRET_KEY` ou `SUPABASE_SERVICE_ROLE_KEY` no HTML, em variáveis `VITE_*` ou em qualquer bundle público.

### Variáveis de ambiente na Vercel

Cadastre em Project > Settings > Environment Variables:

- `SUPABASE_URL`: URL do projeto.
- `SUPABASE_PUBLISHABLE_KEY`: publishable key (ou `SUPABASE_ANON_KEY` em projetos legados).
- `SUPABASE_SECRET_KEY`: secret key server-side (ou `SUPABASE_SERVICE_ROLE_KEY` em projetos legados).
- `LEAD_HASH_SECRET`: segredo aleatório forte, exclusivo, com pelo menos 32 bytes.
- `PUBLIC_SITE_URL`: `https://bandeiraepaulo.adv.br`.
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`: chaves e identificação Web Push. A chave privada nunca deve ser exposta no frontend.

Use ambientes separados para Production, Preview e Development. Não comite valores reais.

## Deploy Vercel

1. Faça commit da pasta do projeto em um repositório Git.
2. Importe o repositório na Vercel, sem framework preset e sem build command.
3. Defina a pasta raiz como a raiz do projeto.
4. Configure as variáveis de ambiente acima.
5. Faça deploy e teste primeiro em Preview.
6. Adicione `bandeiraepaulo.adv.br` e `www.bandeiraepaulo.adv.br` em Vercel > Settings > Domains. Configure no provedor DNS os registros exatamente indicados pela Vercel; defina o domínio raiz como principal e redirecione `www` para o raiz.
7. Confirme HTTPS e teste `https://bandeiraepaulo.adv.br/api/config` (deve retornar 503 até configurar Supabase; nunca deve expor segredo).

## PWA, notificações push e Git por SSH

- O site inclui `manifest.webmanifest`, ícones, service worker, cache offline do shell e tratamento de notificações recebidas. A instalação depende de HTTPS e suporte do navegador.
- O painel possui ação para solicitar permissão e registrar a inscrição push do usuário autenticado. O envio é restrito a usuários `owner` ou `admin` do escritório.
- Gere as chaves VAPID localmente com `npx web-push generate-vapid-keys` (após `npm install`) e cadastre `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` e `VAPID_SUBJECT` na Vercel. A chave pública é disponibilizada pelo endpoint `/api/config`; a privada fica somente no servidor.
- O schema cria `push_subscriptions` com RLS por usuário e escritório. Reexecute o arquivo completo apenas em projeto novo; em projeto já inicializado, aplique a seção de migração correspondente após revisão.
- Notificações não devem conter nomes de clientes, números de processos, dados pessoais ou conteúdo coberto por sigilo. Use mensagens genéricas.
- Para GitHub SSH no Windows, execute `powershell -ExecutionPolicy Bypass -File .\deploy\setup-github-ssh.ps1`, cadastre a chave pública em GitHub e teste `ssh -T git@github.com`. A chave privada fica no computador local e não deve ser enviada ao repositório.
- Vercel é uma plataforma serverless: não há SSH de shell para o runtime de produção. Deploy recomendado por Git (push para GitHub) ou Vercel CLI. SSH aqui autentica o Git com GitHub, não abre terminal da Vercel.

### Domínio e identidade provisória

- Domínio canônico configurado no projeto: `https://bandeiraepaulo.adv.br`. DNS, validação de domínio e certificado TLS ainda precisam ser concluídos no painel do registrador/Vercel.
- O CNPJ `00.000.000/0001-00` foi inserido apenas como **modelo fictício solicitado**. Não é um CNPJ válido e deve ser substituído antes de publicar o site.
- `VAPID_*`, Supabase e demais secrets permanecem sem valores no repositório. Configure-os nos ambientes Production, Preview e Development conforme necessário.

## Segurança e limites conhecidos

- O site público não tem acesso direto às tabelas operacionais ou tabelas de CMS. Solicitações são encaminhadas por `/api/leads`, com identificador idempotente, validação, honeypot e rate limit por IP pseudonimizado. A publicação dinâmica de artigos/equipe ainda exige endpoint público com mapeamento seguro de domínio para `firm_id`.
- O painel usa Supabase Auth. O acesso aos registros é filtrado por RLS com `firm_id` obtido da associação autenticada.
- A função `create_public_lead` é executável somente por `service_role`; não conceda execução a `anon` ou `authenticated`.
- O painel administrativo mantém módulos operacionais da versão anterior. A IA jurídica foi desativada porque a versão anterior enviava chaves e dados diretamente do navegador. Só deve ser reativada com backend seguro, autorização e política de dados.
- A base SQL é inicial, não uma migração automática do schema inseguro anterior. Não execute em produção com dados existentes sem backup e plano de migração. O endpoint público de leads encaminha para a primeira firma cadastrada; esta entrega está preparada para um escritório/domínio por deploy. Para múltiplos escritórios no mesmo projeto, implemente e teste o mapeamento host → `firm_id` antes de ativar novos domínios.
- O formulário coleta somente dados mínimos de contato e área geral. Não solicite relatos detalhados, dados de terceiros, documentos processuais ou informações sensíveis nele.
- As tabelas de artigos, equipe e áreas estão preparadas no banco, mas a publicação dinâmica no site e a edição desses conteúdos pelo painel ainda não foram conectadas nesta versão. O site público usa conteúdo editorial estático revisável.
- O aviso de privacidade é um modelo inicial, não parecer jurídico. O controlador deve preencher identidade, contato, bases legais, retenção, operadores e transferências antes de publicar.
- O índice legal é uma curadoria inicial de diplomas federais relevantes e incorpora alterações selecionadas até 03/11/2026 (incluindo Leis nº 15.358/2026, 15.384/2026, 15.397/2026, 15.402/2026, 15.438/2026, 15.455/2026, 15.487/2026 e 15.517/2026). Não contém literalmente todas as leis federais, estaduais e municipais. Os links apontam para fontes oficiais; a redação vigente, vetos, vigência e jurisprudência precisam ser conferidos antes de uso profissional.

## Testes locais

```bash
npm run check
```

Sirva a pasta com um servidor local para testar navegação e layout. O formulário e o painel dependem de variáveis Supabase e não devem simular sucesso quando não configurados.

## Pendências de conteúdo antes da publicação

- Validar razão social, CNPJ, endereço, telefone, e-mail e domínio.
- Confirmar equipe, OAB, formação, biografias e áreas realmente prestadas.
- Substituir as fotografias ilustrativas externas por fotografias licenciadas ou autorizadas do escritório e profissionais; confirmar a licença/atribuição das imagens de banco utilizadas antes da publicação.
- Validar o conteúdo institucional e a publicidade conforme Código de Ética e Provimento CFOAB nº 205/2021.
- Revisar o aviso de privacidade e definir canal de direitos dos titulares.
- Validar se o atendimento 24h é realmente prestado antes de divulgar plantão contínuo.

## Atualização institucional da equipe (03/11/2026)

- Retratos fornecidos pelo escritório em `assets/team/` e apresentados nos perfis de Dr. Diego Bandeira, Dr. Antônio Júnior e Dr. Fernando.
- OAB/DF informadas: 65.432, 68.791 e 45.171, respectivamente. E-mails e telefones individuais constam nos perfis do site.
- Telefones institucionais informados: (61) 99420-0001 e (61) 98289-3164.
- Endereço informado: SCS Quadra 6, Bloco A, Lote 71, Sala 202, Edifício José Severo, Asa Sul, Brasília/DF, CEP 70326-900.
- Posicionamento editorial atualizado: banca híbrida/multidisciplinar, com foco principal em Direito Criminal e atuação complementar Cível, Família, Trabalhista e Previdenciária.
- O CNPJ `00.000.000/0001-00` é um modelo fictício solicitado para visualização e não deve ser tratado como registro válido. Substituir pelo CNPJ real antes de publicar.
- Não foi anunciado “Plantão Criminal 24h” como serviço confirmado. A página criminal orienta contato em urgências e condiciona a divulgação de atendimento 24 horas à existência de escala e capacidade operacional real.
- As informações de equipe e OAB devem ser revisadas pelos próprios profissionais; as fotos foram fornecidas pelo solicitante e devem ter autorização de uso institucional confirmada.
