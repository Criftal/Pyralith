import { describe, expect, it } from 'vitest';
import type { Claim } from '../../types';
import { buildIndex, processTerm, retrieve } from '../search';
import { counterEvidence, materialTokens } from '../redteam';
import { enforceGrounding, fetchLiveStatus, postAsk, stripCitations, type AskResponse } from '../live';
import { makeFinding } from './fixtures';

// TEST-ONLY synthetic records.
const findings = [
  makeFinding({ id: 'f_0001', finding: 'Flames spread farther at lunar gravity than at Earth gravity in parabolic flight.', gravity_g: 0.16, platform: 'parabolic', material: 'Nomex HT90-40 fabric', experiment: 'KC-135 partial-g', direction: 'more_flammable_than_1g', finding_type: 'flammability_limit' }),
  makeFinding({ id: 'f_0002', finding: 'Lunar gravity lowered the limiting oxygen concentration for thin fuels.', gravity_g: 0.17, material: 'thin cellulose', experiment: 'ZGF centrifuge', direction: 'more_flammable_than_1g', finding_type: 'flammability_limit' }),
  makeFinding({ id: 'f_0003', finding: 'Smoke detectors on the ISS responded to aerosol from overheated wires.', gravity_g: 0, material: null, experiment: 'SAME', finding_type: 'smoke_detection' }),
  makeFinding({ id: 'f_0004', finding: 'Nomex burned less readily at 1 g than predicted by the 1-g test.', gravity_g: 1, material: 'Nomex HT90-40 fabric', experiment: 'Test 1', direction: 'less_flammable_than_1g', platform: '1g_lab', evidence_tier: 3 }),
  makeFinding({ id: 'f_0005', finding: 'Turning off ventilation starved a microgravity flame of oxygen and it went out.', gravity_g: 0, material: 'PMMA rod', experiment: 'BASS', finding_type: 'extinction', direction: 'neutral' }),
  makeFinding({ id: 'f_0006', finding: 'Nomex samples in microgravity behaved like those at 1 g.', gravity_g: 0, material: 'Nomex HT90-40 fabric', experiment: 'Saffire-II', direction: 'neutral', o2_percent: 21 }),
];
const claim = (id: string, topic: Claim['topic'], label: string, text: string): Claim => ({ id, topic, label, text, source_id: 'X:1', page: 1, quote: 'synthetic', link: null });
const claims = [
  claim('c_lunar_nearly_most', 'lunar_flammability', 'Nearly the most flammable', 'Lunar gravity is nearly the most flammable condition.'),
  claim('c_a_nomex_counter', 'lunar_flammability', 'Counterexample: Nomex', 'Nomex was a counterexample: it was not more flammable at lunar gravity.'),
  claim('c_curve', 'u_shape', 'Caveat: sparse data', 'The boundary curve rests on sparse data.'),
  claim('c_ventilation', 'context', 'Ventilation', 'ISS crews turn off ventilation during a fire.'),
];
const index = buildIndex(findings, claims, {});

describe('retrieval', () => {
  it('returns lunar-gravity records for "lunar gravity flammability"', () => {
    const hits = retrieve(index, 'lunar gravity flammability', 10);
    const ids = hits.map((h) => h.id);
    expect(ids).toEqual(expect.arrayContaining(['f_0001', 'f_0002']));
    // Every one of the top four is a lunar-gravity finding or a lunar-flammability claim.
    const lunarIds = new Set(['f_0001', 'f_0002', 'c_lunar_nearly_most', 'c_a_nomex_counter']);
    expect(ids.slice(0, 4).every((id) => lunarIds.has(id))).toBe(true);
    expect(ids).not.toContain('f_0003'); // the smoke-detector record shares no terms
  });

  it('handles empty, blank and stop-word-only queries', () => {
    expect(retrieve(index, '')).toEqual([]);
    expect(retrieve(index, '   ')).toEqual([]);
    expect(retrieve(index, 'what is the of and')).toEqual([]);
  });

  it('expands oxygen/O2 and moon/lunar synonyms', () => {
    expect(processTerm('Oxygen')).toEqual(['oxygen', 'o2']);
    expect(processTerm('O₂')).toEqual(['o2', 'oxygen']);
    expect(processTerm('the')).toBeNull();
    expect(retrieve(index, 'moon').map((h) => h.id)).toContain('f_0002');
  });

  it('finds the ventilation records for the suggested question', () => {
    const ids = retrieve(index, 'Does turning off ventilation put out a fire?').map((h) => h.id);
    expect(ids.slice(0, 2)).toEqual(expect.arrayContaining(['f_0005', 'c_ventilation']));
  });
});

