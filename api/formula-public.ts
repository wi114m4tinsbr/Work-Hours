import { handlePublicPage } from '../server/formula-public.js';

export function GET(request: Request) {
  return handlePublicPage(request);
}

export function HEAD(request: Request) {
  return handlePublicPage(request);
}
