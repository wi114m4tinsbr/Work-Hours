/**
 * Public "Atualizações" list for signed-in users: only what people notice on the site.
 * Never list internal details (security, servers, keys, limits enforcement).
 * Newest first. Add an entry whenever a visible change ships.
 */
export type UpdateKind = 'new' | 'improved' | 'fixed' | 'removed';

export interface UpdateEntry {
  date: string; // YYYY-MM-DD
  kind: UpdateKind;
  pt: { title: string; body: string };
  en: { title: string; body: string };
  es: { title: string; body: string };
}

export const UPDATES: UpdateEntry[] = [
  {
    date: '2026-10-03', kind: 'improved',
    pt: { title: 'Avisos de suporte mais claros', body: 'Os avisos no Telegram agora separam usuário, ocorrência e mensagem, com instruções mais claras para responder.' },
    en: { title: 'Clearer support alerts', body: 'Telegram alerts now separate the user, ticket and message, with clearer reply instructions.' },
    es: { title: 'Avisos de soporte más claros', body: 'Los avisos en Telegram separan usuario, incidencia y mensaje, con instrucciones más claras para responder.' },
  },
  {
    date: '2026-10-03', kind: 'new',
    pt: { title: 'Preferências de avisos do suporte', body: 'O administrador ganhou uma área para configurar avisos por Telegram e escolher se deseja responder por lá. O chat dos usuários continua no site.' },
    en: { title: 'Support alert preferences', body: 'The administrator now has an area to configure Telegram alerts and choose whether to reply there. Users keep chatting on the website.' },
    es: { title: 'Preferencias de avisos del soporte', body: 'El administrador tiene un área para configurar avisos por Telegram y decidir si responde allí. Los usuarios siguen conversando en el sitio.' },
  },
  {
    date: '2026-10-03', kind: 'improved',
    pt: { title: 'Mais cor para o seu dia', body: 'A página inicial ganhou cores vivas, cartões de ferramentas e uma aparência própria, independente do tema da sua conta.' },
    en: { title: 'More color for your day', body: 'The landing page now has vibrant colors, tool cards and its own appearance, independent of your account theme.' },
    es: { title: 'Más color para tu día', body: 'La página de inicio tiene colores vivos, tarjetas de herramientas y una apariencia independiente del tema de tu cuenta.' },
  },
  {
    date: '2026-10-03', kind: 'improved',
    pt: { title: 'Som de nova mensagem', body: 'Quando a equipe responde sua dúvida ou sugestão, toca um som curto. Dá para silenciar no botão Som ligado da conversa.' },
    en: { title: 'New message sound', body: 'When the team answers your question or suggestion, a short sound plays. You can mute it with the Sound on button in the conversation.' },
    es: { title: 'Sonido de mensaje nuevo', body: 'Cuando el equipo responde tu duda o sugerencia, suena un aviso corto. Puedes silenciarlo con el botón Sonido activado de la conversación.' },
  },
  {
    date: '2026-10-03', kind: 'improved',
    pt: { title: 'Site com cara nova', body: 'A página de entrada agora apresenta todas as ferramentas do Shift Hours e os planos, e carrega mais rápido.' },
    en: { title: 'Fresh new website', body: 'The landing page now presents every Shift Hours tool and the plans, and loads faster.' },
    es: { title: 'Sitio renovado', body: 'La página de entrada ahora presenta todas las herramientas de Shift Hours y los planes, y carga más rápido.' },
  },
  {
    date: '2026-10-03', kind: 'improved',
    pt: { title: 'Nova página inicial', body: 'Ao entrar, você vê todas as ferramentas de uma vez, quanto ainda pode usar hoje, seus trabalhos recentes e dicas rápidas. As horas trabalhadas agora ficam no cartão Horas trabalhadas.' },
    en: { title: 'New home page', body: 'When you sign in you see every tool at once, what you can still use today, your recent jobs and quick tips. Hours worked now live in the Hours worked card.' },
    es: { title: 'Nueva página de inicio', body: 'Al entrar ves todas las herramientas a la vez, cuánto puedes usar hoy, tus trabajos recientes y consejos rápidos. Las horas trabajadas ahora están en la tarjeta Horas trabajadas.' },
  },
  {
    date: '2026-10-03', kind: 'new',
    pt: { title: 'Dúvidas e sugestões', body: 'Mande sua dúvida ou ideia pelo menu Ferramentas. Quando a equipe responder, vocês conversam ali mesmo, ao vivo se estiverem online ao mesmo tempo.' },
    en: { title: 'Questions and suggestions', body: 'Send your question or idea from the Tools menu. When the team answers, you talk right there, live if you are both online.' },
    es: { title: 'Dudas y sugerencias', body: 'Envía tu duda o idea desde el menú Herramientas. Cuando el equipo responda, conversan ahí mismo, en vivo si están conectados a la vez.' },
  },
  {
    date: '2026-10-03', kind: 'improved',
    pt: { title: 'Comparação de planos sempre atualizada', body: 'A janela de Upgrade mostra o que cada plano inclui em cada ferramenta, sempre com os limites atuais.' },
    en: { title: 'Plan comparison always up to date', body: 'The Upgrade window shows what each plan includes for every tool, always with the current limits.' },
    es: { title: 'Comparación de planes siempre al día', body: 'La ventana de Upgrade muestra lo que incluye cada plan en cada herramienta, siempre con los límites actuales.' },
  },
  {
    date: '2026-10-03', kind: 'new',
    pt: { title: 'Página de atualizações', body: 'Agora você acompanha aqui as novidades, melhorias e correções do Shift Hours.' },
    en: { title: 'Updates page', body: 'Follow Shift Hours news, improvements and fixes right here.' },
    es: { title: 'Página de novedades', body: 'Ahora puedes seguir aquí las novedades, mejoras y correcciones de Shift Hours.' },
  },
  {
    date: '2026-10-03', kind: 'improved',
    pt: { title: 'Selo de uso em todas as ferramentas', body: 'Cada ferramenta mostra o que você ainda pode usar hoje no plano grátis: 1 fatura, 1 arquivo PDF e 15 minutos de Fórmula Fácil por dia. No Premium é tudo ilimitado.' },
    en: { title: 'Usage badge on every tool', body: 'Each tool shows what you can still use today on the free plan: 1 invoice, 1 PDF file and 15 minutes of Fórmula Fácil per day. Premium is unlimited.' },
    es: { title: 'Indicador de uso en todas las herramientas', body: 'Cada herramienta muestra lo que aún puedes usar hoy en el plan gratis: 1 factura, 1 archivo PDF y 15 minutos de Fórmula Fácil por día. Premium es ilimitado.' },
  },
  {
    date: '2026-10-03', kind: 'fixed',
    pt: { title: 'Faturas mostravam limite atingido sem motivo', body: 'O aviso de limite aparecia mesmo sem ter usado a fatura do dia. Agora a contagem recomeça todo dia e só conta quando você baixa ou compartilha.' },
    en: { title: 'Invoices showed the limit for no reason', body: 'The limit warning appeared even when the day\'s invoice was unused. The count now restarts every day and only counts when you download or share.' },
    es: { title: 'Las facturas mostraban el límite sin motivo', body: 'El aviso de límite aparecía aunque no se hubiera usado la factura del día. Ahora el conteo se reinicia cada día y solo cuenta al descargar o compartir.' },
  },
  {
    date: '2026-10-03', kind: 'new',
    pt: { title: 'Fórmula Fácil (Excel + IA)', body: 'Nova ferramenta no menu Ferramentas que ajuda a montar fórmulas de Excel com inteligência artificial.' },
    en: { title: 'Fórmula Fácil (Excel + AI)', body: 'New tool in the Tools menu that helps you build Excel formulas with AI.' },
    es: { title: 'Fórmula Fácil (Excel + IA)', body: 'Nueva herramienta en el menú Herramientas que ayuda a crear fórmulas de Excel con inteligencia artificial.' },
  },
  {
    date: '2026-09-28', kind: 'improved',
    pt: { title: 'PDF Studio preenche campos em caixinhas', body: 'Campos divididos em quadradinhos, como datas e documentos, recebem um caractere em cada casa enquanto você digita.' },
    en: { title: 'PDF Studio fills boxed fields', body: 'Fields split into boxes, like dates and ID numbers, get one character per box as you type.' },
    es: { title: 'PDF Studio rellena campos en casillas', body: 'Los campos divididos en casillas, como fechas y documentos, reciben un carácter por casilla mientras escribes.' },
  },
  {
    date: '2026-09-28', kind: 'improved',
    pt: { title: 'PDF Studio reconhece as fontes do documento', body: 'O texto que você digita usa a mesma fonte do PDF original sempre que possível.' },
    en: { title: 'PDF Studio recognizes the document fonts', body: 'The text you type uses the original PDF font whenever possible.' },
    es: { title: 'PDF Studio reconoce las fuentes del documento', body: 'El texto que escribes usa la misma fuente del PDF original siempre que sea posible.' },
  },
  {
    date: '2026-09-28', kind: 'improved',
    pt: { title: 'Barra do PDF Studio mais compacta', body: 'Ferramentas principais à mão, opções extras no botão Mais e um botão Voltar igual em todas as ferramentas.' },
    en: { title: 'More compact PDF Studio toolbar', body: 'Main tools at hand, extra options under More, and the same Back button on every tool.' },
    es: { title: 'Barra de PDF Studio más compacta', body: 'Herramientas principales a mano, opciones extra en Más y el mismo botón Volver en todas las herramientas.' },
  },
  {
    date: '2026-09-28', kind: 'new',
    pt: { title: 'Edição real de PDF', body: 'Troque textos existentes, preencha formulários e mova objetos direto na página, com o resultado mantido no arquivo baixado.' },
    en: { title: 'Real PDF editing', body: 'Replace existing text, fill in forms and move objects right on the page, kept in the downloaded file.' },
    es: { title: 'Edición real de PDF', body: 'Cambia textos existentes, rellena formularios y mueve objetos en la página, y se mantiene en el archivo descargado.' },
  },
  {
    date: '2026-09-26', kind: 'new',
    pt: { title: 'Chegou o PDF Studio', body: 'Abra um PDF, escreva por cima, posicione textos e baixe o documento editado.' },
    en: { title: 'PDF Studio is here', body: 'Open a PDF, write on it, position text and download the edited document.' },
    es: { title: 'Llegó PDF Studio', body: 'Abre un PDF, escribe encima, coloca textos y descarga el documento editado.' },
  },
  {
    date: '2026-09-26', kind: 'improved',
    pt: { title: 'Nova identidade visual', body: 'Relógio animado na marca, tela de carregamento com o seu tema e seletor de temas renovado.' },
    en: { title: 'New look', body: 'Animated clock logo, a loading screen in your theme and a refreshed theme picker.' },
    es: { title: 'Nueva identidad visual', body: 'Reloj animado en la marca, pantalla de carga con tu tema y un selector de temas renovado.' },
  },
  {
    date: '2026-09-26', kind: 'improved',
    pt: { title: 'Menu Ferramentas e cabeçalho novo', body: 'Todas as ferramentas ficam no menu Ferramentas, e o cabeçalho mostra o seu nome e separa a conta das outras opções.' },
    en: { title: 'Tools menu and new header', body: 'All tools live in the Tools menu, and the header shows your name and keeps account options apart.' },
    es: { title: 'Menú Herramientas y nuevo encabezado', body: 'Todas las herramientas están en el menú Herramientas, y el encabezado muestra tu nombre y separa la cuenta.' },
  },
  {
    date: '2026-09-26', kind: 'new',
    pt: { title: 'Foto dos trabalhos com recorte e zoom', body: 'Escolha a parte da imagem que aparece em cada trabalho, também pelo celular.' },
    en: { title: 'Job photos with crop and zoom', body: 'Choose which part of the image shows on each job, on your phone too.' },
    es: { title: 'Foto de los trabajos con recorte y zoom', body: 'Elige qué parte de la imagen aparece en cada trabajo, también desde el móvil.' },
  },
  {
    date: '2026-09-26', kind: 'improved',
    pt: { title: 'Criador de faturas renovado', body: 'Barra de edição compacta, logo fácil de posicionar e leitura melhor no modo escuro.' },
    en: { title: 'Refreshed invoice creator', body: 'Compact editing bar, easy logo positioning and better readability in dark mode.' },
    es: { title: 'Creador de facturas renovado', body: 'Barra de edición compacta, logo fácil de colocar y mejor lectura en modo oscuro.' },
  },
  {
    date: '2026-09-26', kind: 'fixed',
    pt: { title: 'Contraste no modo escuro', body: 'Botões, iniciais dos trabalhos e campos ficaram legíveis no modo escuro e seguem a cor do tema.' },
    en: { title: 'Dark mode contrast', body: 'Buttons, job initials and fields are readable in dark mode and follow the theme color.' },
    es: { title: 'Contraste en modo oscuro', body: 'Botones, iniciales de trabajos y campos se leen bien en modo oscuro y siguen el color del tema.' },
  },
  {
    date: '2026-03-26', kind: 'new',
    pt: { title: 'Criador de faturas', body: 'Crie faturas com o seu logo e estilo, baixe em PDF ou compartilhe por link.' },
    en: { title: 'Invoice creator', body: 'Create invoices with your logo and style, download as PDF or share by link.' },
    es: { title: 'Creador de facturas', body: 'Crea facturas con tu logo y estilo, descárgalas en PDF o compártelas por enlace.' },
  },
  {
    date: '2026-03-21', kind: 'fixed',
    pt: { title: 'Login com Google mais estável', body: 'Quando a janela de login é bloqueada, o site entra pelo redirecionamento.' },
    en: { title: 'More reliable Google sign-in', body: 'When the sign-in window is blocked, the site signs you in by redirect.' },
    es: { title: 'Inicio de sesión con Google más estable', body: 'Si la ventana de inicio se bloquea, el sitio entra por redirección.' },
  },
  {
    date: '2026-03-17', kind: 'new',
    pt: { title: 'Lançamento do Shift Hours', body: 'Registro de horas por trabalho, com modo escuro e cores personalizadas.' },
    en: { title: 'Shift Hours launch', body: 'Hour tracking per job, with dark mode and custom colors.' },
    es: { title: 'Lanzamiento de Shift Hours', body: 'Registro de horas por trabajo, con modo oscuro y colores personalizados.' },
  },
];
