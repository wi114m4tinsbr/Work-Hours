import { handleAdminPage } from '../server/formula-handler.js';

export function GET(request: Request) {
  return handleAdminPage(request);
}

export function HEAD(request: Request) {
  return handleAdminPage(request);
}
