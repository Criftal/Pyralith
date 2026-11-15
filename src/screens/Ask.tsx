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
      <ScreenHeader kicker="Ask FIREBREAK" title="Ask the corpus">
        Keyword retrieval over {data.findings.length} verified findings and {data.claims.length} cited claims, ranked in your browser with no AI. When live mode is
        configured, Claude may summarise only the retrieved records, and every sentence must cite one.
      </ScreenHeader>

      {nothingIndexed ? (
        <MissingData files={['findings', 'claims']} what="Search" />
      ) : (
        <>
          <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row" role="search">
            <input
              type="search"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about flammability, gravity, oxygen, suppression…"
              aria-label="Question"
              className="w-full rounded-md border border-line-strong bg-panel px-4 py-3 text-base text-text placeholder:text-faint"
            />
            <button type="submit" className="rounded-md bg-flame px-5 py-3 font-semibold text-black transition-colors hover:bg-flame-soft">
              Search
            </button>
          </form>
          <div className="mt-3 flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => run(s)}
                className="rounded-full border border-line-strong px-3 py-1.5 text-left text-xs text-muted transition-colors hover:border-cool hover:text-text"
              >
                {s}
              </button>
            ))}
          </div>

          {query && (
            <div className="mt-8">
              {hits.length === 0 ? (
                <p className="rounded-lg border border-dashed border-line-strong p-4 text-sm text-text">{NO_EVIDENCE}</p>
              ) : (
                <>
                  <div className="mb-4">
                    <LiveControls
                      live={live}
                      label="Ask Claude (cites only these records)"
                      state={ai}
                      onRun={askClaude}
                      offNote="Live AI mode is not configured on this deployment. Showing retrieved evidence only."
                    />
                  </div>
                  {ai.status === 'done' && ai.res && (
                    <div className="mb-6">
                      <AiAnswer res={ai.res} onCite={go} />
                    </div>
                  )}
                  <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
                    Evidence retrieved (no AI) · top {hits.length} for “{query}”
                  </h2>
                  <ol className="mt-3 space-y-5">
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
                                <button
                                  type="button"
                                  onClick={() => setRedId(open ? null : h.id)}
                                  aria-expanded={open}
                                  className={`rounded border px-2 py-0.5 font-mono text-[0.68rem] transition-colors ${open ? 'border-flame text-flame' : 'border-line-strong text-muted hover:border-flame hover:text-flame'}`}
                                >
                                  {open ? 'Hide red team' : 'Red-team this'}
                                </button>
                              ) : undefined
                            }
                          />
                          {open && target && (
                            <div className="mt-3 sm:ml-6">
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
