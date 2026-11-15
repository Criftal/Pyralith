import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import type { Mission, MissionId } from '../types';
import { useData } from './data';

const MISSION_IDS: MissionId[] = ['iss', 'artemis_habitat', 'pressurized_rover', 'eva_suit', 'mars_transit', 'mars_habitat'];
const STORAGE_KEY = 'firebreak.mission';
export const DEFAULT_MISSION: MissionId = 'artemis_habitat';

const isMissionId = (v: unknown): v is MissionId => typeof v === 'string' && (MISSION_IDS as string[]).includes(v);

interface MissionState {
  id: MissionId;
  mission: Mission | null;
  setId: (id: MissionId) => void;
}

const MissionContext = createContext<MissionState>({ id: DEFAULT_MISSION, mission: null, setId: () => {} });

export const useMission = (): MissionState => useContext(MissionContext);

function readStored(): MissionId {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (isMissionId(v)) return v;
  } catch {
    /* storage unavailable: fall back to default */
  }
  return DEFAULT_MISSION;
}

export function MissionProvider({ children }: { children: ReactNode }) {
  const { data } = useData();
  const [id, setIdState] = useState<MissionId>(readStored);
  const setId = useCallback((next: MissionId) => {
    setIdState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);
  const mission = data.missions.find((m) => m.id === id) ?? null;
  return <MissionContext.Provider value={{ id, mission, setId }}>{children}</MissionContext.Provider>;
}
