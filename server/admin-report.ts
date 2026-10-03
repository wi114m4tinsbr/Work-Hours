import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { verifyOwnerToken, type OwnerSession } from './formula-auth.js';
import { PRIVATE_HEADERS, notFound } from './formula-handler.js';

const REPO = 'wi114m4tinsbr/Work-Hours';
const COMMIT_PAGES = 3;
const CACHE_MS = 60_000;

export interface Milestone { at: string; kind: string; title: string; details: string }
export interface Commit { sha: string; at: string; author: string; message: string }

export interface ReportDeps {
  verify: (token: string | undefined) => Promise<OwnerSession | null>;
  loadMilestones: () => Promise<Milestone[]>;
  loadPrompt: () => Promise<string>;
  /** Every push to the branch, newest first, straight from GitHub. Null when GitHub is unreachable. */
  loadCommits: (branch: string) => Promise<Commit[] | null>;
  branch: () => string;
}

const asset = (name: string) => readFile(join(process.cwd(), 'server/assets', name), 'utf8');

let cache: { branch: string; at: number; commits: Commit[] } | null = null;

export async function commitsFromGitHub(branch: string): Promise<Commit[] | null> {
  if (cache && cache.branch === branch && Date.now() - cache.at < CACHE_MS) return cache.commits;
  const headers: Record<string, string> = { Accept: 'application/vnd.github+json', 'User-Agent': 'shift-hours-admin-report' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const commits: Commit[] = [];
  try {
    for (let page = 1; page <= COMMIT_PAGES; page++) {
      const url = `https://api.github.com/repos/${REPO}/commits?sha=${encodeURIComponent(branch)}&per_page=100&page=${page}`;
      const response = await fetch(url, { headers, signal: AbortSignal.timeout(6000) });
      if (!response.ok) return commits.length ? commits : null;
      const list = (await response.json()) as Array<{ sha: string; commit: { message: string; author?: { name?: string; date?: string } } }>;
      for (const item of list) {
        commits.push({
          sha: item.sha.slice(0, 7),
          at: item.commit.author?.date ?? '',
          author: item.commit.author?.name ?? '',
          // First paragraph only; attribution trailers stay out of the report.
          message: item.commit.message.split(/\n\s*\n/)[0].trim(),
        });
      }
      if (list.length < 100) break;
    }
  } catch {
    return commits.length ? commits : null;
  }
  cache = { branch, at: Date.now(), commits };
  return commits;
}

const defaultDeps: ReportDeps = {
  verify: (token) => verifyOwnerToken(token),
  loadMilestones: async () => (JSON.parse(await asset('project-report.json')) as { milestones: Milestone[] }).milestones,
  loadPrompt: () => asset('project-prompt.md'),
  loadCommits: commitsFromGitHub,
  branch: () => process.env.VERCEL_GIT_COMMIT_REF || 'main',
};

const when = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
};

/** The copy-and-paste prompt, ending with the latest pushes so it is always current. */
export function buildPrompt(base: string, branch: string, commits: Commit[] | null, milestones: Milestone[] = []): string {
  const history = [...milestones].sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
    .map(m => `### ${when(m.at)} · ${m.title}\n${m.details}`).join('\n\n');
  const full = `${base.trim()}${history ? `\n\n## Histórico completo dos marcos registrados\n\n${history}` : ''}`;
  if (!commits?.length) return `${full}\n\n_(Não foi possível ler os envios do GitHub agora; os marcos registrados estão preservados.)_\n`;
  const recent = commits.slice(0, 25).map((c) => `- ${when(c.at)} · ${c.sha} · ${c.message}`).join('\n');
  return `${full}\n\n### Últimos envios na branch \`${branch}\` (mais recente primeiro)\n${recent}\n`;
}

/** GET with the owner's Bearer token: milestones, every push from GitHub and the context prompt. */
export async function handleAdminReport(request: Request, deps: ReportDeps = defaultDeps): Promise<Response> {
  if (request.method !== 'GET') return notFound();
  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : undefined;
  if (!(await deps.verify(token))) return notFound();

  const branch = deps.branch();
  const [milestones, base, commits] = await Promise.all([deps.loadMilestones(), deps.loadPrompt(), deps.loadCommits(branch)]);
  const body = { branch, milestones, commits: commits ?? [], commitsAvailable: commits !== null, prompt: buildPrompt(base, branch, commits, milestones) };
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...PRIVATE_HEADERS, 'Content-Type': 'application/json; charset=utf-8' },
  });
}
