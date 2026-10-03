import { notFound } from '../server/formula-handler.js';

export function GET() {
  return notFound();
}

export function HEAD() {
  return notFound();
}
