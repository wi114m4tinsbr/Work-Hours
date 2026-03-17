export interface Theme {
  id: string;
  name: string;
  primary: string;
  isVivid?: boolean;
}

export const themes: Theme[] = [
  { id: 'mono', name: 'Monocromático', primary: '#000000' },
  { id: 'emerald', name: 'Esmeralda', primary: '#10b981', isVivid: true },
  { id: 'royal', name: 'Royal Blue', primary: '#2563eb', isVivid: true },
  { id: 'sunset', name: 'Sunset', primary: '#f59e0b', isVivid: true },
  { id: 'rose', name: 'Rose', primary: '#e11d48', isVivid: true },
  { id: 'violet', name: 'Violet', primary: '#7c3aed', isVivid: true },
  { id: 'ocean', name: 'Ocean', primary: '#0891b2', isVivid: true },
];
