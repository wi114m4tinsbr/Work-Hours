import { addDoc, collection, Timestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';

/** One line in the panel's Atividade tab. Staff entries must carry their own e-mail (firestore.rules). */
export function logAdmin(action: string, target: { uid?: string; email?: string } = {}, details = '') {
  return addDoc(collection(db, 'adminLog'), {
    action, targetUid: target.uid || '', targetEmail: target.email || '', details: details.slice(0, 900),
    by: (auth.currentUser?.email || '').toLowerCase(), at: Timestamp.now(),
  });
}
