# Notificações de suporte — pedido pendente (03/10/2026)

Solicitado pelo proprietário durante a publicação da home Aurora. Ainda não implementado ou ativado.

## Comportamento desejado

- Aba Notificações, exclusiva do dono, com liga/desliga geral e por canal: e-mail, SMS e WhatsApp.
- Eventos: ocorrência criada e mensagem recebida em ocorrência não encerrada. Definir se respostas da própria equipe também geram alertas; evitar notificar o autor da mensagem sobre a própria ação.
- Destinos editáveis e verificados. Nenhuma credencial no navegador, Firestore público, repositório ou logs.
- Eventos disparados no servidor, mesmo com o site fechado. Gatilhos de criação de tickets/mensagens no banco nomeado, fila com identificador por evento/canal, deduplicação, tentativas limitadas e registro de entrega sem conteúdo sensível.
- Preferências rechecadas antes do envio; desligar cancela envios pendentes. Não enviar retroativamente todo o histórico ao ativar.
- WhatsApp opcional: número oficial intermediário, vinculação verificada ao usuário/chamado e consentimento. Encaminhar somente após aceitação, para o chamado correto e enquanto estiver ativo. Webhooks autenticados e deduplicados. Não publicar números pessoais.
- Ao encerrar, impedir novos encaminhamentos/respostas pelo sistema e preservar o histórico. Não é possível impedir alguém de enviar ao número no aplicativo WhatsApp nem revogar mensagens já entregues.
- Templates aprovados são necessários para notificações WhatsApp fora da janela de atendimento. Mostrar custos e configuração do provedor antes de ativar.

## Informações solicitadas ao proprietário

1. Já possui provedor de envio (ex.: WhatsApp Business Platform/Cloud API ou Twilio)? Não pedir segredos no chat.
2. Deseja WhatsApp por número oficial integrado ou apenas alertas com conversa no site?

## Antes da implementação

Confirmar o provedor, acesso de configuração, número remetente, domínio remetente de e-mail e canais iniciais. Não contratar serviços nem enviar mensagens de teste a destinos não confirmados. Implementar PT/EN/ES e autorização no servidor/regras, não apenas ocultação de abas.

Referências técnicas consultadas:
- https://firebase.google.com/docs/firestore/extend-with-functions
- https://www.twilio.com/docs/whatsapp/api
- https://www.twilio.com/docs/whatsapp/tutorial/send-whatsapp-notification-messages-templates
