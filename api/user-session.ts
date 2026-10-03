import { handleUserSession } from '../server/formula-public.js';

export function POST(request: Request) {
  return handleUserSession(request);
}

export function DELETE(request: Request) {
  return handleUserSession(request);
}
