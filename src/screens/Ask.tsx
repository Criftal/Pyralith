import { useMemo, useState, type FormEvent } from 'react';
import { useData } from '../lib/data';
import { postAsk, useLiveStatus } from '../lib/live';
import { indexFor, NO_EVIDENCE, retrieve } from '../lib/search';
import { AiAnswer, LiveControls, RecordCard, RedTeamPanel, useHighlight, type AiState } from '../components/Evidence';
import { Loading, MissingData, ScreenHeader } from '../components/States';

const SUGGESTIONS = ['Is lunar gravity more flammable than Earth?', 'Does turning off ventilation put out a fire?', 'What do we know above 30% oxygen?'];

export default function Ask() {
  const { data, loading, missing } = useData();
  const index = useMemo(() => indexFor(data.findings, data.claims, data.sources), [data.findings, data.claims, data.sources]);
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const hits = useMemo(() => retrieve(index, query, 10), [index, query]);
  const live = useLiveStatus();
  const [ai, setAi] = useState<AiState>({ status: 'idle' });
  const [redId, setRedId] = useState<string | null>(null);
  const { hl, go } = useHighlight('ask');

  if (loading) return <Loading />;

  const run = (text: string) => {
    setInput(text);
    setQuery(text.trim());
    setAi({ status: 'idle' });
    setRedId(null);
  };
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    run(input);
  };
  const askClaude = async () => {
    setAi({ status: 'loading' });
    try {
      const res = await postAsk({ mode: 'ask', question: query, ids: hits.map((h) => h.id) });
      setAi({ status: 'done', res });
    } catch (e) {
      setAi({ status: 'error', error: e instanceof Error ? e.message : 'Live request failed.' });
    }
  };
  const nothingIndexed = missing.includes('findings') && missing.includes('claims');

  return (
    <div>
      <ScreenHeader index="08" kicker="Ask FIREBREAK" title="Ask the corpus">
        Keyword retrieval over {data.findings.length} verified findings and {data.claims.length} cited claims, ranked in your browser with no AI. When live mode is
        configured, Claude may summarise only the retrieved records, and every sentence must cite one.
      </ScreenHeader>

      {nothingIndexed ? (
        <MissingData files={['findings', 'claims']} what="Search" />
      ) : (
        <>
          <form onSubmit={onSubmit} className="flex items-end gap-4" role="search">
            <input
              type="search"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about flammability, gravity, oxygen, suppression…"
              aria-label="Question"
              className="input-line font-display text-[clamp(1.6rem,3.6vw,2.8rem)] leading-tight"
            />
            <button type="submit" className="btn btn-primary shrink-0">
              Search
            </button>
          </form>
          <div className="mt-4 flex flex-wrap items-baseline gap-x-6 gap-y-2">
            <span className="label">Try</span>
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" onClick={() => run(s)} className="link-draw text-left text-[15px] text-ink-2 hover:text-ink">
                {s}
              </button>
            ))}
          </div>

          {query && (
            <div className="mt-12">
              {hits.length === 0 ? (
                <p className="border-y border-ink py-5 font-display text-[24px] text-ink">{NO_EVIDENCE}</p>
              ) : (
                <>
                  <div className="mb-6">
                    <LiveControls
                      live={live}
                      label="Ask Claude (cites only these records)"
                      state={ai}
                      onRun={askClaude}
                      offNote="Live AI mode is not configured on this deployment. Showing retrieved evidence only."
                    />
                  </div>
                  {ai.status === 'done' && ai.res && (
                    <div className="mb-10">
                      <AiAnswer res={ai.res} onCite={go} />
                    </div>
                  )}
                  <h2 className="border-b border-ink pb-2 font-mono text-[12px] uppercase tracking-[0.08em] text-ink">
                    Evidence retrieved (no AI) · top {hits.length} for “{query}”
                  </h2>
                  <ol>
                    {hits.map((h, i) => {
                      const isFinding = h.kind === 'finding';
                      const open = redId === h.id;
                      const target = isFinding ? data.findings.find((f) => f.id === h.id) : undefined;
                      return (
                        <li key={h.id}>
                          <RecordCard
                            id={h.id}
                            scope="ask"
                            highlighted={hl === h.id}
                            rank={i + 1}
                            action={
                              isFinding ? (
                                <button type="button" onClick={() => setRedId(open ? null : h.id)} aria-expanded={open} className={`btn btn-sm ${open ? 'btn-primary' : ''}`}>
                                  {open ? 'Hide red team' : 'Red-team this'}
                                </button>
                              ) : undefined
                            }
                          />
                          {open && target && (
                            <div className="mb-6 sm:ml-[11.5rem]">
                              <RedTeamPanel target={target} scope={`rt-${h.id}`} onClose={() => setRedId(null)} />
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
