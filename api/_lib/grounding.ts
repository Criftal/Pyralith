/**
 * Grounding rules for Ask FIREBREAK's live mode, shared by api/ask.ts and its tests.
 * The model may only use the records we hand it, and every sentence it returns must cite
 * at least one of those record ids; anything else is stripped before display.
 */

export const NO_EVIDENCE = "No NASA evidence found in our corpus.";
export const NO_COUNTER = "No counter-evidence found in our corpus.";

export type Mode = "ask" | "redteam";

export interface CorpusRecord {
  id: string; // "f_0014" (finding) or "c_fm2" (claim)
  kind: "finding" | "claim";
  text: string; // finding sentence or claim paraphrase
  quote: string; // verbatim, machine-verified
  source: string; // "NTRS:20040084156 p.1"
  meta: string; // conditions, tier, platform, direction
}

export interface GroundedSentence {
  text: string;
  citations: string[];
}

export interface GroundedAnswer {
  answer: string;
  sentences: GroundedSentence[];
  stripped: number; // sentences removed for missing or invalid citations
}

const ID = String.raw`(?:f_\d{4}|c_[a-z0-9_]+)`;
const CITE = new RegExp(String.raw`\[(${ID}(?:\s*[,;]\s*${ID})*)\]`, "g");
const ONLY_CITES = new RegExp(String.raw`^(?:\[${ID}(?:\s*[,;]\s*${ID})*\]\s*)+[.!?]?$`);

export const SYSTEM: Record<Mode, string> = {
  ask: [
    "You are FIREBREAK's evidence assistant for spacecraft and planetary-habitat fire safety research.",
    "Answer only from the NASA records provided in <records>. Do not use outside knowledge.",
    "Every sentence must cite one or more record ids in square brackets before its final punctuation, e.g. 'Flames spread faster in low flow [f_0014].' or '[f_0014, c_fm2]'.",
    `If the records do not answer the question, reply with exactly: ${NO_EVIDENCE}`,
    "Write at most 150 words of plain prose: no headings, lists or markdown. State conditions (gravity, O2, pressure, flow) and evidence tier when they matter.",
  ].join("\n"),
  redteam: [
    "You are FIREBREAK's red team. Argue against the target finding using only the NASA records provided in <records>.",
    "Look for records that contradict, limit or qualify it: other materials, conditions, gravity levels, evidence tiers, or results pointing the other way.",
    "Every sentence must cite one or more record ids in square brackets before its final punctuation, e.g. '... [f_0031].'",
    `If no record argues against it, reply with exactly: ${NO_COUNTER}`,
    "Write at most 150 words of plain prose: no headings, lists or markdown.",
  ].join("\n"),
};

export function buildContext(records: CorpusRecord[]): string {
  const body = records
    .map(
      (r) =>
        `<record id="${r.id}" kind="${r.kind}" source="${r.source}">\n${r.meta}\nsummary: ${r.text}\nverbatim quote: "${r.quote}"\n</record>`,
    )
    .join("\n");
  return `<records>\n${body}\n</records>`;
}

export function splitSentences(text: string): string[] {
  const parts = text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'(\[])/)
    .map((s) => s.trim())
    .filter(Boolean);
  // A trailing "[f_0001]." split off on its own belongs to the sentence before it.
  const merged: string[] = [];
  for (const p of parts) {
    if (ONLY_CITES.test(p) && merged.length) merged[merged.length - 1] += ` ${p}`;
    else merged.push(p);
  }
  return merged;
}

export function groundAnswer(text: string, allowed: Set<string>, mode: Mode = "ask"): GroundedAnswer {
  const sentences: GroundedSentence[] = [];
  let stripped = 0;
  for (const s of splitSentences(text)) {
    if (s === NO_EVIDENCE || s === NO_COUNTER) {
      sentences.push({ text: s, citations: [] });
      continue;
    }
    const ids = [...s.matchAll(CITE)].flatMap((m) => m[1].split(/[,;]/).map((x) => x.trim()));
    if (ids.length === 0 || ids.some((id) => !allowed.has(id))) {
      stripped += 1;
      continue;
    }
    sentences.push({ text: s, citations: [...new Set(ids)] });
  }
  const fallback = mode === "redteam" ? NO_COUNTER : NO_EVIDENCE;
  return { answer: sentences.length ? sentences.map((s) => s.text).join(" ") : fallback, sentences, stripped };
}
