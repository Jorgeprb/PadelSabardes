import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { setupMessageHandler } from './services/firebaseConfig';
import { useEffect } from 'react';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import MatchDetailPage from './pages/MatchDetailPage';
import TournamentPage from './pages/TournamentPage';
import SettingsPage from './pages/SettingsPage';
import CreateMatchPage from './pages/CreateMatchPage';
import { CalendarDays, Trophy, Settings } from 'lucide-react';
import './App.css';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="app-loading"><div className="spinner"></div></div>;
  return user ? <>{children}</> : <Navigate to="/login" />;
}

function BottomTabBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { primaryColor } = useTheme();

  // Don't show on detail/create pages
  const hiddenPaths = ['/match/', '/create-match', '/login', '/register'];
  if (hiddenPaths.some(p => location.pathname.startsWith(p))) return null;

  const tabs = [
    { path: '/', icon: CalendarDays, label: 'Partidos' },
    { path: '/tournament', icon: Trophy, label: 'Torneo' },
    { path: '/settings', icon: Settings, label: 'Ajustes' },
  ];

  return (
    <div className="bottom-tab-bar">
      {tabs.map(tab => {
        const active = location.pathname === tab.path;
        return (
          <button key={tab.path} className={`tab-item ${active ? 'active' : ''}`}
            style={active ? { color: primaryColor } : undefined}
            onClick={() => navigate(tab.path)}
          >
            <tab.icon size={22} />
            <span className="tab-label">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function AppShell() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    // Listen for foreground push messages
    const unsub = setupMessageHandler((payload: any) => {
      if (Notification.permission === 'granted') {
        new Notification(payload.notification?.title || 'Sabardes', {
          body: payload.notification?.body || '',
          icon: '/padel-logo-192.png',
        });
      }
    });
    return () => { if (unsub) unsub(); };
  }, [user]);

  return (
    <div className="app-container">
      <div className="app-content">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
          <Route path="/match/:matchId" element={<PrivateRoute><MatchDetailPage /></PrivateRoute>} />
          <Route path="/tournament" element={<PrivateRoute><TournamentPage /></PrivateRoute>} />
          <Route path="/settings" element={<PrivateRoute><SettingsPage /></PrivateRoute>} />
          <Route path="/create-match" element={<PrivateRoute><CreateMatchPage /></PrivateRoute>} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
      <BottomTabBar />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <AppShell />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
