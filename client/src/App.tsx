import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense, ReactNode } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Layout from './components/layout/Layout';
import ErrorBoundary from './components/common/ErrorBoundary';
import Login from './pages/Login';
import QRConfirm from './pages/QRConfirm';
import { NexusToasts } from './components/ui/NexusModal';
import { LoadingScreen } from './components/ui/LoadingScreen';
import MaintenanceOverlay from './components/ui/MaintenanceOverlay';
const ChatWidget = lazy(() => import('./components/chat/ChatWidget'));
const CommandPalette = lazy(() => import('./components/common/CommandPalette'));
import { Toaster } from 'sonner';

// Lazy loaded pages (heavy bundles)
const Dashboard = lazy(() => import('./pages/Dashboard'));
const ContentPlan = lazy(() => import('./pages/ContentPlan'));
const Materials = lazy(() => import('./pages/Materials'));
const Analytics = lazy(() => import('./pages/Analytics'));
const QRGenerator = lazy(() => import('./pages/QRGenerator'));
const ImageGenerator = lazy(() => import('./pages/ImageGenerator'));
const PingTool = lazy(() => import('./pages/PingTool'));
const Randomizer = lazy(() => import('./pages/Randomizer'));
const Weather = lazy(() => import('./pages/Weather'));
const ImageConverter = lazy(() => import('./pages/ImageConverter'));
const Users = lazy(() => import('./pages/Users'));
const IdeaMap = lazy(() => import('./pages/IdeaMap'));
const Kanban = lazy(() => import('./pages/Kanban'));
const Partners = lazy(() => import('./pages/Partners'));
const Vacations = lazy(() => import('./pages/Vacations'));
const Inventory = lazy(() => import('./pages/Inventory'));
const Events = lazy(() => import('./pages/Events'));
const Projects = lazy(() => import('./pages/Projects'));
const Knowledge = lazy(() => import('./pages/Knowledge'));
const BrandBank = lazy(() => import('./pages/BrandBank'));
const Profile = lazy(() => import('./pages/Profile'));
const AdminMonitoring = lazy(() => import('./pages/AdminMonitoring'));
const AIChat = lazy(() => import('./pages/AIChat'));
const BackgroundRemover = lazy(() => import('./pages/BackgroundRemover'));
const AuroraForecast = lazy(() => import('./pages/AuroraForecast'));
const Registrations = lazy(() => import('./pages/Registrations'));
const PublicRegistration = lazy(() => import('./pages/PublicRegistration'));
const CancelRegistration = lazy(() => import('./pages/CancelRegistration'));
const CheckinPage = lazy(() => import('./pages/CheckinPage'));
const CheckinScanner = lazy(() => import('./pages/CheckinScanner'));
const ParticipantsList = lazy(() => import('./pages/ParticipantsList'));

function PageWrapper({ children }: { children: ReactNode }) {
  return <ErrorBoundary><Suspense fallback={<LoadingScreen />}>{children}</Suspense></ErrorBoundary>;
}

