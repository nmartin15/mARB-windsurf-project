import React from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import { RevenueLeakReport } from '../components/reports/RevenueLeak';

export function Reports() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <RevenueLeakReport />
      </div>
    </DashboardLayout>
  );
}