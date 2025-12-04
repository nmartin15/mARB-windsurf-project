import React from 'react';
import { format } from 'date-fns';
import { formatCurrency } from '../utils/format';
import { FileText, Calendar, Clock, DollarSign, Building, Activity } from 'lucide-react';
import type { HealthcareClaim } from '../types';

/**
 * Props for the ClaimDetails component
 */
interface ClaimDetailsProps {
  claim: HealthcareClaim;
}

/**
 * ClaimDetails component - displays detailed information about a healthcare claim
 * 
 * @param {ClaimDetailsProps} props - Component props containing the claim data
 * @returns {JSX.Element} Rendered component
 */
export function ClaimDetails({ claim }: ClaimDetailsProps): JSX.Element {
  /**
   * Renders a detail item with an icon and content
   * 
   * @param {React.ReactNode} icon - Icon component to display
   * @param {string} label - Label for the detail
   * @param {string} value - Primary value to display
   * @param {string} [subValue] - Optional secondary/code value
   * @returns {JSX.Element} Rendered detail item
   */
  const renderDetailItem = (
    icon: React.ReactNode,
    label: string,
    value: string | number | null | undefined,
    subValue?: string | number | null
  ): JSX.Element => {
    const displayValue = value || 'Not specified';
    
    return (
      <div className="flex items-start">
        {icon}
        <div>
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className="mt-1">{displayValue}</p>
          {subValue && <p className="text-xs text-gray-500">Code: {subValue}</p>}
        </div>
      </div>
    );
  };

  /**
   * Formats a date string for display
   * 
   * @param {string} dateString - ISO date string
   * @returns {string} Formatted date
   */
  const formatDate = (dateString: string): string => {
    try {
      return format(new Date(dateString), 'MMM d, yyyy HH:mm');
    } catch (error) {
      console.error('Error formatting date:', error);
      return dateString || 'Unknown';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm">
      {/* Header section with claim ID and status */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900">
            Claim #{claim.claim_id}
          </h2>
          <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
            {claim.claim_frequency_type_desc || 'Processing'}
          </span>
        </div>
      </div>
      
      {/* Main content section */}
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left column - Facility and Admission details */}
          <div className="space-y-6">
            {/* Facility Information section */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Facility Information</h3>
              <div className="space-y-4">
                {renderDetailItem(
                  <Building className="h-5 w-5 text-gray-400 mt-1 mr-3" />,
                  'Facility Type',
                  claim.facility_type_desc,
                  claim.facility_type_code
                )}
                
                {renderDetailItem(
                  <Calendar className="h-5 w-5 text-gray-400 mt-1 mr-3" />,
                  'Service Period',
                  `${claim.service_date_start} - ${claim.service_date_end}`
                )}

                {renderDetailItem(
                  <Activity className="h-5 w-5 text-gray-400 mt-1 mr-3" />,
                  'Facility Qualifier',
                  claim.facility_code_qualifier_desc,
                  claim.facility_code_qualifier
                )}
              </div>
            </div>

            {/* Admission Details section */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Admission Details</h3>
              <div className="space-y-4">
                {claim.admission_type_desc && renderDetailItem(
                  <FileText className="h-5 w-5 text-gray-400 mt-1 mr-3" />,
                  'Admission Type',
                  claim.admission_type_desc,
                  claim.admission_type_code
                )}

                {claim.admission_source_desc && renderDetailItem(
                  <FileText className="h-5 w-5 text-gray-400 mt-1 mr-3" />,
                  'Admission Source',
                  claim.admission_source_desc,
                  claim.admission_source_code
                )}

                {claim.patient_status_desc && renderDetailItem(
                  <FileText className="h-5 w-5 text-gray-400 mt-1 mr-3" />,
                  'Patient Status',
                  claim.patient_status_desc,
                  claim.patient_status_code
                )}
              </div>
            </div>
          </div>

          {/* Right column - Claim Information */}
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Claim Information</h3>
              <div className="space-y-4">
                {/* Special case for the charge amount to make it more prominent */}
                <div className="flex items-start">
                  <DollarSign className="h-5 w-5 text-gray-400 mt-1 mr-3" />
                  <div>
                    <p className="text-sm font-medium text-gray-500">Total Charge Amount</p>
                    <p className="mt-1 text-lg font-semibold">
                      {formatCurrency(claim.total_claim_charge_amount)}
                    </p>
                  </div>
                </div>

                {renderDetailItem(
                  <FileText className="h-5 w-5 text-gray-400 mt-1 mr-3" />,
                  'Filing Indicator',
                  claim.claim_filing_indicator_desc,
                  claim.claim_filing_indicator_code
                )}

                {renderDetailItem(
                  <FileText className="h-5 w-5 text-gray-400 mt-1 mr-3" />,
                  'Benefits Assignment',
                  claim.benefits_assignment_desc,
                  claim.benefits_assignment
                )}

                {renderDetailItem(
                  <Clock className="h-5 w-5 text-gray-400 mt-1 mr-3" />,
                  'Last Updated',
                  formatDate(claim.updated_at)
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}