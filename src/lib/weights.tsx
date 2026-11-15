import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { DEFAULT_PARAMS, type ScoreParams } from './score';

/** Shared editorial weights: the Rank sliders also drive relevance on Export and Next fire. */
interface WeightsState {
  params: ScoreParams;
  setParams: (update: (p: ScoreParams) => ScoreParams) => void;
  reset: () => void;
  isDefault: boolean;
}

const clone = (p: ScoreParams): ScoreParams => JSON.parse(JSON.stringify(p)) as ScoreParams;

const WeightsContext = createContext<WeightsState>({ params: DEFAULT_PARAMS, setParams: () => {}, reset: () => {}, isDefault: true });

export const useWeights = (): WeightsState => useContext(WeightsContext);

export function WeightsProvider({ children }: { children: ReactNode }) {
  const [params, setP] = useState<ScoreParams>(() => clone(DEFAULT_PARAMS));
  const setParams = useCallback((update: (p: ScoreParams) => ScoreParams) => setP((p) => update(p)), []);
  const reset = useCallback(() => setP(clone(DEFAULT_PARAMS)), []);
  const isDefault = useMemo(() => JSON.stringify(params) === JSON.stringify(DEFAULT_PARAMS), [params]);
  const value = useMemo(() => ({ params, setParams, reset, isDefault }), [params, setParams, reset, isDefault]);
  return <WeightsContext.Provider value={value}>{children}</WeightsContext.Provider>;
}