function ProtectedRoute({ children, allowedRoles }: { children: ReactNode; allowedRoles?: string[] }) {
  const { isAuthenticated, isLoading, hasRole } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !hasRole(allowedRoles)) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="font-mono text-xl font-bold mb-2" style={{ color: 'var(--color-text-primary)' }}>Нет доступа</h2>
          <p className="font-mono text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
            У вас нет прав доступа к этому ресурсу
          </p>
          <a href="/" className="inline-block px-5 py-2.5 rounded-xl font-mono text-sm font-bold transition-all"
            style={{ backgroundColor: 'rgba(0,255,136,0.15)', color: 'var(--color-primary)', border: '1px solid rgba(0,255,136,0.3)' }}>
            НА ГЛАВНУЮ
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/qr-confirm" element={<QRConfirm />} />
      <Route path="/reg/:slug" element={<PublicRegistration />} />
      <Route path="/reg/cancel/:token" element={<CancelRegistration />} />
      <Route path="/reg/checkin/:token" element={<CheckinPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="content" element={<PageWrapper><ContentPlan /></PageWrapper>} />
        <Route path="materials" element={<PageWrapper><Materials /></PageWrapper>} />
        <Route path="analytics" element={<PageWrapper><Analytics /></PageWrapper>} />
        <Route path="qr" element={<PageWrapper><QRGenerator /></PageWrapper>} />
        <Route path="images" element={<PageWrapper><ImageGenerator /></PageWrapper>} />
        <Route path="ideas" element={<PageWrapper><IdeaMap /></PageWrapper>} />
        <Route path="kanban" element={<PageWrapper><Kanban /></PageWrapper>} />
        <Route path="partners" element={<PageWrapper><Partners /></PageWrapper>} />
        <Route path="vacations" element={<PageWrapper><Vacations /></PageWrapper>} />
        <Route path="inventory" element={
          <ProtectedRoute allowedRoles={['super_admin', 'мол']}>
            <PageWrapper><Inventory /></PageWrapper>
          </ProtectedRoute>
        } />
        <Route path="events" element={<PageWrapper><Events /></PageWrapper>} />
        <Route path="projects" element={<PageWrapper><Projects /></PageWrapper>} />
        <Route path="knowledge" element={<PageWrapper><Knowledge /></PageWrapper>} />
        <Route path="ping" element={<PageWrapper><PingTool /></PageWrapper>} />
        <Route path="random" element={<PageWrapper><Randomizer /></PageWrapper>} />
        <Route path="weather" element={<PageWrapper><Weather /></PageWrapper>} />
        <Route path="image-converter" element={<PageWrapper><ImageConverter /></PageWrapper>} />
        <Route path="ai-chat" element={<PageWrapper><AIChat /></PageWrapper>} />
        <Route path="bg-remover" element={<PageWrapper><BackgroundRemover /></PageWrapper>} />
        <Route path="aurora" element={<PageWrapper><AuroraForecast /></PageWrapper>} />
        <Route path="brandbank" element={<PageWrapper><BrandBank /></PageWrapper>} />
        <Route path="registrations" element={<PageWrapper><Registrations /></PageWrapper>} />
        <Route path="checkin-scanner" element={<PageWrapper><CheckinScanner /></PageWrapper>} />
        <Route path="registrations/:id/participants" element={<PageWrapper><ParticipantsList /></PageWrapper>} />
        <Route path="profile" element={<PageWrapper><Profile /></PageWrapper>} />
        <Route
          path="users"
          element={
            <ProtectedRoute allowedRoles={['super_admin']}>
              <PageWrapper><Users /></PageWrapper>
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/monitoring"
          element={
            <ProtectedRoute allowedRoles={['super_admin']}>
              <PageWrapper><AdminMonitoring /></PageWrapper>
            </ProtectedRoute>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function ChatWidgetWrapper() {
  const { isAuthenticated } = useAuth();
  const pathname = window.location.pathname;
  if (!isAuthenticated) return null;
  if (pathname.startsWith('/reg/')) return null;
  return <ErrorBoundary><Suspense fallback={null}><ChatWidget /></Suspense></ErrorBoundary>;
}

function App() {
  return (
    <Router>
      <ThemeProvider>
        <AuthProvider>
          <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg)' }}>
            <AppRoutes />
          </div>
          <ChatWidgetWrapper />
          <CommandPalette />
          <MaintenanceOverlay />
          <NexusToasts />
          <Toaster
            position="top-right"
            richColors
            toastOptions={{
              style: {
                background: 'rgba(15, 15, 25, 0.95)',
                border: '1px solid rgba(0, 255, 136, 0.15)',
                color: '#e8e8ec',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '13px',
                backdropFilter: 'blur(16px)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), 0 0 12px rgba(0, 255, 136, 0.08)',
                borderRadius: '12px',
              },
            }}
          />
        </AuthProvider>
      </ThemeProvider>
    </Router>
  );
}

export default App;
