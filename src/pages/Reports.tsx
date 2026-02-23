import { useState, type KeyboardEvent } from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import { RevenueLeak } from '../components/reports/RevenueLeak';
import { ARAgingReport } from '../components/reports/ARAgingReport';
import { DenialAnalysisReport } from '../components/reports/DenialAnalysisReport';
import { PayerPerformanceReport } from '../components/reports/PayerPerformanceReport';
import { CleanClaimRateReport } from '../components/reports/CleanClaimRateReport';
import { DataImport } from '../components/reports/DataImport';

const TABS = [
  { id: 'revenue', label: 'Revenue Leakage' },
  { id: 'aging', label: 'A/R Aging' },
  { id: 'denials', label: 'Denial Analysis' },
  { id: 'payer', label: 'Payer Performance' },
  { id: 'clean', label: 'Clean Claim Rate' },
  { id: 'import', label: 'Data Import' },
] as const;

type TabId = typeof TABS[number]['id'];

export function Reports() {
  const [activeTab, setActiveTab] = useState<TabId>('revenue');

  function focusTabByIndex(index: number) {
    const wrappedIndex = (index + TABS.length) % TABS.length;
    const nextTab = TABS[wrappedIndex];
    setActiveTab(nextTab.id);
    requestAnimationFrame(() => {
      document.getElementById(`report-tab-${nextTab.id}`)?.focus();
    });
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      focusTabByIndex(index + 1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      focusTabByIndex(index - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      focusTabByIndex(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      focusTabByIndex(TABS.length - 1);
    }
  }

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-4">Reports</h1>
        <div className="border-b border-gray-200">
          <nav className="flex space-x-4 overflow-x-auto" aria-label="Report tabs" role="tablist">
            {TABS.map((tab, index) => (
              <button
                key={tab.id}
                id={`report-tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
                className={`py-2 px-3 text-sm font-medium border-b-2 whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-controls={`report-panel-${tab.id}`}
                tabIndex={activeTab === tab.id ? 0 : -1}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <div role="tabpanel" id={`report-panel-${activeTab}`} aria-labelledby={`report-tab-${activeTab}`} tabIndex={0}>
        {activeTab === 'revenue' && <RevenueLeak />}
        {activeTab === 'aging' && <ARAgingReport />}
        {activeTab === 'denials' && <DenialAnalysisReport />}
        {activeTab === 'payer' && <PayerPerformanceReport />}
        {activeTab === 'clean' && <CleanClaimRateReport />}
        {activeTab === 'import' && <DataImport />}
      </div>
    </DashboardLayout>
  );
}
