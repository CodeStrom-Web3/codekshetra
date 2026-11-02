// App-wide state: session, live event bus (WS-like), tick for reactive views.
import { createContext, useContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  getDb, persist, getSession, login as storeLogin, logout as storeLogout,
  autoSeedDemoRun, type Session,
} from '../engine/store';
import type { DB, Role } from '../engine/types';
import { SIM_ROLES, APPROVAL_ROLES } from '../engine/store';

export interface LiveEvent { id: number; type: string; ts: string; payload: Record<string, unknown> }

interface AppContextValue {
  db: DB;
  version: number;                 // bump to re-render data views
  refresh: () => void;
  session: Session | null;
  login: (email: string, password: string) => { ok: boolean; error?: string };
  logout: () => void;
  canSimulate: boolean;
  canApprove: boolean;
  canAdmin: boolean;
  events: LiveEvent[];
  emit: (type: string, payload?: Record<string, unknown>) => void;
  clearEvents: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);
let eventSeq = 0;

export function AppProvider({ children }: { children: ReactNode }) {
  const [version, setVersion] = useState(0);
  const [session, setSession] = useState<Session | null>(() => getSession());
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [db] = useState<DB>(() => {
    const d = getDb();
    autoSeedDemoRun();
    return d;
  });

  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  const emit = useCallback((type: string, payload: Record<string, unknown> = {}) => {
    eventSeq += 1;
    const evt: LiveEvent = { id: eventSeq, type, ts: new Date().toISOString(), payload };
    setEvents((prev) => [...prev.slice(-149), evt]);
    // persist any engine mutations triggered by handlers
    persist();
  }, []);

  const clearEvents = useCallback(() => setEvents([]), []);

  const login = useCallback((email: string, password: string) => {
    const res = storeLogin(email, password);
    if ('error' in res) return { ok: false, error: res.error };
    setSession(res);
    setVersion((v) => v + 1);
    return { ok: true };
  }, []);

  const logout = useCallback(() => {
    storeLogout();
    setSession(null);
  }, []);

  const role: Role | undefined = session?.role;
  const canSimulate = !!role && SIM_ROLES.includes(role);
  const canApprove = !!role && APPROVAL_ROLES.includes(role);
  const canAdmin = role === 'ADMIN';

  // real WebSocket bridge (when FastAPI backend is running); silently absent on static deploys
  useEffect(() => {
    let ws: WebSocket | null = null;
    let closed = false;
    try {
      const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws/events`;
      ws = new WebSocket(url);
      ws.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data);
          setEvents((prev) => [...prev.slice(-149),
            { id: ++eventSeq, type: `ws.${data.type}`, ts: data.ts ?? new Date().toISOString(), payload: data }]);
        } catch { /* ignore malformed frames */ }
      };
      ws.onerror = () => { /* static deployment: no backend WS — engine events still flow */ };
    } catch { /* ignore */ }
    return () => { closed = true; try { ws?.close(); } catch { /* noop */ } };
  }, []);

  const value = useMemo<AppContextValue>(() => ({
    db, version, refresh, session, login, logout, canSimulate, canApprove, canAdmin,
    events, emit, clearEvents,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [db, version, session, events, login, logout, canSimulate, canApprove, canAdmin, refresh]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
