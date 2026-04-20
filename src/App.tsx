import { useEffect, type ReactNode } from 'react';
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { CalendarDays, FileStack, Settings, Trophy, Users } from 'lucide-react';
import './App.css';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider, useTranslation } from './context/LanguageContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import DashboardPage from './pages/DashboardPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import MatchDetailPage from './pages/MatchDetailPage';
import SettingsPage from './pages/SettingsPage';
import TournamentPage from './pages/TournamentPage';
import CreateMatchPage from './pages/CreateMatchPage';
import UsersListPage from './pages/UsersListPage';
import GroupsPage from './pages/GroupsPage';
import CreateEditGroupPage from './pages/CreateEditGroupPage';
import GroupDetailPage from './pages/GroupDetailPage';
import { setupMessageHandler, showForegroundNotification } from './services/firebaseConfig';

function FullScreenLoader() {
  const { primaryColor } = useTheme();
  return (
    <div className="app-loading-screen">
      <div className="spinner" style={{ borderTopColor: primaryColor }}></div>
    </div>
  );
}

function PrivateRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  return user ? <>{children}</> : <Navigate to="/login" replace />;
}

function AdminRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  return user?.role === 'admin' ? <>{children}</> : <Navigate to="/" replace />;
}

function BottomTabBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { primaryColor, colors } = useTheme();
  const { user } = useAuth();
  const { t } = useTranslation();

  const hiddenMatchers = [
    (path: string) => path.startsWith('/login'),
    (path: string) => path.startsWith('/register'),
    (path: string) => path.startsWith('/match/'),
    (path: string) => path.startsWith('/create-match'),
    (path: string) => path.startsWith('/groups/new'),
    (path: string) => path.startsWith('/groups/') && path !== '/groups',
  ];

  if (hiddenMatchers.some((matcher) => matcher(location.pathname))) return null;

  const tabs = [
    { path: '/', icon: CalendarDays, label: t('nav_matches') },
    { path: '/tournament', icon: Trophy, label: t('nav_tournament') },
    ...(user?.role === 'admin'
      ? [
          { path: '/users', icon: Users, label: t('nav_users') },
          { path: '/groups', icon: FileStack, label: t('nav_groups') },
        ]
      : []),
    { path: '/settings', icon: Settings, label: t('nav_settings') },
  ];

  return (
    <div className="bottom-tab-bar">
      {tabs.map((tab) => {
        const active = location.pathname === tab.path;
        const Icon = tab.icon;
        return (
          <button
            key={tab.path}
            className={`tab-item ${active ? 'active' : ''}`}
            style={active ? { color: primaryColor } : { color: colors.textDim }}
            onClick={() => navigate(tab.path)}
          >
            <Icon size={22} strokeWidth={2.2} />
            <span className="tab-label">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function AppShell() {
  const { user } = useAuth();
  const { colors } = useTheme();

  useEffect(() => {
    if (!user) return undefined;
    const unsubscribe = setupMessageHandler((payload: any) => {
      void showForegroundNotification(payload);
    });
    return () => unsubscribe?.();
  }, [user]);

  return (
    <div className="app-frame" style={{ backgroundColor: colors.background }}>
      <div className="app-container">
        <div className="app-content">
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
            <Route path="/match/:matchId" element={<PrivateRoute><MatchDetailPage /></PrivateRoute>} />
            <Route path="/create-match" element={<PrivateRoute><CreateMatchPage /></PrivateRoute>} />
            <Route path="/tournament" element={<PrivateRoute><TournamentPage /></PrivateRoute>} />
            <Route path="/settings" element={<PrivateRoute><SettingsPage /></PrivateRoute>} />
            <Route path="/users" element={<PrivateRoute><AdminRoute><UsersListPage /></AdminRoute></PrivateRoute>} />
            <Route path="/groups" element={<PrivateRoute><AdminRoute><GroupsPage /></AdminRoute></PrivateRoute>} />
            <Route path="/groups/new" element={<PrivateRoute><AdminRoute><CreateEditGroupPage /></AdminRoute></PrivateRoute>} />
            <Route path="/groups/:groupId" element={<PrivateRoute><AdminRoute><GroupDetailPage /></AdminRoute></PrivateRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
        <BottomTabBar />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <LanguageProvider>
          <AuthProvider>
            <AppShell />
          </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
