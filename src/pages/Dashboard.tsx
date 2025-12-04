import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../components/DashboardLayout';
import { MetricCard } from '../components/MetricCard';
import { PaymentVelocityChart } from '../components/PaymentVelocityChart';
import { TrendAnalysisChart } from '../components/TrendAnalysisChart';
import { FilingIndicatorChart } from '../components/FilingIndicatorChart';
import { formatCurrency, formatDate } from '../utils/format';
import type { HealthcareClaim } from '../types';
import { FileText, DollarSign, TrendingUp, Filter } from 'lucide-react';
import { supabase, safeQuery } from '../lib/supabase';

/**
 * Summary data for each filing indicator category
 */
interface FilingIndicatorSummary {
  originalName: string;
  displayName: string;
  count: number;
  total_amount: number;
  average_amount: number;
}

/**
 * Main dashboard data structure
 */
type DashboardData = {
  totalAmount: number;
  avgClaimAmount: number;
  totalClaims: number;
  filingIndicators: FilingIndicatorSummary[];
  recentClaims: HealthcareClaim[];
}

/**
 * Data structure for payment velocity chart
 */
interface VelocityData {
  month: string;
  amount: number;
  disputes_closed?: number;
  days_to_payment?: number;
}

/**
 * Data structure for trend analysis chart
 */
interface TrendData {
  range: string;
  count: number;
  avgDays?: number;
}

/**
 * Dashboard component - displays overview metrics, charts, and recent claims
 */
