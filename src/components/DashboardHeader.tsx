import React from 'react';
import { Bell, Settings } from 'lucide-react';

/**
 * DashboardHeader Component
 * Displays the header section of the dashboard with title and action buttons
 */
export function DashboardHeader() {
  return (
    <div className="flex justify-between items-center mb-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Healthcare Claims Dashboard</h1>
        <p className="text-gray-500">Overview of claims activity and performance metrics</p>
      </div>
      <div className="flex space-x-4">
        <button className="p-2 rounded-full hover:bg-gray-100">
          <Bell className="h-5 w-5 text-gray-600" />
        </button>
        <button className="p-2 rounded-full hover:bg-gray-100">
          <Settings className="h-5 w-5 text-gray-600" />
        </button>
      </div>
    </div>
  );
}
