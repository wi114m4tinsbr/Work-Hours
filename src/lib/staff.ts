/** Staff powers the owner gives by Gmail (Firestore staff/{email}); firestore.rules checks the same names. */
export type Power = 'tickets' | 'users_view' | 'users_manage' | 'plans' | 'activity';
export type Powers = Partial<Record<Power, boolean>>;

type Lang = 'pt' | 'en' | 'es';

export const POWERS: { id: Power; label: Record<Lang, string>; hint: Record<Lang, string> }[] = [
  {
    id: 'tickets',
    label: { pt: 'Atender dúvidas e sugestões', en: 'Answer questions and suggestions', es: 'Atender dudas y sugerencias' },
    hint: { pt: 'Vê todas as ocorrências, aceita, conversa e fecha as que aceitou.', en: 'Sees every ticket, accepts, chats and closes the ones they accepted.', es: 'Ve todas las incidencias, acepta, conversa y cierra las que aceptó.' },
  },
  {
    id: 'users_view',
    label: { pt: 'Ver usuários e números', en: 'See users and numbers', es: 'Ver usuarios y números' },
    hint: { pt: 'Visão geral, gráficos e lista de usuários com e-mails.', en: 'Overview, charts and the user list with emails.', es: 'Resumen, gráficos y lista de usuarios con correos.' },
  },
  {
    id: 'users_manage',
    label: { pt: 'Gerenciar usuários', en: 'Manage users', es: 'Gestionar usuarios' },
    hint: { pt: 'Dar ou tirar plano, bloquear, banir e zerar limites. Nunca exclui dados nem mexe no dono.', en: 'Give or remove plans, block, ban and reset limits. Never deletes data or touches the owner.', es: 'Dar o quitar plan, bloquear, banear y reiniciar límites. Nunca borra datos ni toca al dueño.' },
  },
  {
    id: 'plans',
    label: { pt: 'Editar planos e limites', en: 'Edit plans and limits', es: 'Editar planes y límites' },
    hint: { pt: 'Acesso à aba Planos e ferramentas.', en: 'Access to the Plans and tools tab.', es: 'Acceso a la pestaña Planes y herramientas.' },
  },
  {
    id: 'activity',
    label: { pt: 'Ver atividade', en: 'See activity', es: 'Ver actividad' },
    hint: { pt: 'Histórico de ações feitas no painel.', en: 'History of actions taken in the panel.', es: 'Historial de acciones del panel.' },
  },
];

export const ALL_POWERS: Powers = Object.fromEntries(POWERS.map((p) => [p.id, true]));

export const hasAnyPower = (powers: Powers | null | undefined) => !!powers && POWERS.some((p) => powers[p.id]);

/** Someone counts as online while their page reported in during the last minute. */
export const ONLINE_MS = 60_000;
export const isOnline = (lastSeen: number | null | undefined, now = Date.now()) => !!lastSeen && now - lastSeen < ONLINE_MS;
