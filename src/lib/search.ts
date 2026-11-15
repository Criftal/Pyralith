import MiniSearch from 'minisearch';
import type { Claim, Finding, Source } from '../types';

/**
 * Keyless retrieval for Ask FIREBREAK: a MiniSearch (BM25-style) index over verified findings and cited claims.
 * No AI is involved; the live mode only ever summarises ids returned from here.
 */

/** Shown verbatim when retrieval finds nothing (same wording as the live endpoint). */
export const NO_EVIDENCE = 'No NASA evidence found in our corpus.';

export type DocKind = 'finding' | 'claim';

export interface SearchDoc {
  id: string;
  kind: DocKind;
  primary: string; // finding sentence / claim text (boosted)
  quote: string;
  label: string;
  material: string;
  experiment: string;
  source: string;
  type: string; // finding_type or claim topic
}

export interface Hit {
  id: string;
  kind: DocKind;
  score: number;
}

const STOP = new Set(
  'a an the is are was were be been being do does did doing what which who whom how why when where of in on at to for from by with and or nor not no than then that this these those it its as we you i our can could would should will shall may might must about more most there their them they into over under out up so if any all some such very just also'.split(' '),
);

const SYNONYMS: Record<string, string[]> = {
  oxygen: ['o2'],
  o2: ['oxygen'],
  moon: ['lunar'],
  lunar: ['moon'],
  mars: ['martian'],
  martian: ['mars'],
  fire: ['flame', 'combustion'],
  flame: ['fire'],
  flames: ['flame', 'fire'],
  ventilation: ['airflow', 'flow'],
  airflow: ['ventilation', 'flow'],
  extinguish: ['extinction', 'suppression'],
  extinction: ['extinguish'],
  smoke: ['detection'],
};

/** Lowercase, normalise O₂, drop stop words and 1-letter terms, expand a few domain synonyms. */
export function processTerm(term: string): string[] | null {
  const t = term
    .toLowerCase()
    .normalize('NFKC') // O₂ -> o2
    .replace(/^[^a-z0-9µ]+|[^a-z0-9µ]+$/g, '');
  if (t.length < 2 || STOP.has(t)) return null;
  return [t, ...(SYNONYMS[t] ?? [])];
}

const spaced = (s: string | null | undefined) => (s ?? '').replace(/_/g, ' ');

export function toDocs(findings: Finding[], claims: Claim[], sources: Record<string, Source>): SearchDoc[] {
  const docs: SearchDoc[] = [];
  for (const f of findings) {
    docs.push({
      id: f.id,
      kind: 'finding',
      primary: f.finding,
      quote: f.quote,
      label: '',
      material: f.material ?? '',
      experiment: f.experiment === 'other' ? '' : f.experiment,
      source: sources[f.source_id]?.title ?? '',
      type: spaced(f.finding_type),
    });
  }
  for (const c of claims) {
    docs.push({
      id: c.id,
      kind: 'claim',
      primary: c.text,
      quote: c.quote,
      label: c.label ?? '',
      material: '',
      experiment: '',
      source: sources[c.source_id]?.title ?? '',
      type: spaced(c.topic),
    });
  }
  return docs;
}

const SEARCH_OPTIONS = {
  boost: { primary: 3, label: 2, material: 1.5, experiment: 1.5, type: 1.2 },
  prefix: (term: string) => term.length >= 4,
  fuzzy: (term: string) => (term.length >= 6 ? 0.2 : false),
  combineWith: 'OR' as const,
};

export function buildIndex(findings: Finding[], claims: Claim[], sources: Record<string, Source>): MiniSearch<SearchDoc> {
  const ms = new MiniSearch<SearchDoc>({
    idField: 'id',
    fields: ['primary', 'quote', 'label', 'material', 'experiment', 'source', 'type'],
    storeFields: ['kind'],
    processTerm,
    searchOptions: SEARCH_OPTIONS,
  });
  ms.addAll(toDocs(findings, claims, sources));
  return ms;
}

/** Top-n hits for a query; an empty or stop-word-only query returns []. */
export function retrieve(index: MiniSearch<SearchDoc>, query: string, n = 10, exclude?: ReadonlySet<string>): Hit[] {
  const q = query.trim();
  if (!q) return [];
  const out: Hit[] = [];
  for (const r of index.search(q)) {
    const id = String(r.id);
    if (exclude?.has(id)) continue;
    out.push({ id, kind: (r as unknown as { kind: DocKind }).kind, score: r.score });
    if (out.length >= n) break;
  }
  return out;
}

// One index per loaded dataset (the arrays are replaced wholesale when data reloads).
const cache = new WeakMap<Finding[], { claims: Claim[]; index: MiniSearch<SearchDoc> }>();

export function indexFor(findings: Finding[], claims: Claim[], sources: Record<string, Source>): MiniSearch<SearchDoc> {
  const hit = cache.get(findings);
  if (hit && hit.claims === claims) return hit.index;
  const index = buildIndex(findings, claims, sources);
  cache.set(findings, { claims, index });
  return index;
}
