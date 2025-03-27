import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard';
import { ClaimsList } from './pages/MinimalClaimsList';
import { Notifications } from './pages/Notifications';
import { Reports } from './pages/Reports';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Dashboard />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/claims" element={<ClaimsList />} />
        <Route path="/claims/:type/:id" element={<ClaimsList />} />
        <Route path="/claims/detail/:id" element={<ClaimsList />} />
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}