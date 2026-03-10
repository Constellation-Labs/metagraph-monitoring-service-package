'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';

import { api } from './api-client';
import { useAuth } from './auth-context';

type MetagraphInfo = {
  name: string;
  id: string;
  health: string;
  nodeCount: number;
  monitoringEnabled: boolean;
};

type MetagraphContextType = {
  metagraphs: MetagraphInfo[];
  activeMetagraph: string | null;
  setActiveMetagraph: (name: string) => void;
  refreshMetagraphs: () => Promise<void>;
  loading: boolean;
  error: string | null;
};

const MetagraphContext = createContext<MetagraphContextType>({
  metagraphs: [],
  activeMetagraph: null,
  setActiveMetagraph: () => {},
  refreshMetagraphs: async () => {},
  loading: true,
  error: null,
});

export function MetagraphProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [metagraphs, setMetagraphs] = useState<MetagraphInfo[]>([]);
  const [activeMetagraph, setActive] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshMetagraphs = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api.getMetagraphs();
      setMetagraphs(data);
      setError(null);

      if (data.length > 0 && !activeMetagraph) {
        const stored = localStorage.getItem('active_metagraph');
        const valid = data.find((m: MetagraphInfo) => m.name === stored);
        setActive(valid ? stored : data[0].name);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token, activeMetagraph]);

  useEffect(() => {
    refreshMetagraphs();
    const interval = setInterval(refreshMetagraphs, 30000);
    return () => clearInterval(interval);
  }, [refreshMetagraphs]);

  const setActiveMetagraph = (name: string) => {
    localStorage.setItem('active_metagraph', name);
    setActive(name);
  };

  return (
    <MetagraphContext.Provider
      value={{
        metagraphs,
        activeMetagraph,
        setActiveMetagraph,
        refreshMetagraphs,
        loading,
        error,
      }}
    >
      {children}
    </MetagraphContext.Provider>
  );
}

export function useMetagraph() {
  return useContext(MetagraphContext);
}
