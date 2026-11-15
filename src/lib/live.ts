import { useEffect, useState } from 'react';

/**
 * Optional live mode (Vercel function at /api/ask). Under `vite dev` the endpoint does not exist, and without
 * ANTHROPIC_API_KEY it reports live:false; any failure means "not live".
 */

export interface LiveStatus {
  live: boolean;
  model: string | null;
}

export interface AskSentence {
  text: string;
  citations: string[];
}

export interface AskResponse {
  answer: string;
  sentences: AskSentence[];
  stripped: number;
  model: string;
  refusal?: boolean;
}

export type AskRequest = { mode: 'ask'; question: string; ids: string[] } | { mode: 'redteam'; target: string; ids: string[] };

const NOT_LIVE: LiveStatus = { live: false, model: null };

export async function fetchLiveStatus(fetcher: typeof fetch = fetch): Promise<LiveStatus> {
  try {
    const r = await fetcher('/api/ask', { headers: { accept: 'application/json' } });
    if (!r.ok) return NOT_LIVE;
    if (!(r.headers.get('content-type') ?? '').includes('json')) return NOT_LIVE;
    const j = (await r.json()) as { live?: unknown; model?: unknown };
    return { live: j?.live === true, model: typeof j?.model === 'string' ? j.model : null };
  } catch {
    return NOT_LIVE;
  }
}

let statusPromise: Promise<LiveStatus> | null = null;

/** null while checking. */
export function useLiveStatus(): LiveStatus | null {
  const [s, setS] = useState<LiveStatus | null>(null);
  useEffect(() => {
    let alive = true;
    statusPromise ??= fetchLiveStatus();
    statusPromise.then((v) => {
      if (alive) setS(v);
    });
    return () => {
      alive = false;
    };
  }, []);
  return s;
}

function errorMessage(status: number, err: unknown): string {
  if (status === 503) return 'Live AI mode is not configured on this deployment.';
  if (status === 429) return 'The live AI service is rate-limited; try again shortly.';
  if (status === 400) return `The request was rejected${typeof err === 'string' ? `: ${err}` : '.'}`;
  if (status === 502) return 'The AI service returned an error.';
  return `Live request failed (${status}).`;
}

/** Defence in depth: drop any sentence citing an id we did not send, and count it as stripped. */
export function enforceGrounding(res: AskResponse, allowed: ReadonlySet<string>): AskResponse {
  const kept: AskSentence[] = [];
  let extra = 0;
  for (const s of res.sentences ?? []) {
    const cites = Array.isArray(s.citations) ? s.citations : [];
    if (cites.length > 0 && cites.every((id) => allowed.has(id))) kept.push({ text: String(s.text), citations: cites });
    else if (cites.length === 0 && (res.sentences ?? []).length === 1) kept.push({ text: String(s.text), citations: [] }); // the "no evidence" reply
    else extra += 1;
  }
  return { ...res, sentences: kept, stripped: (res.stripped ?? 0) + extra };
}

export async function postAsk(body: AskRequest, fetcher: typeof fetch = fetch): Promise<AskResponse> {
  const r = await fetcher('/api/ask', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  let j: unknown = null;
  try {
    j = await r.json();
  } catch {
    /* non-JSON */
  }
  if (!r.ok) throw new Error(errorMessage(r.status, (j as { error?: unknown } | null)?.error));
  const res = j as AskResponse | null;
  if (!res || typeof res.answer !== 'string' || !Array.isArray(res.sentences)) throw new Error('Unexpected response from the live endpoint.');
  const allowed = new Set(body.mode === 'redteam' ? [body.target, ...body.ids] : body.ids);
  return enforceGrounding(res, allowed);
}

const ID = String.raw`(?:f_\d{4}|c_[a-z0-9_]+)`;
const CITE = new RegExp(String.raw`\s*\[(${ID}(?:\s*[,;]\s*${ID})*)\]`, 'g');

/** Remove bracketed citations from a sentence for display (they are rendered as chips instead). */
export function stripCitations(text: string): string {
  return text
    .replace(CITE, '')
    .replace(/\s+([.!?,;:])/g, '$1')
    .trim();
}
