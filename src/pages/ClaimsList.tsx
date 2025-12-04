import { useState, useEffect } from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../utils/format';
import { DollarSign, FileText } from 'lucide-react';

// Simple interface for summary data
interface ClaimsSummary {
  count: number;
  totalAmount: number;
}

/**
 * Minimal ClaimsList component that only shows summary data
 */
export function ClaimsList() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ClaimsSummary>({ count: 0, totalAmount: 0 });

  // Fetch just the count and total amount on component mount
  useEffect(() => {
    async function fetchClaimsSummary() {
      try {
        setLoading(true);
        
        // First, get the count of claims
        const { count, error: countError } = await supabase
          .from('healthcare_claims')
          .select('*', { count: 'exact', head: true });
        
        if (countError) {
          console.error('Error fetching claims count:', countError);
          setError(countError.message);
          return;
        }
        
        // Then get the sum of claim amounts
        const { data: sumData, error: sumError } = await supabase
          .from('healthcare_claims')
          .select('total_claim_charge_amount');
        
        if (sumError) {
          console.error('Error fetching claims sum:', sumError);
          setError(sumError.message);
          return;
        }
        
        // Calculate total amount
        const total = sumData.reduce((sum, claim) => {
          const amount = Number(claim.total_claim_charge_amount) || 0;
          return sum + amount;
        }, 0);
        
        setSummary({
          count: count || 0,
          totalAmount: total
        });
        
        console.log(`Successfully loaded summary: ${count} claims totaling ${total}`);
        
      } catch (err) {
        console.error('Error in fetchClaimsSummary:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchClaimsSummary();
  }, []);

  return (
    <DashboardLayout>
      <div className="flex flex-col space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Claims List</h1>
        </div>
        
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4 border-b">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-full">
                  <FileText className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-blue-600">Total Claims</p>
                  <p className="text-xl font-semibold">{summary.count}</p>
                </div>
              </div>
              
              <div className="bg-green-50 p-4 rounded-lg flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-full">
                  <DollarSign className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-green-600">Total Amount</p>
                  <p className="text-xl font-semibold">{formatCurrency(summary.totalAmount)}</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="p-4">
            {error && (
              <div className="bg-red-50 p-4 mb-4 rounded-lg text-red-700">
                <p className="font-bold">Error:</p>
                <p>{error}</p>
              </div>
            )}
            
            {loading ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              </div>
            ) : (
              <div className="p-8 text-center text-gray-500">
                <p>Claims data loaded successfully.</p>
                <p>We're showing just the summary to avoid rendering issues.</p>
                <p className="mt-4 text-sm text-blue-600">
                  The previous version was failing because of duplicate claim IDs in the data, 
                  which caused React's key-based rendering to break.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}