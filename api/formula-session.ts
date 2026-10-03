import { handleSession } from '../server/formula-handler.js';

export function POST(request: Request) {
  return handleSession(request);
}

export function DELETE(request: Request) {
  return handleSession(request);
}
