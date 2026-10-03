import { handleVisibility } from '../server/formula-handler.js';

export function GET(request: Request) {
  return handleVisibility(request);
}

export function POST(request: Request) {
  return handleVisibility(request);
}
