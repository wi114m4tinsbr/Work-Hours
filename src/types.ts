export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  language: 'pt' | 'en' | 'es';
  createdAt: any;
}

export interface Job {
  id: string;
  userId: string;
  name: string;
  hourlyRate: number;
  currency: string; // ISO currency code like BRL, USD, EUR, GBP
  iconType?: 'icon' | 'letter' | 'image';
  iconValue?: string;
  createdAt: any;
}

export interface WorkSession {
  id: string;
  userId: string;
  jobId: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  breakMinutes: number;
  isBreakPaid: boolean;
  createdAt: any;
}
