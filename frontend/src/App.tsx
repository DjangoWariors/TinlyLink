import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { TeamProvider } from '@/contexts/TeamContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageLoading } from '@/components/common';

// Pages - Public
import { LoginPage } from '@/pages/Login';
import { RegisterPage } from '@/pages/Register';
import { ForgotPasswordPage } from '@/pages/ForgotPassword';
import { ResetPasswordPage } from '@/pages/ResetPassword';
import { VerifyEmailPage } from '@/pages/VerifyEmail';

import { NotFoundPage } from '@/pages/NotFound';

// Pages - Dashboard
import { DashboardPage } from '@/pages/Dashboard';
import { LinksPage } from '@/pages/Links';
import { CreateLinkPage } from '@/pages/CreateLink';
import { LinkDetailPage } from '@/pages/LinkDetail';
import { LinkQRPage } from '@/pages/LinkQR';
import { QRCodesPage } from '@/pages/QRCodes';
import { CreateQRCodePage } from '@/pages/CreateQRCode';
import { EditQRCodePage } from '@/pages/EditQRCode';
import { AnalyticsPage } from '@/pages/Analytics';
import { CampaignsPage } from '@/pages/Campaigns';
import { CampaignDetailPage } from '@/pages/CampaignDetail';
import { UTMBuilderPage } from '@/pages/UTMBuilder';
import { CustomDomainsPage } from '@/pages/CustomDomains';
import { APIKeysPage } from '@/pages/APIKeys';
import { SettingsPage } from '@/pages/Settings';
import { AcceptInvitePage } from '@/pages/AcceptInvite';
import { TeamSettingsPage } from '@/pages/TeamSettings';
import { RulesPage } from '@/pages/Rules';
import { RuleBuilderPage } from '@/pages/RuleBuilder';
import { SerialBatchesPage } from '@/pages/SerialBatches';
import { CreateSerialBatchPage } from '@/pages/CreateSerialBatch';
import { SerialBatchDetailPage } from '@/pages/SerialBatchDetail';
import { VerifyPage } from '@/pages/Verify';

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

// Protected Route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <PageLoading />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

// Public Route wrapper (redirect if already logged in)
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <PageLoading />;
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public Routes */}

      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicRoute>
            <RegisterPage />
          </PublicRoute>
        }
      />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/invite/:token" element={<AcceptInvitePage />} />
      <Route path="/verify" element={<VerifyPage />} />

      {/* Dashboard Routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="links" element={<LinksPage />} />
        <Route path="links/new" element={<CreateLinkPage />} />
        <Route path="links/:id" element={<LinkDetailPage />} />
        <Route path="links/:id/edit" element={<CreateLinkPage />} />
        <Route path="links/:id/qr" element={<LinkQRPage />} />
        <Route path="qr-codes" element={<QRCodesPage />} />
        <Route path="qr-codes/new" element={<CreateQRCodePage />} />
        <Route path="qr-codes/:id/edit" element={<EditQRCodePage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="campaigns" element={<CampaignsPage />} />
        <Route path="campaigns/:id" element={<CampaignDetailPage />} />
        <Route path="campaigns/:id/edit" element={<CampaignsPage />} />
        <Route path="rules" element={<RulesPage />} />
        <Route path="rules/new" element={<RuleBuilderPage />} />
        <Route path="rules/:id/edit" element={<RuleBuilderPage />} />
        <Route path="serial-batches" element={<SerialBatchesPage />} />
        <Route path="serial-batches/new" element={<CreateSerialBatchPage />} />
        <Route path="serial-batches/:id" element={<SerialBatchDetailPage />} />
        <Route path="utm-builder" element={<UTMBuilderPage />} />
        <Route path="domains" element={<CustomDomainsPage />} />
        <Route path="api-keys" element={<APIKeysPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="settings/billing" element={<SettingsPage />} />
        <Route path="team-settings" element={<TeamSettingsPage />} />
      </Route>

      {/* 404 */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <TeamProvider>
            <AppRoutes />
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: '#fff',
                  color: '#111827',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                },
                success: {
                  iconTheme: {
                    primary: '#059669',
                    secondary: '#fff',
                  },
                },
                error: {
                  iconTheme: {
                    primary: '#dc2626',
                    secondary: '#fff',
                  },
                },
              }}
            />
          </TeamProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
