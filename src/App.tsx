
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { ClaimsList } from './pages/ClaimsList';
import { Notifications } from './pages/Notifications';
import { Reports } from './pages/Reports';
import { ErrorBoundary } from './components/ErrorBoundary';

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/claims/detail/:id" element={<ClaimsList />} />
          <Route path="/claims" element={<ClaimsList />} />
          <Route path="/claims/:type" element={<ClaimsList />} />
          <Route path="/claims/:type/:id" element={<ClaimsList />} />
          <Route path="/" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}