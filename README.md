# B&P Advocacia — operação e manutenção

O site está hospedado na Vercel em https://bandeiraepaulo.vercel.app. O painel interno está em `/admin`. A aplicação usa HTML, CSS e JavaScript, com endpoints Node.js no mesmo domínio e Supabase Auth/Postgres. O ambiente Manus utiliza `server.mjs` na porta 3000; a produção respeita `PORT`. As tabelas e as migrações existentes foram preservadas e ampliadas de forma aditiva.

## Entrada e equipe

A conta master de teste solicitada foi criada em Supabase Auth e vinculada ao escritório como `owner`. Sua senha não está no repositório. Troque a senha informada para teste em **Minha conta / senha**, usando pelo menos 12 caracteres, antes de utilizar dados reais. Não compartilhe a conta master.

Em **Minha conta / senha**, proprietários e administradores podem liberar contas de associados já registradas. O associado entra uma primeira vez com Google, mas permanece sem acesso a dados até a liberação. O administrador informa o mesmo e-mail e atribui `admin`, `manager`, `agent` ou `viewer`. Nenhuma conta Google recebe permissão administrativa automaticamente. O proprietário não pode ser alterado por essa tela.

O isolamento é por `tenant_id`. Contas de mais de um escritório usam um seletor explícito, e APIs negam contexto ambíguo; referências de cliente/processo/conversa são conferidas no endpoint e em triggers no banco. Perfis operacionais têm acesso aos registros jurídicos do próprio escritório; não há isolamento individual de cada processo por advogado nesta versão. `viewer` é somente leitura, exclusões jurídicas exigem `owner`/`admin`, e honorários são exibidos a `owner`/`admin`/`manager`. Regras RLS e funções autenticadas são a barreira de autorização, não apenas os botões da interface.

## Leads, CRM e IA

Leads do formulário público são enviados a `/api/leads`, validados, deduplicados por `request_id` e gravados no escritório configurado em `PUBLIC_LEAD_TENANT_ID`. Quando essa variável não existe, só é aceito um banco que contenha exatamente um escritório. A coleta é mínima: contato, área e urgência, com consentimento, honeypot e limite de cinco novos envios por minuto por hash de origem, sem armazenar IP em texto. Não há envio de mensagens WhatsApp automático; os botões abrem o WhatsApp, e o CRM registra somente eventos operacionais de contato.

A IA interna está em `/api/ia` e usa `gemini-3.5-flash-lite` por padrão, com chave exclusiva do backend, limite de 20 usos por minuto/usuário/escritório e revisão humana explícita. São registrados hashes e metadados, não prompts ou respostas. O bloqueio identifica padrões de CPF, processo, telefone, e-mail e credenciais: não é garantia de anonimização e não detecta toda informação sigilosa. O advogado deve remover dados pessoais e segredos antes de enviar texto. O provedor Google recebe o texto sanitizado para a geração.

## Google Agenda, Drive e Contatos

Em **Google e documentos**, cada advogado conecta uma conta profissional, autoriza os serviços e consulta o estado de cada permissão. A autorização precisa ser concluída pelo titular; o cadastro das credenciais no servidor não substitui o consentimento. Refresh tokens são cifrados com AES-256-GCM e ficam em tabelas restritas ao serviço. A chave de cifragem é derivada do `GOOGLE_CLIENT_SECRET`; sua rotação exige reconectar as integrações.

O callback compartilhado é `https://bandeiraepaulo.vercel.app/api/google/oauth/callback`. No mesmo projeto Google Cloud das credenciais, habilite **Google Calendar API, Google Drive API e People API**. Configure o consentimento OAuth e, caso o aplicativo esteja em teste, inclua os e-mails autorizados como usuários de teste. Escopos sensíveis podem exigir verificação do aplicativo pelo Google para distribuição ampla.

**Agenda:** o botão Agenda envia/atualiza um evento privado de uma hora e lembrete de 30 minutos. O título é operacional e genérico, sem nome do cliente, processo, relato, notas ou local confidencial. Reenvios usam um identificador determinístico. Alterações feitas no Google não são importadas automaticamente para o CRM. Não há monitoramento dos sistemas judiciais nem cálculo automático de prazo processual.

**Drive:** use Preparar pasta privada e depois Enviar documento. A aplicação cria uma pasta da conta conectada com escopo `drive.file`, lista seus arquivos e aceita PDF, DOCX, JPG, PNG e TXT até 2 MB. Não compartilha arquivos publicamente. A mesma pasta não é automaticamente comum a todos os advogados: cada conexão utiliza a conta autorizada; compartilhamento pelo Google Drive é decisão do titular e da política do escritório. O CRM não lê todo o Drive pessoal. Não há verificação antivírus dos documentos nesta versão.

**Contatos:** o botão Contato exporta nome, telefone e e-mail de cliente ativo com consentimento `opted_in`. Os vínculos persistidos atualizam o contato existente em reenvios; um lock transacional impede criações simultâneas para o mesmo vínculo. Não importa contatos pessoais do Google, não exporta anotações e não faz sincronização bidirecional automática.

