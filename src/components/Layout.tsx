// Authenticated app shell: sidebar + topbar + live event ticker + routed content.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Outlet, NavLink, useNavigate, Link } from 'react-router-dom';
import {
  ShieldHalf, LayoutDashboard, Bot, FlaskConical, Crosshair, Radio, Eye, ScrollText,
  CheckSquare, BarChart3, FileText, Settings, LogOut, ChevronLeft, ChevronRight,
  Menu, X, Zap,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { getSession } from '../engine/store';
import type { Role } from '../engine/types';

const NAV: Array<{ to: string; label: string; icon: typeof LayoutDashboard; roles?: Role[] }> = [
  { to: '/dashboard', label: 'Command Center', icon: LayoutDashboard },
  { to: '/agents', label: 'Agents', icon: Bot },
  { to: '/simulations', label: 'Simulations', icon: FlaskConical },
  { to: '/scenarios', label: 'Scenario Library', icon: Crosshair },
  { to: '/monitor', label: 'Live Monitor', icon: Radio },
  { to: '/guardian', label: 'Guardian Feed', icon: Eye },
  { to: '/policies', label: 'Policies', icon: ScrollText },
  { to: '/approvals', label: 'Approvals', icon: CheckSquare },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/audit', label: 'Audit Logs', icon: ShieldHalf, roles: ['ADMIN', 'SECURITY_ANALYST'] },
  { to: '/reports', label: 'Reports', icon: FileText },
  { to: '/settings', label: 'Settings', icon: Settings },
];

const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Administrator', SECURITY_ANALYST: 'Security Analyst', FINANCE_USER: 'Finance User', GENERAL_USER: 'General User',
};

