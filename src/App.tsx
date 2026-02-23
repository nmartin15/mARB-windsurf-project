import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard';
import { ClaimsList } from './pages/ClaimsList';
import { Notifications } from './pages/Notifications';
import { Reports } from './pages/Reports';
import { MessageThreadsList } from './components/messaging/MessageThreadsList';
import { ThreadView } from './components/messaging/ThreadView';
import { DashboardLayout } from './components/DashboardLayout';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/claims" element={<ClaimsList />} />
        <Route path="/claims/:type/:id" element={<ClaimsList />} />
        <Route path="/claims/detail/:id" element={<ClaimsList />} />
        <Route path="/messages" element={<DashboardLayout><MessageThreadsList /></DashboardLayout>} />
        <Route path="/messages/:threadId" element={<DashboardLayout><ThreadView /></DashboardLayout>} />
        <Route path="/login" element={<Navigate to="/dashboard" replace />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
