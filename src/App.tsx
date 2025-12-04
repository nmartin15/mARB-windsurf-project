import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard';
import { ClaimsList } from './pages/MinimalClaimsList';
import { Notifications } from './pages/Notifications';
import { Reports } from './pages/Reports';
import { MessageThreadsList } from './components/messaging/MessageThreadsList';
import { ThreadView } from './components/messaging/ThreadView';
import { DashboardLayout } from './components/DashboardLayout';
import { initMessagingTableFixes } from './lib/messagingTableFixes'; // Import the init function

export default function App() {
  // Initialize messaging table fixes when the app starts
  useEffect(() => {
    // Initialize the messaging table fixes
    initMessagingTableFixes().catch(error => {
      console.error('Failed to initialize messaging table fixes:', error);
    });
    
    console.log('Messaging table fixes initialized');
  }, []);

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
        <Route path="/messages" element={<DashboardLayout><MessageThreadsList /></DashboardLayout>} />
        <Route path="/messages/:threadId" element={<DashboardLayout><ThreadView /></DashboardLayout>} />
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}