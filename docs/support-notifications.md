# Notificações de suporte — Telegram

Implementação inicial de 03/10/2026. Ativação depende da configuração e do vínculo confirmado pelo dono. Não anunciar como ativo antes de enviar e receber um teste real.

## Comportamento

- Aba Admin → Notificações, somente para a conta Google martinswilliam2004@gmail.com. Autorização também no servidor.
- Bot @ShiftHoursAvisoBot. Preferências por abertura, aceite e mensagem; controle separado para respostas.
- Avisos de mensagens e respostas apenas em ocorrências aceitas pelo dono. Aceites da staff geram aviso, mas não habilitam respostas à ocorrência atribuída a outra pessoa.
- Chat do usuário permanece no site. Respostas Telegram são texto, até 4.000 caracteres, usando Responder no aviso específico. Arquivos, áudio e mensagens avulsas não são encaminhados.
- Encerramento, desativação e deduplicação verificados numa transação no banco antes da resposta. /stop desliga alertas e respostas.
- Vínculo pessoal, de uso único, expira em 10 minutos. Não basta enviar /start ao bot: é necessário abrir o link gerado após login do dono no painel. Recriar vínculo invalida os avisos antigos para resposta.
- Somente Production pode configurar webhook e enviar. Preview não mexe no bot; ambos usam o mesmo Firebase.
- E-mail, SMS e WhatsApp não implementados, sem contratação.

## Configuração segura

1. Vercel, projeto work-hours, variável Secret TELEGRAM_BOT_TOKEN. O dono informou que salvou e iniciou o bot. Não verificar o valor por logs.
2. Variável Secret FIREBASE_SERVICE_ACCOUNT contendo JSON de conta de serviço do projeto gen-lang-client-0275590292 com permissão Cloud Datastore User (roles/datastore.user). Não é a configuração web do Firebase. Não colocar em VITE_*, código, repositório ou conversa. Preferir conta dedicada de menor privilégio.
3. Novo deploy de Production após salvar variáveis. Banco nomeado ai-studio-df43dc48-1bac-453f-8185-49b595d5483a.
4. Dono entra em shifthours.com → Admin → Notificações → Conectar meu Telegram, abre o link pessoal e toca Iniciar. Atualizar, habilitar avisos e Salvar; Enviar teste.
5. Confirmar com ocorrência real de teste, aceite pelo dono, mensagem do usuário e resposta; fechar ocorrência e conferir recusa de nova resposta.

## Limitações e entrega

Esta primeira versão dispara o endpoint autenticado após a gravação da ação no site, com até três tentativas no navegador. O dono pode estar offline. Não há gatilho Firestore nem fila durável independente do navegador: fechamento da aba/rede interrompida nesse intervalo pode perder o aviso. Escritas externas ao app não disparam alertas. O histórico do suporte não é revertido quando o aviso falha.

Eventos anteriores à ativação ou com mais de dez minutos não são reenviados. Entregas possuem chave por evento. Telegram não oferece chave de idempotência para sendMessage: timeout ambíguo é marcado como entrega não confirmada e não reenviado automaticamente, para evitar duplicação. A aba mostra o alerta. Chamadas já enviadas ao Telegram não podem ser canceladas por um desligamento simultâneo.

Próxima evolução para entrega garantida: outbox transacional ou gatilhos Firestore com fila, retentativas e retenção. Exige avaliar infraestrutura e custos antes de ativar. Coleções internas supportPrivate, supportDeliveries, supportLimits, supportTelegramMessages e supportTelegramUpdates não têm regras de acesso cliente (negação padrão). Credenciais usadas apenas no servidor.

## Verificação

Testes de autorização, segredo de webhook, vínculo expirado/grupo, destino, atualização repetida, encerramento, atribuição, desativação e /stop. Interface PT/EN/ES, temas e celular com testes de navegador. Validação real de entrega permanece pendente até configurar e vincular.

Referências: https://core.telegram.org/bots/api e https://firebase.google.com/docs/admin/setup