export default function Layout() {
  const { session, logout, events, db, version } = useApp();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  void version;

  const pendingApprovals = db.approvals.filter((a) => a.status === 'PENDING').length;
  const lastEvent = events[events.length - 1];
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight });
  }, [events.length]);

  const visibleNav = useMemo(
    () => NAV.filter((item) => !item.roles || (session && item.roles.includes(session.role))),
    [session],
  );

  if (!session) return null;

  const SidebarContent = ({ mobile = false }: { mobile?: boolean }) => (
    <div className="flex h-full flex-col">
      {/* brand */}
      <Link to="/dashboard" onClick={() => setMobileOpen(false)}
        className="flex items-center gap-2.5 px-4 h-16 border-b border-[var(--color-line)] shrink-0">
        <div className="relative">
          <ShieldHalf size={26} className="text-cyan-400" strokeWidth={1.8} />
          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-[#05080f] pulse-dot" />
        </div>
        {(!collapsed || mobile) && (
          <div className="leading-tight">
            <div className="display font-bold text-[15px] tracking-[0.18em] text-slate-100">AGENT<span className="text-cyan-400">SHIELD</span></div>
            <div className="mono text-[8px] uppercase tracking-[0.22em] text-slate-500">AI Agent Defence</div>
          </div>
        )}
      </Link>

      {/* nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {visibleNav.map((item) => {
          const badge = item.to === '/approvals' && pendingApprovals > 0 ? pendingApprovals : 0;
          return (
            <NavLink key={item.to} to={item.to} onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `group flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[12.5px] font-medium transition-all border border-transparent ${
                  isActive
                    ? 'bg-cyan-400/10 text-cyan-300 border-cyan-400/25 shadow-[inset_0_0_18px_rgba(34,211,238,0.06)]'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.035]'
                }`}>
              <item.icon size={16} strokeWidth={1.9} className="shrink-0" />
              {(!collapsed || mobile) && <span className="truncate flex-1">{item.label}</span>}
              {(!collapsed || mobile) && badge > 0 && (
                <span className="mono text-[9px] font-bold min-w-5 h-5 px-1.5 rounded-full bg-amber-400/90 text-black flex items-center justify-center">{badge}</span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* footer block */}
      <div className="border-t border-[var(--color-line)] p-3 shrink-0">
        {(!collapsed || mobile) && (
          <div className="mb-2.5 rounded-lg border border-emerald-400/20 bg-emerald-400/5 px-2.5 py-2">
            <div className="flex items-center gap-1.5 mono text-[9px] uppercase tracking-widest text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 pulse-dot" /> Gateway Armed
            </div>
            <div className="text-[9.5px] text-slate-500 mt-0.5 leading-snug">Synthetic sandbox · deterministic-fallback AI · zero external calls</div>
          </div>
        )}
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-gradient-to-br from-cyan-400/80 to-cyan-700/80 flex items-center justify-center text-[11px] font-bold text-black shrink-0">
            {session.fullName.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
          </div>
          {(!collapsed || mobile) && (
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold text-slate-200 truncate">{session.fullName}</div>
              <div className="mono text-[8.5px] uppercase tracking-wider text-cyan-400/80">{ROLE_LABEL[session.role]}</div>
            </div>
          )}
          <button onClick={() => { logout(); navigate('/'); }} title="Sign out"
            className="p-1.5 rounded-md text-slate-500 hover:text-rose-300 hover:bg-rose-400/10 transition-colors">
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-void bg-grid text-slate-200 flex overflow-hidden">
      {/* ambient glow */}
      <div className="pointer-events-none fixed inset-0 bg-radial-glow" />

      {/* desktop sidebar */}
      <aside className={`relative z-20 hidden lg:flex flex-col border-r border-[var(--color-line)] bg-[#070c17]/90 backdrop-blur transition-all duration-300 ${collapsed ? 'w-[62px]' : 'w-[232px]'}`}>
        <SidebarContent />
        <button onClick={() => setCollapsed((v) => !v)}
          className="absolute -right-3 top-[74px] z-30 h-6 w-6 rounded-full border border-[var(--color-line2)] bg-[#0d1626] flex items-center justify-center text-slate-400 hover:text-cyan-300">
          {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>
      </aside>

      {/* mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/70" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-[250px] bg-[#070c17] border-r border-[var(--color-line2)]">
            <button onClick={() => setMobileOpen(false)} className="absolute right-3 top-4 text-slate-400"><X size={20} /></button>
            <SidebarContent mobile />
          </aside>
        </div>
      )}

      {/* main column */}
      <div className="relative z-10 flex-1 flex flex-col min-w-0 h-screen">
        {/* topbar */}
        <header className="h-14 shrink-0 border-b border-[var(--color-line)] bg-[#070c17]/80 backdrop-blur flex items-center gap-3 px-3 sm:px-5">
          <button onClick={() => setMobileOpen(true)} className="lg:hidden text-slate-400 p-1.5"><Menu size={19} /></button>
          <div className="hidden sm:flex items-center gap-2 mono text-[9px] uppercase tracking-[0.2em] text-slate-500">
            <Zap size={11} className="text-amber-400" /> Live Operations
          </div>
          <div className="flex-1" />
          {/* live ticker */}
          <div ref={feedRef} className="hidden md:flex items-center gap-2 max-w-[430px] overflow-hidden whitespace-nowrap mono text-[10px] text-slate-500">
            {lastEvent ? (
              <span className="feed-item inline-flex items-center gap-1.5" key={lastEvent.id}>
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                <span className="text-cyan-300/90">{lastEvent.type}</span>
                <span className="text-slate-600 truncate">{JSON.stringify(lastEvent.payload).slice(0, 90)}</span>
              </span>
            ) : (
              <span>awaiting gateway events… launch a simulation to see live traffic</span>
            )}
          </div>
          <Link to="/monitor" className="flex items-center gap-1.5 mono text-[9px] uppercase tracking-widest text-cyan-300 border border-cyan-400/30 rounded-md px-2 py-1.5 hover:bg-cyan-400/10">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 pulse-dot" /> Live
          </Link>
        </header>

        {/* content */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1500px] p-3 sm:p-5">
            <AnimatePresence mode="wait">
              <Outlet />
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
}

export function useRequireRole(...roles: Role[]) {
  const session = getSession();
  return session ? roles.includes(session.role) : false;
}
