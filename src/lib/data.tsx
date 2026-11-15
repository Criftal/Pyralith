import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Claim, Finding, Investigation, Meta, Mission, Source } from '../types';

export interface Dataset {
  findings: Finding[];
  investigations: Investigation[];
  sources: Record<string, Source>;
  missions: Mission[];
  claims: Claim[];
  meta: Meta | null;
}

export type FileKey = keyof Dataset;
export const FILE_KEYS: FileKey[] = ['findings', 'investigations', 'sources', 'missions', 'claims', 'meta'];

export interface DataState {
  loading: boolean;
  data: Dataset;
  /** Files that were absent or not valid JSON of the expected shape. */
  missing: FileKey[];
}

export const EMPTY_DATASET: Dataset = { findings: [], investigations: [], sources: {}, missions: [], claims: [], meta: null };

/** Exported so tests can inject a dataset; app code uses DataProvider. */
export const DataContext = createContext<DataState>({ loading: true, data: EMPTY_DATASET, missing: [] });

export const useData = (): DataState => useContext(DataContext);

async function fetchJson(key: FileKey): Promise<unknown> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data/${key}.json`, { cache: 'no-cache' });
    if (!res.ok) return undefined;
    const type = res.headers.get('content-type') ?? '';
    if (type.includes('text/html')) return undefined; // SPA fallback, not our data
    return await res.json();
  } catch {
    return undefined;
  }
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function shapeOk(key: FileKey, v: unknown): boolean {
  if (key === 'sources' || key === 'meta') return isObject(v);
  return Array.isArray(v);
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DataState>({ loading: true, data: EMPTY_DATASET, missing: [] });

  useEffect(() => {
    let alive = true;
    Promise.all(FILE_KEYS.map(async (k) => [k, await fetchJson(k)] as const)).then((entries) => {
      if (!alive) return;
      const data: Dataset = { ...EMPTY_DATASET };
      const missing: FileKey[] = [];
      for (const [k, v] of entries) {
        if (v === undefined || !shapeOk(k, v)) {
          missing.push(k);
          continue;
        }
        // Shape was checked above; the pipeline's pytest suite validates field-level schema.
        (data as unknown as Record<FileKey, unknown>)[k] = v;
      }
      setState({ loading: false, data, missing });
    });
    return () => {
      alive = false;
    };
  }, []);

  return <DataContext.Provider value={state}>{children}</DataContext.Provider>;
}
