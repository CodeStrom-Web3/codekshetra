import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import Layout from './components/Layout';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Agents from './pages/Agents';
import Simulations from './pages/Simulations';
import Scenarios from './pages/Scenarios';
import LiveMonitor from './pages/LiveMonitor';
import Guardian from './pages/Guardian';
import Policies from './pages/Policies';
import Approvals from './pages/Approvals';
import Analytics from './pages/Analytics';
import AuditLogs from './pages/AuditLogs';
import Reports from './pages/Reports';
import Settings from './pages/Settings';

// Static hosting (Vercel preview) has no SPA rewrite guarantees → HashRouter.
const Router = (import.meta as unknown as { env?: { VITE_ROUTER?: string } }).env?.VITE_ROUTER === 'browser'
  ? BrowserRouter : HashRouter;

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session } = useApp();
  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AppProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route element={<RequireAuth><Layout /></RequireAuth>}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/agents" element={<Agents />} />
            <Route path="/simulations" element={<Simulations />} />
            <Route path="/scenarios" element={<Scenarios />} />
            <Route path="/monitor" element={<LiveMonitor />} />
            <Route path="/guardian" element={<Guardian />} />
            <Route path="/policies" element={<Policies />} />
            <Route path="/approvals" element={<Approvals />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/audit" element={<AuditLogs />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AppProvider>
  );
}
