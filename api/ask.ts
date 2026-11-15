/**
 * Ask FIREBREAK, live mode (optional). Vercel Function, Node.js runtime, Web handler signature.
 *
 *   GET  /api/ask  -> { live: boolean, model }      whether ANTHROPIC_API_KEY is configured
 *   POST /api/ask  { mode: "ask" | "redteam", question?: string, target?: string, ids: string[] }
 *                  -> { answer, sentences: [{ text, citations }], stripped, model }
 *
 * The browser does retrieval (MiniSearch) and sends only record ids; the records themselves are
 * loaded here from the deployed /data/*.json, so callers cannot inject their own "evidence".
 * Every returned sentence cites ids from that set; uncited sentences are stripped (api/_lib/grounding.ts).
 * The key lives only in the Vercel environment variable ANTHROPIC_API_KEY, never in client code.
 */
import Anthropic from "@anthropic-ai/sdk";
import { buildContext, groundAnswer, SYSTEM, NO_EVIDENCE, type CorpusRecord, type Mode } from "./_lib/grounding.js";

const MODEL = "claude-opus-5-5";
const MAX_IDS = 12;
const MAX_QUESTION = 500;
const ID_RE = /^(f_\d{4}|c_[a-z0-9_]+)$/;

interface FindingJson {
  id: string;
  source_id: string;
  page: number;
  finding: string;
  quote: string;
  experiment: string;
  platform: string;
  evidence_tier: number;
  direction: string;
  material: string | null;
  gravity_g: number | null;
  o2_percent: number | null;
  pressure_kpa: number | null;
  flow_cm_s: number | null;
}
interface ClaimJson {
  id: string;
  source_id: string;
  page: number;
  topic: string;
  text: string;
  quote: string;
}

let corpus: Map<string, CorpusRecord> | null = null;

async function loadCorpus(origin: string): Promise<Map<string, CorpusRecord>> {
  if (corpus) return corpus;
  const get = async <T>(name: string): Promise<T> => {
    const r = await fetch(`${origin}/data/${name}.json`);
    if (!r.ok) throw new Error(`could not load /data/${name}.json (${r.status})`);
    return (await r.json()) as T;
  };
  const [findings, claims] = await Promise.all([get<FindingJson[]>("findings"), get<ClaimJson[]>("claims")]);
  const show = (v: number | null, unit: string) => (v === null ? "not stated" : `${v} ${unit}`);
  const map = new Map<string, CorpusRecord>();
  for (const f of findings) {
    map.set(f.id, {
      id: f.id,
      kind: "finding",
      text: f.finding,
      quote: f.quote,
      source: `${f.source_id} p.${f.page}`,
      meta:
        `experiment: ${f.experiment}; platform: ${f.platform}; evidence tier: ${f.evidence_tier}; ` +
        `direction vs 1 g: ${f.direction}; material: ${f.material ?? "not stated"}; ` +
        `gravity: ${show(f.gravity_g, "g")}; O2: ${show(f.o2_percent, "%")}; pressure: ${show(f.pressure_kpa, "kPa")}; ` +
        `flow: ${show(f.flow_cm_s, "cm/s")}`,
    });
  }
  for (const c of claims) {
    map.set(c.id, {
      id: c.id,
      kind: "claim",
      text: c.text,
      quote: c.quote,
      source: `${c.source_id} p.${c.page}`,
      meta: `topic: ${c.topic}`,
    });
  }
  corpus = map;
  return map;
}

function bad(message: string, status = 400): Response {
  return Response.json({ error: message }, { status });
}

export function GET(): Response {
  return Response.json({ live: Boolean(process.env.ANTHROPIC_API_KEY), model: MODEL });
}

export async function POST(request: Request): Promise<Response> {
  if (!process.env.ANTHROPIC_API_KEY) return bad("live_mode_unavailable", 503);

  let body: { mode?: unknown; question?: unknown; target?: unknown; ids?: unknown };
  try {
    body = await request.json();
  } catch {
    return bad("invalid JSON body");
  }
  const mode: Mode = body.mode === "redteam" ? "redteam" : "ask";
  const question = typeof body.question === "string" ? body.question.trim().slice(0, MAX_QUESTION) : "";
  const target = typeof body.target === "string" && ID_RE.test(body.target) ? body.target : null;
  const ids = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === "string" && ID_RE.test(x)) : [];
  if (mode === "ask" && !question) return bad("question is required");
  if (mode === "redteam" && !target) return bad("target record id is required");
  if (ids.length === 0 || ids.length > MAX_IDS) return bad(`send 1-${MAX_IDS} record ids`);

  const origin = new URL(request.url, `https://${request.headers.get("host") ?? "localhost"}`).origin;
  const map = await loadCorpus(origin);
  const wanted = target && !ids.includes(target) ? [target, ...ids] : ids;
  const records = wanted.map((id) => map.get(id)).filter((r): r is CorpusRecord => Boolean(r));
  if (records.length === 0) return Response.json({ answer: NO_EVIDENCE, sentences: [], stripped: 0, model: MODEL });

  const task =
    mode === "redteam"
      ? `Target finding to argue against: [${target}]. Use the other records as your evidence.`
      : `Question: ${question}`;

  const client = new Anthropic();
  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 4000, // cost cap for a public demo endpoint; answers are limited to ~150 words
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      system: SYSTEM[mode],
      messages: [{ role: "user", content: `${buildContext(records)}\n\n${task}` }],
    });
    if (response.stop_reason === "refusal") {
      return Response.json({ answer: "The model declined this request.", sentences: [], stripped: 0, model: response.model, refusal: true });
    }
    const text = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    const grounded = groundAnswer(text, new Set(records.map((r) => r.id)), mode);
    return Response.json({ ...grounded, model: response.model });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return bad("rate limited, try again shortly", 429);
    if (error instanceof Anthropic.AuthenticationError) return bad("live mode is misconfigured", 503);
    if (error instanceof Anthropic.APIError) return bad(`upstream error ${error.status ?? ""}`.trim(), 502);
    throw error;
  }
}
