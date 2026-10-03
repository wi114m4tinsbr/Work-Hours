import { handleAdminReport } from '../server/admin-report.js';

export function GET(request: Request) {
  return handleAdminReport(request);
}