describe('red team counter-evidence', () => {
  it('never includes the target', () => {
    for (const t of findings) {
      const items = counterEvidence(t, findings, claims, index, 10);
      expect(items.some((i) => i.id === t.id)).toBe(false);
    }
  });

  it('puts same-material, opposite-direction findings first and adds qualifying claims', () => {
    const items = counterEvidence(findings[0], findings, claims, index, 10);
    expect(items[0].id).toBe('f_0004'); // Nomex, less flammable than 1 g
    expect(items.map((i) => i.id)).toEqual(expect.arrayContaining(['f_0006', 'c_a_nomex_counter', 'c_curve']));
    expect(items.map((i) => i.id)).not.toContain('c_ventilation'); // wrong topic
    expect(items[0].reason).toContain('same material');
  });

  it('ignores generic words when matching materials', () => {
    expect([...materialTokens('Nomex HT90-40 fabric')]).toEqual(['nomex', 'ht90']);
    expect(materialTokens(null).size).toBe(0);
  });
});

describe('live mode helpers', () => {
  const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

  it('treats any failure of GET /api/ask as not live', async () => {
    expect(await fetchLiveStatus((async () => new Response('Not found', { status: 404 })) as typeof fetch)).toEqual({ live: false, model: null });
    expect(await fetchLiveStatus((async () => new Response('<html></html>', { headers: { 'content-type': 'text/html' } })) as typeof fetch)).toEqual({ live: false, model: null });
    expect(await fetchLiveStatus((async () => { throw new Error('offline'); }) as typeof fetch)).toEqual({ live: false, model: null });
    expect(await fetchLiveStatus((async () => jsonResponse({ live: false, model: 'm' })) as typeof fetch)).toEqual({ live: false, model: 'm' });
    expect(await fetchLiveStatus((async () => jsonResponse({ live: true, model: 'claude-opus-5-5' })) as typeof fetch)).toEqual({ live: true, model: 'claude-opus-5-5' });
  });

  it('reports a missing API key as not configured', async () => {
    const f = (async () => jsonResponse({ error: 'live_mode_unavailable' }, 503)) as typeof fetch;
    await expect(postAsk({ mode: 'ask', question: 'q', ids: ['f_0001'] }, f)).rejects.toThrow('Live AI mode is not configured on this deployment.');
  });

  it('drops sentences citing records that were not sent', async () => {
    const body: AskResponse = {
      answer: 'x',
      model: 'm',
      stripped: 1,
      sentences: [
        { text: 'Lunar gravity can be worse [f_0001].', citations: ['f_0001'] },
        { text: 'Smuggled claim [f_9999].', citations: ['f_9999'] },
      ],
    };
    const res = await postAsk({ mode: 'ask', question: 'q', ids: ['f_0001'] }, (async () => jsonResponse(body)) as typeof fetch);
    expect(res.sentences.map((s) => s.citations)).toEqual([['f_0001']]);
    expect(res.stripped).toBe(2);
  });

  it('keeps the single uncited "no evidence" reply', () => {
    const res = enforceGrounding({ answer: 'No NASA evidence found in our corpus.', sentences: [{ text: 'No NASA evidence found in our corpus.', citations: [] }], stripped: 0, model: 'm' }, new Set());
    expect(res.sentences.length).toBe(1);
  });

  it('strips bracketed citations for display', () => {
    expect(stripCitations('Flames spread faster in low flow [f_0014].')).toBe('Flames spread faster in low flow.');
    expect(stripCitations('Two sources agree [f_0001, c_fm2]; see also [c_u_min_lunar].')).toBe('Two sources agree; see also.');
  });
});