Desconectar remove o vínculo e o token do CRM, mas não apaga arquivos/eventos já criados nem revoga toda a autorização do aplicativo no Google. Para revogação total use também a segurança da conta Google.

## Tema, PWA e push

A preferência `auto`/`light`/`dark` é persistida localmente; em automático acompanha mudanças do sistema. `assets/themes.css` é uma camada separada, para preservar o stylesheet principal. O PWA possui manifesto, ícones e service worker. Somente páginas públicas são cacheadas; painel, APIs e dados internos não recebem fallback offline.

Push exige uma sessão autorizada, browser compatível e consentimento do dispositivo. A ativação oferece teste para inscrições do próprio usuário. Mensagens são genéricas e não contêm dados de clientes. Chaves VAPID estão em produção e a chave privada nunca é enviada ao navegador. Esta versão não inclui um serviço agendado que envie push de prazos com o painel fechado: os alertas estão no dashboard e nos lembretes dos eventos exportados para Google Agenda. Instalabilidade e push variam por navegador; no iOS, notificações PWA exigem instalação na tela inicial.

## Notícias e conteúdo profissional

O painel de notícias agrega fontes oficiais STF, STJ e CNJ através de `/api/news`. Cache e atualização da página são de cinco minutos. Não é streaming em tempo real nem redação produzida por IA. Uma fonte indisponível é informada e não impede a leitura das demais. Títulos têm link para a origem; datas só devem ser apresentadas quando fornecidas pela fonte.

A home utiliza fotografias STF/TJDFT com créditos e licenças em `research/site-images.md`; são referências arquitetônicas, sem indicação de vínculo ou endosso. As fotografias de equipe vieram do projeto fornecido.

O checklist baseado no Provimento 205/2021 é um apoio editorial, não parecer ou certificado OAB. Continuam necessários confirmação de dados cadastrais/OAB, qualificações, autorização de imagens, escala real 24h e revisão do aviso de privacidade e conteúdo pelo advogado responsável, e consulta ao TED competente quando pertinente. O CNPJ fictício da base foi removido; nenhum CNPJ real foi inventado. A biblioteca jurídica é curadoria com links oficiais, não uma garantia de redação vigente ou catálogo integral.

## Estrutura e credenciais

`api/` contém endpoints de leads, IA, contato, push e Google. `_auth.js` autentica usuários e seleciona escritório; `_google.js` centraliza estado OAuth, cifragem e chamadas externas. `admin/app.js` organiza as telas de CRM. `assets/` guarda scripts/estilos/imagens; `public/` é a cópia de distribuição e deve ficar sincronizada. `supabase/migrations/` registra as alterações do banco. `archive/` preserva originais e é excluído da distribuição Vercel.

Secrets de produção: `SUPABASE_SECRET_KEY`, `GEMINI_API_KEY`, `GOOGLE_CLIENT_SECRET` e `VAPID_PRIVATE_KEY`. Configuração adicional: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `GOOGLE_CLIENT_ID`, `PUBLIC_SITE_URL`, `PUBLIC_LEAD_TENANT_ID`, `VAPID_PUBLIC_KEY`, `VAPID_SUBJECT` e opcional `GEMINI_MODEL`. Não registre valores reais nos arquivos, logs ou bundles públicos. As credenciais que foram compartilhadas em chat devem ser rotacionadas pelo proprietário em seus provedores e recadastradas nos ambientes antes do uso de dados reais.

Não aplique `supabase/schema.sql` sobre o projeto conectado: ele é uma base legada. Use migrações aditivas após backup e revisão. Desenvolvimento e produção compartilham o banco: testes não devem criar dados fictícios em tabelas de clientes ou processos.

## Qualidade e publicação

Execute `npm ci`, `npm run check` e `npm test`. Os testes cobrem leads com tenant e idempotência, segurança de estado OAuth, cifragem, autenticação obrigatória e origem das integrações. Cache fixo de CSS/JS é revalidado para evitar que versões quebradas permaneçam um ano no navegador. `sw.js` usa atualização sem cache no servidor e limpa caches antigos.

Salvar checkpoint Git não é o mesmo que publicar. Após o checkpoint, publique na Vercel e confira home, `/admin`, assets, manifest, service worker, `/api/config`, início OAuth HTTP 302 e APIs autenticadas. Consentimento Google e notificações reais precisam da participação do titular/dispositivo e não podem ser certificados com uma requisição HTTP anônima.

## Verificação desta entrega

A publicação de 03/11/2026 foi validada no domínio informado: home e painel HTTP 200, CSS completo de 27 KB, assets de tema/PWA/CRM iguais aos arquivos de distribuição, notícias oficiais HTTP 200, início OAuth HTTP 302, sessão master real no browser e geração autenticada de IA HTTP 200 com revisão humana obrigatória. A consulta Google retornou `connected:false`: o consentimento do titular continua pendente. A suíte passou com 16 testes. Nenhum cliente, processo ou documento fictício foi criado no banco para esses testes.
