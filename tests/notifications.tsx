import React from 'react';
import { createRoot } from 'react-dom/client';
import { SupportNotifications } from '../src/components/SupportNotifications';
import '../src/index.css';
const params = new URLSearchParams(location.search);
document.documentElement.classList.toggle('dark', params.has('dark'));
const request = async (action: string, body?: unknown) => {
  const result = await fetch(`/fixture/${action}`, { method: body === undefined ? 'GET' : 'POST', ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  if (!result.ok) throw new Error('failed');
  return result.json();
};
createRoot(document.getElementById('root')!).render(<main className="min-h-screen bg-stone-50 dark:bg-stone-950 p-3 sm:p-8"><SupportNotifications language={(params.get('lang') || 'pt') as 'pt'} request={request}/></main>);
