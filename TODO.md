# B&P Advocacia — estado de entrega

## Site profissional e acesso

- [x] Preservar e melhorar o site institucional do projeto enviado, responsivo e com foco criminal, links de WhatsApp, equipe e imagens licenciadas do STF/TJDFT com créditos e sem sugerir vínculo institucional.
- [x] Restaurar o CSS completo e manter raiz/public sincronizadas, evitando sobrescrita que quebre o site; revalidar assets de URL fixa e atualizar caches do PWA.
- [x] Disponibilizar notícias oficiais STF/STJ/CNJ com fonte e link original, cache/atualização a cada cinco minutos, sem vender a consulta periódica como streaming em tempo real.
- [x] Destacar Plantão Criminal 24h em vermelho pulsante com ressalva de escala operacional e respeito à redução de movimento.
- [x] Corrigir metadados para o domínio solicitado `https://bandeiraepaulo.vercel.app`; remover o CNPJ fictício, sem inventar inscrição real.

## CRM multiusuário e IA interna

- [x] Criar a conta master de teste solicitada, vinculada como owner ao escritório; validar autenticação real e leitura dos módulos do próprio escritório sob RLS. A senha não fica no código. Oferecer troca de senha no painel.
- [x] Disponibilizar gestão de associados existentes por e-mail e papel, restrita a owner/admin; Google não concede permissões administrativas automaticamente. Proibir mudança do proprietário e da própria permissão nessa tela.
- [x] Usar permissões por usuário e escritório, contexto explícito quando houver múltiplos memberships, e negar APIs com contexto ambíguo ou não autorizado. Restringir honorários também no banco.
- [x] Leads públicos entram diretamente no tenant institucional do CRM, com consentimento, idempotência, honeypot, limite de cinco envios por minuto/origem e somente hash da origem no controle de limite.
- [x] Registrar contatos WhatsApp somente como eventos operacionais, sem copiar mensagens; conferir referências customer/conversation no tenant e impor referências jurídicas por triggers no banco.
- [x] IA exclusivamente interna, chave no backend, autenticação/autorizações, limite de 20 usos/minuto/usuário/escritório, bloqueio de padrões identificáveis e logs de hashes/metadados sem prompt/resposta. Teste real gerou 200 usando modelo disponível. A sanitização e revisão humana continuam obrigatórias; o filtro não é anonimização garantida.

## Google, tema, PWA e alertas

- [x] Corrigir redirecionamento OAuth HTTP 302 e criar sessão Supabase com os tokens antes de limpar o fragmento da URL. Provedor Google habilitado no Supabase.
- [x] Tela Google e documentos com estado de conexão e permissões, instruções claras, callback protegido por state, tokens cifrados somente no backend, erro útil e desconexão.
- [x] Agenda exporta/atualiza individualmente compromisso privado e genérico, sem nomes de clientes/processos/notas, com duração de uma hora e lembrete de 30 minutos. Identificador determinístico evita reenvios duplicados.
- [x] Drive limitado a pasta/arquivos criados pelo app (`drive.file`), com upload/listagem de PDF, DOCX, JPG, PNG e TXT até 2 MB. Sem compartilhamento público automático. Cada advogado autoriza sua própria conta.
- [x] Contatos exporta nome/telefone/e-mail somente de cliente ativo com consentimento; guarda vínculo e usa lock transacional contra criações simultâneas. Não importa agenda ou contatos pessoais e não oferece sincronização bidirecional automática.
- [x] Claro/escuro/automático com persistência e atualização ao alterar o sistema; estilos separados e contraste no site e no painel.
- [x] PWA com manifesto/ícones, instalação conforme navegador e cache somente público. Não cachear painel/API nem oferecer fallback com dados privados. Push exige consentimento e sessão, aceita somente provedores conhecidos e envia mensagens genéricas; teste é restrito ao próprio usuário.
- [x] Dashboard mostra prazos e agenda; lembretes Google nos eventos exportados. Não há monitoramento judicial nem cálculo automático de prazo.

## Liberação definitiva — pendências reais

- [ ] Publicar esta rodada de correções na Vercel e validar sua versão em produção. O deployment anterior está no ar; o novo ainda deve ser confirmado.
- [ ] Concluir consentimento da conta Google do titular e testar um evento, contato autorizado e documento próprios. Se o Google Cloud exigir, habilitar Calendar/Drive/People APIs, usuários de teste ou verificação do aplicativo. Credenciais cadastradas não provam autorização concluída.
- [ ] Permitir notificações no dispositivo real e conferir recebimento do teste. Push depende do navegador, sistema e permissão do usuário.
- [ ] Serviço de push agendado de prazos com o painel fechado não foi ativado; nesta versão os alertas são no CRM e nos eventos enviados à Agenda.
- [ ] Trocar a senha master de teste antes do uso real e rotacionar credenciais secretas compartilhadas no chat, atualizando os ambientes sem registrar valores em arquivos.
- [ ] Confirmar dados cadastrais, inscrições OAB, qualificações, autorização de fotografias e existência real da escala 24h. Revisar conteúdo e aviso de privacidade por advogado responsável e, quando necessário, consultar o TED/OAB competente. Checklist editorial não certifica conformidade.