export function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState('3M');
  const [data, setData] = useState<DashboardData>({
    totalAmount: 0,
    avgClaimAmount: 0,
    totalClaims: 0,
    filingIndicators: [],
    recentClaims: []
  });
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [velocityData, setVelocityData] = useState<VelocityData[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);

  /**
   * Generates mock velocity data when API call fails
   */
  const generateMockVelocityData = useCallback(() => {
    const mockData: VelocityData[] = [
      { month: 'Jan', disputes_closed: 45, days_to_payment: 12, amount: 24500 },
      { month: 'Feb', disputes_closed: 52, days_to_payment: 10, amount: 28700 },
      { month: 'Mar', disputes_closed: 49, days_to_payment: 11, amount: 25800 },
      { month: 'Apr', disputes_closed: 63, days_to_payment: 9, amount: 32400 },
      { month: 'May', disputes_closed: 58, days_to_payment: 8, amount: 30200 }
    ];
    
    setVelocityData(mockData);
  }, []);

  /**
   * Generates mock trend data when API call fails
   */
  const generateMockTrendData = useCallback(() => {
    const mockData: TrendData[] = [
      { range: '0-30', count: 45, avgDays: 15 },
      { range: '31-60', count: 32, avgDays: 45 },
      { range: '61-90', count: 18, avgDays: 75 },
      { range: '91+', count: 12, avgDays: 105 }
    ];
    
    setTrendData(mockData);
  }, []);

  /**
   * Fetches dashboard data including recent claims and summary metrics
   */
  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch recent claims
      const { data: claimsData, error: claimsError } = await safeQuery<HealthcareClaim[]>(async () => 
        await supabase
          .from('healthcare_claims')
          .select('*, claim_filing_indicator_code, claim_filing_indicator_desc')
          .order('created_at', { ascending: false })
          .limit(5)
      );
      
      if (claimsError) {
        console.error('Error fetching recent claims:', claimsError);
        throw claimsError;
      }
      
      // Log claims data for debugging
      console.log('Recent claims data:', claimsData);

      // Group claims by filing indicator for the insurance type chart
      const filingIndicatorMap: Record<string, FilingIndicatorSummary> = {};
      
      if (claimsData && claimsData.length > 0) {
        const totalAmount = claimsData.reduce((sum, claim) => 
          sum + Number(claim.total_claim_charge_amount || 0), 0);
        const totalClaims = claimsData.length;
        
        // Process claims data
        claimsData.forEach(claim => {
          // Group by filing indicator (insurance type)
          const code = claim.claim_filing_indicator_code || 'UNK';
          const displayName = claim.claim_filing_indicator_desc || 'Unknown';
          
          if (!filingIndicatorMap[code]) {
            filingIndicatorMap[code] = {
              originalName: code,
              displayName: displayName,
              count: 0,
              total_amount: 0,
              average_amount: 0
            };
          }
          
          filingIndicatorMap[code].count++;
          filingIndicatorMap[code].total_amount += Number(claim.total_claim_charge_amount || 0);
        });
        
        // Calculate averages for each filing indicator
        Object.values(filingIndicatorMap).forEach(indicator => {
          indicator.average_amount = indicator.total_amount / indicator.count;
        });
        
        // Set the real data
        setData({
          totalAmount: totalAmount,
          avgClaimAmount: totalAmount / totalClaims,
          totalClaims: totalClaims,
          filingIndicators: Object.values(filingIndicatorMap),
          recentClaims: claimsData
        });
        
        console.log('Dashboard data set successfully:', {
          totalAmount,
          avgClaimAmount: totalAmount / totalClaims,
          totalClaims,
          filingIndicators: Object.values(filingIndicatorMap)
        });
      } else {
        console.warn('No claims data found, using mock data');
        
        // If no data, fall back to mock data
        const mockClaims: HealthcareClaim[] = [
          {
            id: 1,
            claim_id: 'CL-2025-001',
            patient_id: 'PT12345',
            total_claim_charge_amount: 1500.00,
            facility_type_code: '11',
            facility_type_desc: 'Hospital',
            facility_code_qualifier: 'A',
            facility_code_qualifier_desc: 'National Provider',
            claim_frequency_type_code: '1',
            claim_frequency_type_desc: 'Original',
            service_date_start: '2025-03-15',
            service_date_end: '2025-03-15',
            admission_type_code: '1',
            admission_type_desc: 'Emergency',
            admission_source_code: '7',
            admission_source_desc: 'Emergency Room',
            patient_status_code: '01',
            patient_status_desc: 'Discharged Home',
            claim_filing_indicator_code: 'MC',
            claim_filing_indicator_desc: 'Medicare',
            assignment_code: 'Y',
            assignment_desc: 'Yes',
            benefits_assignment: 'Y',
            benefits_assignment_desc: 'Yes',
            claim_status: 'Approved',
            billing_code: 'MC-2025-001',
            created_at: '2025-03-15T12:00:00Z',
            updated_at: '2025-03-15T12:00:00Z'
          },
          {
            id: 2,
            claim_id: 'CL-2025-002',
            patient_id: 'PT23456',
            total_claim_charge_amount: 2500.00,
            facility_type_code: '11',
            facility_type_desc: 'Hospital',
            facility_code_qualifier: 'A',
            facility_code_qualifier_desc: 'National Provider',
            claim_frequency_type_code: '1',
            claim_frequency_type_desc: 'Original',
            service_date_start: '2025-03-14',
            service_date_end: '2025-03-14',
            admission_type_code: '1',
            admission_type_desc: 'Emergency',
            admission_source_code: '7',
            admission_source_desc: 'Emergency Room',
            patient_status_code: '01',
            patient_status_desc: 'Discharged Home',
            claim_filing_indicator_code: 'BL',
            claim_filing_indicator_desc: 'Blue Cross/Blue Shield',
            assignment_code: 'Y',
            assignment_desc: 'Yes',
            benefits_assignment: 'Y',
            benefits_assignment_desc: 'Yes',
            claim_status: 'Pending',
            billing_code: 'BL-2025-002',
            created_at: '2025-03-14T12:00:00Z',
            updated_at: '2025-03-14T12:00:00Z'
          },
          {
            id: 3,
            claim_id: 'CL-2025-003',
            patient_id: 'PT34567',
            total_claim_charge_amount: 1200.00,
            facility_type_code: '11',
            facility_type_desc: 'Hospital',
            facility_code_qualifier: 'A',
            facility_code_qualifier_desc: 'National Provider',
            claim_frequency_type_code: '1',
            claim_frequency_type_desc: 'Original',
            service_date_start: '2025-03-13',
            service_date_end: '2025-03-13',
            admission_type_code: '1',
            admission_type_desc: 'Emergency',
            admission_source_code: '7',
            admission_source_desc: 'Emergency Room',
            patient_status_code: '01',
            patient_status_desc: 'Discharged Home',
            claim_filing_indicator_code: 'CI',
            claim_filing_indicator_desc: 'Commercial Insurance',
            assignment_code: 'Y',
            assignment_desc: 'Yes',
            benefits_assignment: 'Y',
            benefits_assignment_desc: 'Yes',
            claim_status: 'Denied',
            billing_code: 'CI-2025-003',
            created_at: '2025-03-13T12:00:00Z',
            updated_at: '2025-03-13T12:00:00Z'
          },
          {
            id: 4,
            claim_id: 'CL-2025-004',
            patient_id: 'PT45678',
            total_claim_charge_amount: 3200.00,
            facility_type_code: '11',
            facility_type_desc: 'Hospital',
            facility_code_qualifier: 'A',
            facility_code_qualifier_desc: 'National Provider',
            claim_frequency_type_code: '1',
            claim_frequency_type_desc: 'Original',
            service_date_start: '2025-03-12',
            service_date_end: '2025-03-12',
            admission_type_code: '1',
            admission_type_desc: 'Emergency',
            admission_source_code: '7',
            admission_source_desc: 'Emergency Room',
            patient_status_code: '01',
            patient_status_desc: 'Discharged Home',
            claim_filing_indicator_code: 'MC',
            claim_filing_indicator_desc: 'Medicare',
            assignment_code: 'Y',
            assignment_desc: 'Yes',
            benefits_assignment: 'Y',
            benefits_assignment_desc: 'Yes',
            claim_status: 'Approved',
            billing_code: 'MC-2025-004',
            created_at: '2025-03-12T12:00:00Z',
            updated_at: '2025-03-12T12:00:00Z'
          },
          {
            id: 5,
            claim_id: 'CL-2025-005',
            patient_id: 'PT56789',
            total_claim_charge_amount: 1800.00,
            facility_type_code: '11',
            facility_type_desc: 'Hospital',
            facility_code_qualifier: 'A',
            facility_code_qualifier_desc: 'National Provider',
            claim_frequency_type_code: '1',
            claim_frequency_type_desc: 'Original',
            service_date_start: '2025-03-11',
            service_date_end: '2025-03-11',
            admission_type_code: '1',
            admission_type_desc: 'Emergency',
            admission_source_code: '7',
            admission_source_desc: 'Emergency Room',
            patient_status_code: '01',
            patient_status_desc: 'Discharged Home',
            claim_filing_indicator_code: 'BL',
            claim_filing_indicator_desc: 'Blue Cross/Blue Shield',
            assignment_code: 'Y',
            assignment_desc: 'Yes',
            benefits_assignment: 'Y',
            benefits_assignment_desc: 'Yes',
            claim_status: 'In Process',
            billing_code: 'BL-2025-005',
            created_at: '2025-03-11T12:00:00Z',
            updated_at: '2025-03-11T12:00:00Z'
          }
        ];
        
        // Mock filing indicator data
        const mockFilingIndicators: FilingIndicatorSummary[] = [
          {
            originalName: 'MC',
            displayName: 'Medicare',
            count: 45,
            total_amount: 78500,
            average_amount: 1744.44
          },
          {
            originalName: 'BL',
            displayName: 'Blue Cross/Blue Shield',
            count: 32,
            total_amount: 64000,
            average_amount: 2000
          },
          {
            originalName: 'CI',
            displayName: 'Commercial Insurance',
            count: 28,
            total_amount: 56000,
            average_amount: 2000
          },
          {
            originalName: 'MD',
            displayName: 'Medicaid',
            count: 18,
            total_amount: 27000,
            average_amount: 1500
          },
          {
            originalName: 'SP',
            displayName: 'Self-Pay',
            count: 12,
            total_amount: 24000,
            average_amount: 2000
          }
        ];
        
        // Set mock data
        setData({
          totalAmount: 250000,
          avgClaimAmount: 2200,
          totalClaims: 1250,
          filingIndicators: mockFilingIndicators,
          recentClaims: mockClaims
        });
      }
    } catch (error) {
      console.error('Error in fetchDashboardData:', error);
      setError('Failed to fetch dashboard data. Using sample data instead.');
      // Fall back to mock data
      const mockClaims: HealthcareClaim[] = [
        {
          id: 1,
          claim_id: 'CL-2025-001',
          patient_id: 'PT12345',
          total_claim_charge_amount: 1500.00,
          facility_type_code: '11',
          facility_type_desc: 'Hospital',
          facility_code_qualifier: 'A',
          facility_code_qualifier_desc: 'National Provider',
          claim_frequency_type_code: '1',
          claim_frequency_type_desc: 'Original',
          service_date_start: '2025-03-15',
          service_date_end: '2025-03-15',
          admission_type_code: '1',
          admission_type_desc: 'Emergency',
          admission_source_code: '7',
          admission_source_desc: 'Emergency Room',
          patient_status_code: '01',
          patient_status_desc: 'Discharged Home',
          claim_filing_indicator_code: 'MC',
          claim_filing_indicator_desc: 'Medicare',
          assignment_code: 'Y',
          assignment_desc: 'Yes',
          benefits_assignment: 'Y',
          benefits_assignment_desc: 'Yes',
          claim_status: 'Approved',
          billing_code: 'MC-2025-001',
          created_at: '2025-03-15T12:00:00Z',
          updated_at: '2025-03-15T12:00:00Z'
        },
        {
          id: 2,
          claim_id: 'CL-2025-002',
          patient_id: 'PT23456',
          total_claim_charge_amount: 2500.00,
          facility_type_code: '11',
          facility_type_desc: 'Hospital',
          facility_code_qualifier: 'A',
          facility_code_qualifier_desc: 'National Provider',
          claim_frequency_type_code: '1',
          claim_frequency_type_desc: 'Original',
          service_date_start: '2025-03-14',
          service_date_end: '2025-03-14',
          admission_type_code: '1',
          admission_type_desc: 'Emergency',
          admission_source_code: '7',
          admission_source_desc: 'Emergency Room',
          patient_status_code: '01',
          patient_status_desc: 'Discharged Home',
          claim_filing_indicator_code: 'BL',
          claim_filing_indicator_desc: 'Blue Cross/Blue Shield',
          assignment_code: 'Y',
          assignment_desc: 'Yes',
          benefits_assignment: 'Y',
          benefits_assignment_desc: 'Yes',
          claim_status: 'Pending',
          billing_code: 'BL-2025-002',
          created_at: '2025-03-14T12:00:00Z',
          updated_at: '2025-03-14T12:00:00Z'
        },
        {
          id: 3,
          claim_id: 'CL-2025-003',
          patient_id: 'PT34567',
          total_claim_charge_amount: 1200.00,
          facility_type_code: '11',
          facility_type_desc: 'Hospital',
          facility_code_qualifier: 'A',
          facility_code_qualifier_desc: 'National Provider',
          claim_frequency_type_code: '1',
          claim_frequency_type_desc: 'Original',
          service_date_start: '2025-03-13',
          service_date_end: '2025-03-13',
          admission_type_code: '1',
          admission_type_desc: 'Emergency',
          admission_source_code: '7',
          admission_source_desc: 'Emergency Room',
          patient_status_code: '01',
          patient_status_desc: 'Discharged Home',
          claim_filing_indicator_code: 'CI',
          claim_filing_indicator_desc: 'Commercial Insurance',
          assignment_code: 'Y',
          assignment_desc: 'Yes',
          benefits_assignment: 'Y',
          benefits_assignment_desc: 'Yes',
          claim_status: 'Denied',
          billing_code: 'CI-2025-003',
          created_at: '2025-03-13T12:00:00Z',
          updated_at: '2025-03-13T12:00:00Z'
        },
        {
          id: 4,
          claim_id: 'CL-2025-004',
          patient_id: 'PT45678',
          total_claim_charge_amount: 3200.00,
          facility_type_code: '11',
          facility_type_desc: 'Hospital',
          facility_code_qualifier: 'A',
          facility_code_qualifier_desc: 'National Provider',
          claim_frequency_type_code: '1',
          claim_frequency_type_desc: 'Original',
          service_date_start: '2025-03-12',
          service_date_end: '2025-03-12',
          admission_type_code: '1',
          admission_type_desc: 'Emergency',
          admission_source_code: '7',
          admission_source_desc: 'Emergency Room',
          patient_status_code: '01',
          patient_status_desc: 'Discharged Home',
          claim_filing_indicator_code: 'MC',
          claim_filing_indicator_desc: 'Medicare',
          assignment_code: 'Y',
          assignment_desc: 'Yes',
          benefits_assignment: 'Y',
          benefits_assignment_desc: 'Yes',
          claim_status: 'Approved',
          billing_code: 'MC-2025-004',
          created_at: '2025-03-12T12:00:00Z',
          updated_at: '2025-03-12T12:00:00Z'
        },
        {
          id: 5,
          claim_id: 'CL-2025-005',
          patient_id: 'PT56789',
          total_claim_charge_amount: 1800.00,
          facility_type_code: '11',
          facility_type_desc: 'Hospital',
          facility_code_qualifier: 'A',
          facility_code_qualifier_desc: 'National Provider',
          claim_frequency_type_code: '1',
          claim_frequency_type_desc: 'Original',
          service_date_start: '2025-03-11',
          service_date_end: '2025-03-11',
          admission_type_code: '1',
          admission_type_desc: 'Emergency',
          admission_source_code: '7',
          admission_source_desc: 'Emergency Room',
          patient_status_code: '01',
          patient_status_desc: 'Discharged Home',
          claim_filing_indicator_code: 'BL',
          claim_filing_indicator_desc: 'Blue Cross/Blue Shield',
          assignment_code: 'Y',
          assignment_desc: 'Yes',
          benefits_assignment: 'Y',
          benefits_assignment_desc: 'Yes',
          claim_status: 'In Process',
          billing_code: 'BL-2025-005',
          created_at: '2025-03-11T12:00:00Z',
          updated_at: '2025-03-11T12:00:00Z'
        }
      ];
      
      // Mock filing indicator data
      const mockFilingIndicators: FilingIndicatorSummary[] = [
        {
          originalName: 'MC',
          displayName: 'Medicare',
          count: 45,
          total_amount: 78500,
          average_amount: 1744.44
        },
        {
          originalName: 'BL',
          displayName: 'Blue Cross/Blue Shield',
          count: 32,
          total_amount: 64000,
          average_amount: 2000
        },
        {
          originalName: 'CI',
          displayName: 'Commercial Insurance',
          count: 28,
          total_amount: 56000,
          average_amount: 2000
        },
        {
          originalName: 'MD',
          displayName: 'Medicaid',
          count: 18,
          total_amount: 27000,
          average_amount: 1500
        },
        {
          originalName: 'SP',
          displayName: 'Self-Pay',
          count: 12,
          total_amount: 24000,
          average_amount: 2000
        }
      ];
      
      // Set mock data
      setData({
        totalAmount: 250000,
        avgClaimAmount: 2200,
        totalClaims: 1250,
        filingIndicators: mockFilingIndicators,
        recentClaims: mockClaims
      });
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Fetches payment velocity data for the selected time period
   */
  const fetchVelocityData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Call the payment_velocity function in Supabase
      const { data: velocityData, error: velocityError } = await safeQuery<VelocityData[]>(async () => 
        await supabase.rpc('get_payment_velocity', { 
          period: selectedPeriod 
        })
      );
      
      if (velocityError) {
        console.error('Error fetching payment velocity data:', velocityError);
        throw velocityError;
      }
      
      console.log('Payment velocity data:', velocityData);
      
      if (velocityData && velocityData.length > 0) {
        setVelocityData(velocityData);
      } else {
        // Fall back to mock data if no results
        generateMockVelocityData();
      }
    } catch (error) {
      console.error('Error in fetchVelocityData:', error);
      setError('Failed to fetch payment velocity data. Using sample data instead.');
      // Fall back to mock data if there's an error
      generateMockVelocityData();
    } finally {
      setLoading(false);
    }
  }, [selectedPeriod, generateMockVelocityData]);

  /**
   * Fetches trend analysis data for the selected time period
   */
  const fetchTrendData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Call the get_trend_data function in Supabase
      const { data: trendResult, error } = await safeQuery<TrendData[]>(async () => 
        await supabase.rpc('get_trend_data', { 
          period: selectedPeriod
        })
      );
      
      if (error) {
        console.error('Error fetching trend data:', error);
        throw error;
      }
      
      console.log('Trend data:', trendResult);
      
      if (trendResult && trendResult.length > 0) {
        setTrendData(trendResult);
      } else {
        // Fall back to mock data if no results
        generateMockTrendData();
      }
    } catch (error) {
      console.error('Error in fetchTrendData:', error);
      setError('Failed to fetch trend data. Using sample data instead.');
      // Fall back to mock data if there's an error
      generateMockTrendData();
    } finally {
      setLoading(false);
    }
  }, [selectedPeriod, generateMockTrendData]);

  useEffect(() => {
    const fetchData = async () => {
      await fetchDashboardData();
      await fetchVelocityData();
      await fetchTrendData();
    };
    
    fetchData();
  }, [fetchDashboardData, fetchVelocityData, fetchTrendData]);

  /**
   * Handles period selection for data filtering
   */
  function handlePeriodChange(period: string) {
    setSelectedPeriod(period);
  }

  /**
   * Navigates to claim details page
   */
  function handleClaimClick(claimId: string) {
    navigate(`/claims/${claimId}`);
  }

  /**
   * Toggles filter panel
   */
  function toggleFilter() {
    setFilterOpen(!filterOpen);
  }

  return (
    <DashboardLayout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex items-center space-x-2">
          <div className="flex border rounded overflow-hidden">
            <button 
              className={`px-3 py-1 text-sm ${selectedPeriod === '1M' ? 'bg-blue-500 text-white' : 'bg-white'}`}
              onClick={() => handlePeriodChange('1M')}
            >
              1M
            </button>
            <button 
              className={`px-3 py-1 text-sm ${selectedPeriod === '3M' ? 'bg-blue-500 text-white' : 'bg-white'}`}
              onClick={() => handlePeriodChange('3M')}
            >
              3M
            </button>
            <button 
              className={`px-3 py-1 text-sm ${selectedPeriod === '6M' ? 'bg-blue-500 text-white' : 'bg-white'}`}
              onClick={() => handlePeriodChange('6M')}
            >
              6M
            </button>
            <button 
              className={`px-3 py-1 text-sm ${selectedPeriod === '1Y' ? 'bg-blue-500 text-white' : 'bg-white'}`}
              onClick={() => handlePeriodChange('1Y')}
            >
              1Y
            </button>
            <button 
              className={`px-3 py-1 text-sm ${selectedPeriod === 'ALL' ? 'bg-blue-500 text-white' : 'bg-white'}`}
              onClick={() => handlePeriodChange('ALL')}
            >
              ALL
            </button>
          </div>
          <button
            className="flex items-center px-3 py-1 text-sm border rounded"
            onClick={toggleFilter}
          >
            <Filter size={16} className="mr-1" />
            Filter
          </button>
        </div>
      </div>

      <>
        {error && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
            <div className="flex">
              <div className="ml-3">
                <p className="text-sm text-yellow-700">{error}</p>
              </div>
            </div>
          </div>
        )}
      </>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <MetricCard 
          title="Total Claims"
          value={data.totalClaims.toString()}
          icon={<FileText className="h-8 w-8 text-blue-500" />}
          trend={5.2}
        />
        <MetricCard 
          title="Total Amount"
          value={formatCurrency(data.totalAmount)}
          icon={<DollarSign className="h-8 w-8 text-green-500" />}
          trend={3.8}
        />
        <MetricCard 
          title="Average Claim"
          value={formatCurrency(data.avgClaimAmount)}
          icon={<TrendingUp className="h-8 w-8 text-amber-500" />}
          trend={-1.2}
        />
        <MetricCard 
          title="Approval Rate"
          value="78.5%"
          icon={<FileText className="h-8 w-8 text-purple-500" />}
          trend={2.1}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Claims by Insurance Type</h2>
          <FilingIndicatorChart data={data.filingIndicators} />
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Payment Velocity</h2>
          <PaymentVelocityChart data={velocityData} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Trend Analysis</h2>
          <TrendAnalysisChart data={trendData} />
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Recent Claims</h2>
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Claim ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Patient
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.recentClaims.map((claim) => (
                    <tr 
                      key={claim.id} 
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => handleClaimClick(claim.claim_id)}
                    >
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-blue-600">
                        {claim.billing_code || claim.claim_id}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {claim.patient_id}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(claim.service_date_start)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(claim.total_claim_charge_amount)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                          ${claim.claim_status === 'Approved' ? 'bg-green-100 text-green-800' : 
                            claim.claim_status === 'Denied' ? 'bg-red-100 text-red-800' : 
                            'bg-yellow-100 text-yellow-800'}`}>
                          {claim.claim_status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}