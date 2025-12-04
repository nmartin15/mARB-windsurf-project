import React from 'react';
import { format } from 'date-fns';
import { formatCurrency } from '../utils/format';
import { FileText, Calendar, Clock, DollarSign, Building, Activity } from 'lucide-react';
import type { HealthcareClaim } from '../types';

interface ClaimDetailsProps {
  claim: HealthcareClaim;
}

export function ClaimDetails({ claim }: ClaimDetailsProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm">
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
      
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Facility Information</h3>
              <div className="space-y-4">
                <div className="flex items-start">
                  <Building className="h-5 w-5 text-gray-400 mt-1 mr-3" />
                  <div>
                    <p className="text-sm font-medium text-gray-500">Facility Type</p>
                    <p className="mt-1">{claim.facility_type_desc || 'Not specified'}</p>
                    <p className="text-xs text-gray-500">Code: {claim.facility_type_code}</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <Calendar className="h-5 w-5 text-gray-400 mt-1 mr-3" />
                  <div>
                    <p className="text-sm font-medium text-gray-500">Service Period</p>
                    <p className="mt-1">
                      {claim.service_date_start} - {claim.service_date_end}
                    </p>
                  </div>
                </div>

                <div className="flex items-start">
                  <Activity className="h-5 w-5 text-gray-400 mt-1 mr-3" />
                  <div>
                    <p className="text-sm font-medium text-gray-500">Facility Qualifier</p>
                    <p className="mt-1">{claim.facility_code_qualifier_desc || 'Not specified'}</p>
                    <p className="text-xs text-gray-500">Code: {claim.facility_code_qualifier}</p>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Admission Details</h3>
              <div className="space-y-4">
                {claim.admission_type_desc && (
                  <div className="flex items-start">
                    <FileText className="h-5 w-5 text-gray-400 mt-1 mr-3" />
                    <div>
                      <p className="text-sm font-medium text-gray-500">Admission Type</p>
                      <p className="mt-1">{claim.admission_type_desc}</p>
                      <p className="text-xs text-gray-500">Code: {claim.admission_type_code}</p>
                    </div>
                  </div>
                )}

                {claim.admission_source_desc && (
                  <div className="flex items-start">
                    <FileText className="h-5 w-5 text-gray-400 mt-1 mr-3" />
                    <div>
                      <p className="text-sm font-medium text-gray-500">Admission Source</p>
                      <p className="mt-1">{claim.admission_source_desc}</p>
                      <p className="text-xs text-gray-500">Code: {claim.admission_source_code}</p>
                    </div>
                  </div>
                )}

                {claim.patient_status_desc && (
                  <div className="flex items-start">
                    <FileText className="h-5 w-5 text-gray-400 mt-1 mr-3" />
                    <div>
                      <p className="text-sm font-medium text-gray-500">Patient Status</p>
                      <p className="mt-1">{claim.patient_status_desc}</p>
                      <p className="text-xs text-gray-500">Code: {claim.patient_status_code}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Claim Information</h3>
              <div className="space-y-4">
                <div className="flex items-start">
                  <DollarSign className="h-5 w-5 text-gray-400 mt-1 mr-3" />
                  <div>
                    <p className="text-sm font-medium text-gray-500">Total Charge Amount</p>
                    <p className="mt-1 text-lg font-semibold">
                      {formatCurrency(claim.total_claim_charge_amount)}
                    </p>
                  </div>
                </div>

                <div className="flex items-start">
                  <FileText className="h-5 w-5 text-gray-400 mt-1 mr-3" />
                  <div>
                    <p className="text-sm font-medium text-gray-500">Filing Indicator</p>
                    <p className="mt-1">{claim.claim_filing_indicator_desc || 'Not specified'}</p>
                    <p className="text-xs text-gray-500">Code: {claim.claim_filing_indicator_code}</p>
                  </div>
                </div>

                <div className="flex items-start">
                  <FileText className="h-5 w-5 text-gray-400 mt-1 mr-3" />
                  <div>
                    <p className="text-sm font-medium text-gray-500">Benefits Assignment</p>
                    <p className="mt-1">{claim.benefits_assignment_desc || 'Not specified'}</p>
                    <p className="text-xs text-gray-500">Status: {claim.benefits_assignment}</p>
                  </div>
                </div>

                <div className="flex items-start">
                  <Clock className="h-5 w-5 text-gray-400 mt-1 mr-3" />
                  <div>
                    <p className="text-sm font-medium text-gray-500">Last Updated</p>
                    <p className="mt-1">
                      {format(new Date(claim.updated_at), 'MMM d, yyyy HH:mm')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}