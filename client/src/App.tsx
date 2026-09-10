import { BrowserRouter, Route, Routes, useParams, useNavigate } from 'react-router-dom';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { Header } from './components/layout/Header';
import { AuthProvider } from './context/AuthContext';
import { AccountPage } from './pages/AccountPage';
import { CVPage } from './pages/CVPage';
import { HomePage } from './pages/HomePage';
import { JobDetailPage } from './pages/JobDetailPage';
import { JobsPage } from './pages/JobsPage';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ProfilePage } from './pages/ProfilePage';
import { RegisterPage } from './pages/RegisterPage';
import { SettingsPage } from './pages/SettingsPage';
import { MatchPage } from './components/matching/MatchPage';

function JobMatchRoute() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  if (!id) return null;
  return <MatchPage jobId={id} onBack={() => navigate(`/jobs/${id}`)} />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
          <Header />
          <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <ProfilePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/cv"
                element={
                  <ProtectedRoute>
                    <CVPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/jobs"
                element={
                  <ProtectedRoute>
                    <JobsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/jobs/:id"
                element={
                  <ProtectedRoute>
                    <JobDetailPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/jobs/:id/match"
                element={
                  <ProtectedRoute>
                    <JobMatchRoute />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings"
                element={
                  <ProtectedRoute>
                    <SettingsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/account"
                element={
                  <ProtectedRoute>
                    <AccountPage />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}
