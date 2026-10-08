import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { Suspense, ReactNode } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Layout from './components/layout/Layout';
import ErrorBoundary from './components/common/ErrorBoundary';
import { lazyPage } from './utils/lazyPage';
import Login from './pages/Login';
import QRConfirm from './pages/QRConfirm';
import { NexusToasts } from './components/ui/NexusModal';
import { LoadingScreen } from './components/ui/LoadingScreen';
import MaintenanceOverlay from './components/ui/MaintenanceOverlay';
const ChatWidget = lazyPage(() => import('./components/chat/ChatWidget'));
const CommandPalette = lazyPage(() => import('./components/common/CommandPalette'));
const Onboarding = lazyPage(() => import('./components/common/Onboarding'));
import { Toaster } from 'sonner';

// Lazy loaded pages (heavy bundles)
const Dashboard = lazyPage(() => import('./pages/Dashboard'));
const ContentPlan = lazyPage(() => import('./pages/ContentPlan'));
const Materials = lazyPage(() => import('./pages/Materials'));
const Analytics = lazyPage(() => import('./pages/Analytics'));
const QRGenerator = lazyPage(() => import('./pages/QRGenerator'));
const ImageGenerator = lazyPage(() => import('./pages/ImageGenerator'));
const PingTool = lazyPage(() => import('./pages/PingTool'));
const Randomizer = lazyPage(() => import('./pages/Randomizer'));
const Weather = lazyPage(() => import('./pages/Weather'));
const ImageConverter = lazyPage(() => import('./pages/ImageConverter'));
const DocConverter = lazyPage(() => import('./pages/DocConverter'));
const PhotoCollage = lazyPage(() => import('./pages/PhotoCollage'));
const LinkShortener = lazyPage(() => import('./pages/LinkShortener'));
const Users = lazyPage(() => import('./pages/Users'));
const IdeaMap = lazyPage(() => import('./pages/IdeaMap'));
const Kanban = lazyPage(() => import('./pages/Kanban'));
const Partners = lazyPage(() => import('./pages/Partners'));
const Vacations = lazyPage(() => import('./pages/Vacations'));
const Inventory = lazyPage(() => import('./pages/Inventory'));
const Events = lazyPage(() => import('./pages/Events'));
const Projects = lazyPage(() => import('./pages/Projects'));
const Knowledge = lazyPage(() => import('./pages/Knowledge'));
const BrandBank = lazyPage(() => import('./pages/BrandBank'));
const Profile = lazyPage(() => import('./pages/Profile'));
const AdminMonitoring = lazyPage(() => import('./pages/AdminMonitoring'));
const AIChat = lazyPage(() => import('./pages/AIChat'));
const BackgroundRemover = lazyPage(() => import('./pages/BackgroundRemover'));
const AuroraForecast = lazyPage(() => import('./pages/AuroraForecast'));
const Registrations = lazyPage(() => import('./pages/Registrations'));
const PublicRegistration = lazyPage(() => import('./pages/PublicRegistration'));
const CancelRegistration = lazyPage(() => import('./pages/CancelRegistration'));
const CheckinPage = lazyPage(() => import('./pages/CheckinPage'));
const CheckinScanner = lazyPage(() => import('./pages/CheckinScanner'));
const ParticipantsList = lazyPage(() => import('./pages/ParticipantsList'));
const NexusControl = lazyPage(() => import('./pages/NexusControl'));
const Widgets = lazyPage(() => import('./pages/Widgets'));
const PublicWidget = lazyPage(() => import('./pages/PublicWidget'));
const Lists = lazyPage(() => import('./pages/Lists'));
const PublicList = lazyPage(() => import('./pages/PublicList'));
const Surveys = lazyPage(() => import('./pages/Surveys'));
const PublicSurvey = lazyPage(() => import('./pages/PublicSurvey'));
const PublicSurveyStats = lazyPage(() => import('./pages/PublicSurveyStats'));

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
          <Link to="/" className="inline-block px-5 py-2.5 rounded-xl font-mono text-sm font-bold transition-all"
            style={{ backgroundColor: 'rgba(0,255,136,0.15)', color: 'var(--color-primary)', border: '1px solid rgba(0,255,136,0.3)' }}>
            НА ГЛАВНУЮ
          </Link>
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
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <PageWrapper><Login /></PageWrapper>} />
      <Route path="/qr-confirm" element={<PageWrapper><QRConfirm /></PageWrapper>} />
      <Route path="/reg/:slug" element={<PageWrapper><PublicRegistration /></PageWrapper>} />
      <Route path="/reg/cancel/:token" element={<PageWrapper><CancelRegistration /></PageWrapper>} />
      <Route path="/reg/checkin/:token" element={<PageWrapper><CheckinPage /></PageWrapper>} />
      <Route path="/control" element={<PageWrapper><NexusControl /></PageWrapper>} />
      <Route path="/w/:slug" element={<PageWrapper><PublicWidget /></PageWrapper>} />
      <Route path="/lists/public/:slug" element={<PageWrapper><PublicList /></PageWrapper>} />
      <Route path="/survey/:slug" element={<PageWrapper><PublicSurvey /></PageWrapper>} />
      <Route path="/opros/:slug" element={<PageWrapper><PublicSurvey /></PageWrapper>} />
      <Route path="/survey/:slug/stats" element={<PageWrapper><PublicSurveyStats /></PageWrapper>} />
      <Route path="/opros/:slug/stats" element={<PageWrapper><PublicSurveyStats /></PageWrapper>} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<PageWrapper><Dashboard /></PageWrapper>} />
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
        <Route path="doc-converter" element={<PageWrapper><DocConverter /></PageWrapper>} />
        <Route path="doc-converter/:tool" element={<PageWrapper><DocConverter /></PageWrapper>} />
        <Route path="photo-collage" element={<PageWrapper><PhotoCollage /></PageWrapper>} />
        <Route path="short-links" element={<PageWrapper><LinkShortener /></PageWrapper>} />
        <Route path="ai-chat" element={<PageWrapper><AIChat /></PageWrapper>} />
        <Route path="bg-remover" element={<PageWrapper><BackgroundRemover /></PageWrapper>} />
        <Route path="aurora" element={<PageWrapper><AuroraForecast /></PageWrapper>} />
        <Route path="brandbank" element={<PageWrapper><BrandBank /></PageWrapper>} />
        <Route path="registrations" element={<PageWrapper><Registrations /></PageWrapper>} />
        <Route path="widgets" element={<PageWrapper><Widgets /></PageWrapper>} />
        <Route path="lists" element={<PageWrapper><Lists /></PageWrapper>} />
        <Route path="surveys" element={<PageWrapper><Surveys /></PageWrapper>} />
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
  const { pathname } = useLocation();
  if (!isAuthenticated) return null;
  if (pathname.startsWith('/reg/') || pathname.startsWith('/control') || pathname.startsWith('/w/')) return null;
  return <ErrorBoundary><Suspense fallback={null}><ChatWidget /></Suspense></ErrorBoundary>;
}

function isPublicPath(pathname: string): boolean {
  return (
    pathname.startsWith('/login') ||
    pathname.startsWith('/reg/') ||
    pathname.startsWith('/reg') ||
    pathname.startsWith('/control') ||
    pathname.startsWith('/w/') ||
    pathname.startsWith('/opros/') ||
    pathname.startsWith('/survey/') ||
    pathname.startsWith('/lists/public/') ||
    pathname.startsWith('/qr-confirm')
  );
}

function OnboardingWrapper() {
  const { isAuthenticated } = useAuth();
  const { pathname } = useLocation();
  if (!isAuthenticated) return null;
  if (isPublicPath(pathname)) return null;
  return <Suspense fallback={null}><Onboarding /></Suspense>;
}

function CommandPaletteWrapper() {
  return (
    <ErrorBoundary>
      <Suspense fallback={null}>
        <CommandPalette />
      </Suspense>
    </ErrorBoundary>
  );
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
          <CommandPaletteWrapper />
          <OnboardingWrapper />
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
