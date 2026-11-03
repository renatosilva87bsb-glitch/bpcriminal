# Plano de implementação — B&P Advocacia Criminal

## Escopo

Aprimorar o site institucional multipágina já enviado, preservando o conteúdo jurídico, as páginas públicas, a biblioteca de legislação, o formulário de contato, a área administrativa e os assets de equipe. A experiência deve comunicar prontidão, urgência e confiança, com prioridade clara para Direito Penal e Prática Criminal, sem prometer resultados e sem solicitar documentos sigilosos no primeiro contato.

## Abordagem de implementação

- Reaproveitar o stack HTML/CSS/JavaScript existente, sem introduzir framework ou bundler desnecessário.
- Manter as páginas públicas rastreáveis em HTML inicial: `/`, `/direito-criminal.html`, `/areas-de-atuacao.html`, `/legislacao.html` e `/privacidade.html`.
- Melhorar a hierarquia de conversão da home com chamada de urgência, CTAs para telefone/WhatsApp e formulário mínimo de retorno.
- Preservar o endpoint server-side de leads e o painel administrativo como base de integração futura; o frontend continua recusando relatos detalhados e documentos no formulário público.
- Adicionar manifesto de rotas para o Preview e preparar uma saída estática em `public/` para publicação do site.
- Ajustar a política de frame para permitir o Preview HTTPS embutido, sem expor credenciais ou dados operacionais.

## Estrutura do projeto

- `index.html`: página institucional, hero, proposta de valor, áreas, método, equipe, FAQ, conteúdo e contato.
- `direito-criminal.html`: página de aprofundamento do núcleo criminal e orientação para situações urgentes.
- `areas-de-atuacao.html`: áreas complementares e navegação editorial.
- `legislacao.html`: biblioteca pesquisável com fontes oficiais.
- `privacidade.html`: aviso de privacidade inicial para validação do escritório.
- `assets/site.css`: sistema visual responsivo, componentes, estados de foco e layout.
- `assets/site.js`: navegação mobile, ano automático, formulário e estados de envio.
- `assets/team/`: retratos fornecidos para os profissionais.
- `api/` e `admin/`: camada server-side/painel preservados para integração de leads e operação interna.
- `public/`: cópia de publicação estática e `manus-routes.json`.
- `plan.md` e `TODO.md`: decisões e resultados do trabalho.

## Design

### Alternativas consideradas

- **Editorial jurídico sóbrio** — tipografia clássica, tons de papel e azul-petróleo, com linguagem institucional. Probabilidade: 0,06.
- **Prontidão humana premium** — contraste forte, blocos de urgência, detalhes de cobre e ritmo editorial para equilibrar técnica e acolhimento. Probabilidade: 0,08.
- **Minimalismo cívico digital** — superfícies claras, navegação utilitária e sinais de serviço público. Probabilidade: 0,04.

### Direção escolhida: Prontidão humana premium

- **Movimento de design:** editorial jurídico contemporâneo com contraste de plantão e acabamento de banca boutique.
- **Princípios centrais:** resposta rápida sem alarmismo; autoridade traduzida em clareza; presença humana; informação com limites responsáveis.
- **Filosofia de cor:** azul-petróleo profundo cria estabilidade e confiança; papel quente reduz a frieza institucional; cobre/dourado sinaliza atenção e ação imediata.
- **Paradigma de layout:** narrativa em faixas alternadas, com hero dividido, cards de atuação em matriz editorial e seções de contato com peso visual próprio; evitar aparência de dashboard genérico.
- **Elementos assinatura:** faixa de urgência com ícone de balança, marcador numérico de seções e linhas finas em cobre conectando títulos e CTAs.
- **Interação:** CTAs diretos para WhatsApp/telefone; hover discreto; formulário com poucos campos e microcopy de segurança; menu mobile acessível.
- **Animação:** somente transições curtas de cor, espaçamento e deslocamento; respeitar `prefers-reduced-motion`; nenhuma animação que atrase o contato.
- **Tipografia:** Libre Baskerville para títulos e DM Sans para navegação, dados e instruções; títulos amplos, corpo compacto e labels com tracking.
- **Essência da marca:** defesa criminal com prontidão, técnica e acompanhamento próximo para quem precisa decidir com segurança. Personalidade: firme, humana, presente.
- **Tom de voz:** direto, acolhedor e responsável; sem promessa de resultado. Exemplos: “Em situações delicadas, cada minuto importa.” e “Conte o essencial. A equipe orienta o próximo passo.”
- **Wordmark/logotipo:** monograma `B&P` com ampersand em cobre e divisor vertical, acompanhado de assinatura editorial “Consultoria e atuação jurídica”.
- **Cor proprietária:** cobre queimado `#B98A57`, aplicado nos marcadores de urgência, foco e links de ação.

## Fluxo completo de construção

1. Integrar a base enviada no projeto gerenciado.
2. Atualizar conteúdo institucional com a mensagem de prontidão, dados da equipe e chamada de Plantão Criminal 24h.
3. Refinar o sistema visual e os estados responsivos, mantendo acessibilidade e redução de movimento.
4. Registrar todas as páginas em `public/manus-routes.json`.
5. Configurar diagnóstico JavaScript/HTML/CSS, executar `npm run check` e os testes de leads.
6. Iniciar o Preview na porta configurada, verificar respostas HTTP e rotas.
7. Criar checkpoint no repositório canônico; publicação fica condicionada à configuração real de domínio, Supabase e secrets do atendimento.
