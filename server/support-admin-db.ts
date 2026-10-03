import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { FIREBASE_PROJECT_ID } from './formula-auth';

export function supportDb() {
  let app = getApps().find(a => a.name === 'support');
  if (!app) {
    const service = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
    if (service.project_id !== FIREBASE_PROJECT_ID || !service.client_email || !service.private_key) throw new Error('support_configuration');
    app = initializeApp({ credential: cert(service), projectId: FIREBASE_PROJECT_ID }, 'support');
  }
  return getFirestore(app, 'ai-studio-df43dc48-1bac-453f-8185-49b595d5483a');
}
