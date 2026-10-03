import type { LucideIcon } from 'lucide-react';
import { Clock, FileText, MessageCircleQuestion, ScanText, Sheet } from 'lucide-react';
import type { Lang, Text, ToolId } from './plans';

/**
 * Every tool the site offers, in the order people see them. The in-app home page and the public
 * landing page are built from this list, so a new tool only needs an entry here (plus TOOLS in
 * plans.ts when it has a usage limit) to show up everywhere.
 */
export type ToolTab = 'hours' | 'invoices' | 'pdf' | 'formula' | 'support';

export interface CatalogTool {
  id: ToolTab;
  path: string;
  icon: LucideIcon;
  /** Usage limit key in plans.ts, when the tool has one. */
  quota?: ToolId;
  /** Shows a "Novo" tag until this date (YYYY-MM-DD). */
  newUntil?: string;
  /** Helper tools (support) stay off the landing page and show smaller on the home page. */
  helper?: boolean;
  name: Text;
  tagline: Text;
  description: Text;
  /** Short, practical tips with an example; the home page rotates them. */
  tips: Text[];
}

export const CATALOG: CatalogTool[] = [
  {
    id: 'hours', path: '/horas', icon: Clock, quota: 'jobs',
    name: { pt: 'Horas trabalhadas', en: 'Hours worked', es: 'Horas trabajadas' },
    tagline: { pt: 'Registre turnos e veja quanto vai receber.', en: 'Log shifts and see what you will earn.', es: 'Registra turnos y ve cuánto vas a cobrar.' },
    description: {
      pt: 'Cadastre cada trabalho com o valor da hora, anote entrada, saída e pausas, e acompanhe total de horas e valor a receber. Gere um relatório do período em um clique.',
      en: 'Add each job with its hourly rate, note start, end and breaks, and follow total hours and earnings. Create a report for any period in one click.',
      es: 'Registra cada trabajo con su valor por hora, anota entrada, salida y pausas, y sigue el total de horas y lo que vas a cobrar. Genera un informe del período en un clic.',
    },
    tips: [
      { pt: 'Pausa paga ou não paga? Escolha ao registrar o dia, e o total já desconta só o que deve.', en: 'Paid or unpaid break? Pick it when logging the day, and the total only deducts what it should.', es: '¿Pausa pagada o no? Elígelo al registrar el día y el total solo descuenta lo que corresponde.' },
      { pt: 'Exemplo: turno das 22:00 às 06:00 com 30 min de pausa conta 7h30 certinho, mesmo virando o dia.', en: 'Example: a 22:00 to 06:00 shift with a 30 min break counts exactly 7h30, even past midnight.', es: 'Ejemplo: un turno de 22:00 a 06:00 con 30 min de pausa cuenta 7h30 exactas, aunque cambie el día.' },
    ],
  },
  {
    id: 'invoices', path: '/faturas', icon: FileText, quota: 'invoice',
    name: { pt: 'Criador de faturas', en: 'Invoice creator', es: 'Creador de facturas' },
    tagline: { pt: 'Faturas bonitas com o seu logo, prontas para enviar.', en: 'Good-looking invoices with your logo, ready to send.', es: 'Facturas con tu logo, listas para enviar.' },
    description: {
      pt: 'Monte faturas com o seu logo, cores e dados do cliente. Baixe em PDF ou compartilhe por link, direto do celular.',
      en: 'Build invoices with your logo, colors and client details. Download as PDF or share by link, right from your phone.',
      es: 'Crea facturas con tu logo, colores y datos del cliente. Descárgalas en PDF o compártelas por enlace, desde el móvil.',
    },
    tips: [
      { pt: 'Toque em qualquer parte da fatura para mudar cor, fonte e tamanho pela barra de edição.', en: 'Tap any part of the invoice to change its color, font and size from the editing bar.', es: 'Toca cualquier parte de la factura para cambiar color, fuente y tamaño desde la barra de edición.' },
      { pt: 'Compartilhar por link é mais rápido que anexar: o cliente abre a fatura no navegador.', en: 'Sharing a link is faster than attaching: the client opens the invoice in the browser.', es: 'Compartir por enlace es más rápido que adjuntar: el cliente abre la factura en el navegador.' },
    ],
  },
  {
    id: 'pdf', path: '/pdf-studio', icon: ScanText, quota: 'pdf', newUntil: '2026-11-30',
    name: { pt: 'PDF Studio', en: 'PDF Studio', es: 'PDF Studio' },
    tagline: { pt: 'Edite textos e preencha formulários em PDF.', en: 'Edit text and fill in PDF forms.', es: 'Edita textos y rellena formularios PDF.' },
    description: {
      pt: 'Abra um PDF, troque textos existentes, preencha formulários e campos em caixinhas, mova objetos e baixe o arquivo pronto, com a fonte original.',
      en: 'Open a PDF, replace existing text, fill in forms and boxed fields, move objects and download the finished file, in the original font.',
      es: 'Abre un PDF, cambia textos existentes, rellena formularios y campos en casillas, mueve objetos y descarga el archivo listo, con la fuente original.',
    },
    tips: [
      { pt: 'Campos em quadradinhos, como datas, recebem um caractere em cada casa enquanto você digita.', en: 'Boxed fields, like dates, get one character per box as you type.', es: 'Los campos en casillas, como fechas, reciben un carácter por casilla mientras escribes.' },
      { pt: 'Clique num texto que já existe no PDF para trocá-lo, mantendo a mesma fonte sempre que possível.', en: 'Click text already in the PDF to replace it, keeping the same font whenever possible.', es: 'Haz clic en un texto que ya está en el PDF para cambiarlo, con la misma fuente siempre que sea posible.' },
    ],
  },
  {
    id: 'formula', path: '/formula-facil', icon: Sheet, quota: 'formula',
    name: { pt: 'Fórmula Fácil', en: 'Fórmula Fácil', es: 'Fórmula Fácil' },
    tagline: { pt: 'Fórmulas de Excel explicadas com IA.', en: 'Excel formulas explained with AI.', es: 'Fórmulas de Excel explicadas con IA.' },
    description: {
      pt: 'Diga o que você quer calcular em palavras simples e receba a fórmula de Excel pronta, com explicação passo a passo.',
      en: 'Say what you want to calculate in plain words and get the Excel formula ready, with a step-by-step explanation.',
      es: 'Di lo que quieres calcular con palabras simples y recibe la fórmula de Excel lista, con explicación paso a paso.',
    },
    tips: [
      { pt: 'Exemplo: "somar a coluna C só quando a coluna B for Pago" vira =SOMASE(B:B;"Pago";C:C).', en: 'Example: "sum column C only when column B is Paid" becomes =SUMIF(B:B,"Paid",C:C).', es: 'Ejemplo: "sumar la columna C solo cuando la B sea Pagado" se vuelve =SUMAR.SI(B:B;"Pagado";C:C).' },
      { pt: 'Diga o nome das colunas e a linha onde os dados começam para receber a fórmula certa de primeira.', en: 'Mention the column names and the row where data starts to get the right formula first time.', es: 'Indica los nombres de las columnas y la fila donde empiezan los datos para acertar a la primera.' },
    ],
  },
  {
    id: 'support', path: '/suporte', icon: MessageCircleQuestion, helper: true,
    name: { pt: 'Dúvidas e sugestões', en: 'Questions and suggestions', es: 'Dudas y sugerencias' },
    tagline: { pt: 'Fale com a equipe.', en: 'Talk to the team.', es: 'Habla con el equipo.' },
    description: { pt: 'Mande uma dúvida ou ideia e converse com a equipe.', en: 'Send a question or idea and chat with the team.', es: 'Envía una duda o idea y conversa con el equipo.' },
    tips: [
      { pt: 'Teve uma ideia de ferramenta nova? Mande em Dúvidas e sugestões: é assim que o Shift Hours cresce.', en: 'Got an idea for a new tool? Send it in Questions and suggestions: that is how Shift Hours grows.', es: '¿Tienes una idea de herramienta nueva? Envíala en Dudas y sugerencias: así crece Shift Hours.' },
    ],
  },
];

export const isNewTool = (tool: CatalogTool, now = Date.now()) => !!tool.newUntil && now < new Date(`${tool.newUntil}T23:59:59`).getTime();

export const toolText = (text: Text, lang: Lang) => text[lang] || text.pt;
