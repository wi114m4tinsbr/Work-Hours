import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number, currencyCode: string = 'BRL'): string {
  try {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currencyCode,
    }).format(value);
  } catch (e) {
    return `${currencyCode} ${value.toFixed(2)}`;
  }
}

export const CURRENCIES = [
  { code: 'BRL', symbol: 'R$', name: 'Real' },
  { code: 'USD', symbol: '$', name: 'Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'Pound' },
  { code: 'JPY', symbol: '¥', name: 'Yen' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'CHF', symbol: 'Fr', name: 'Swiss Franc' },
];

export function formatDuration(decimalHours: number): string {
  const totalMinutes = Math.round(decimalHours * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h${minutes}m`;
}

import { format, parseISO } from 'date-fns';

export function hexToRgb(hex: string): { r: number, g: number, b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

export function generateTintedDark(hex: string, opacity: number = 0.05): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return '#0c0a09'; // stone-950 fallback
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
}

export function generateWhatsAppReport(jobName: string, sessions: any[], totalHours: number, totalEarnings: number, currency: string, t: any, lang: string): string {
  let report = `*${t.reportTitle}*\n`;
  report += `*${t.jobName}:* ${jobName}\n\n`;
  
  sessions.forEach(s => {
    const duration = calculateDuration(s.startTime, s.endTime, s.breakMinutes, s.isBreakPaid);
    const dateObj = parseISO(s.date);
    const formattedDate = lang === 'en' ? format(dateObj, 'MM/dd/yyyy') : format(dateObj, 'dd/MM/yyyy');
    const breakStatus = s.breakMinutes > 0 ? ` (${t.withBreak})` : ` (${t.withoutBreak})`;
    report += `• ${formattedDate}: ${s.startTime} - ${s.endTime} (${formatDuration(duration)})${breakStatus}\n`;
  });
  
  report += `\n*${t.totalHours}:* ${formatDuration(totalHours)}\n`;
  report += `*${t.totalToReceive}:* ${formatCurrency(totalEarnings, currency)}\n`;
  
  return encodeURIComponent(report);
}

export function calculateDuration(startTime: string, endTime: string, breakMinutes: number, isBreakPaid: boolean): number {
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  
  let startTotalMinutes = startH * 60 + startM;
  let endTotalMinutes = endH * 60 + endM;
  
  // Handle overnight shifts
  if (endTotalMinutes < startTotalMinutes) {
    endTotalMinutes += 24 * 60;
  }
  
  let totalMinutes = endTotalMinutes - startTotalMinutes;
  
  if (!isBreakPaid) {
    totalMinutes -= breakMinutes;
  }
  
  return Math.max(0, totalMinutes / 60);
}

export function resolveFooterPlaceholders(text: string, appName: string, t: any): string {
  const year = new Date().getFullYear().toString();
  return text
    .replace(/{{appName}}/g, appName)
    .replace(/{{professionalEdition}}/g, t.professionalEdition)
    .replace(/{{developedBy}}/g, t.developedBy)
    .replace(/{{year}}/g, year);
}
