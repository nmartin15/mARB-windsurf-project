import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../../lib/supabase';

interface ImportStatus {
  total: number;
  processed: number;
  successful: number;
  failed: number;
}

export function DataImport() {
  const [importing, setImporting] = useState(false);
  const [status, setStatus] = useState<ImportStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const processFile = async (file: File) => {
    setImporting(true);
    setError(null);
    setStatus({ total: 0, processed: 0, successful: 0, failed: 0 });

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);

          setStatus(prev => ({ ...prev!, total: jsonData.length }));

          for (const row of jsonData) {
            try {
              const { error: insertError } = await supabase
                .from('healthcare_claims')
                .insert([{
                  claim_id: row.claim_id,
                  patient_id: row.patient_id,
                  provider_id: row.provider_id,
                  payer_id: row.payer_id,
                  service_date_start: row.service_date_start,
                  claim_submission_date: row.claim_submission_date,
                  hospital_payment_date: row.hospital_payment_date,
                  billed_amount: row.billed_amount,
                  allowed_amount: row.allowed_amount,
                  paid_amount: row.paid_amount,
                  patient_responsibility: row.patient_responsibility,
                  claim_status: row.claim_status,
                  denial_reason: row.denial_reason,
                  procedure_code: row.procedure_code,
                  diagnosis_code: row.diagnosis_code,
                  revenue_code: row.revenue_code
                }]);

              setStatus(prev => ({
                ...prev!,
                processed: prev!.processed + 1,
                successful: insertError ? prev!.successful : prev!.successful + 1,
                failed: insertError ? prev!.failed + 1 : prev!.failed
              }));
            } catch (err) {
              setStatus(prev => ({
                ...prev!,
                processed: prev!.processed + 1,
                failed: prev!.failed + 1
              }));
            }
          }
        } catch (err) {
          setError('Error processing file. Please check the file format.');
        }
      };

      reader.readAsArrayBuffer(file);
    } catch (err) {
      setError('Error reading file');
    } finally {
      setImporting(false);
    }
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      processFile(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv']
    },
    multiple: false
  });

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          isDragActive ? 'border-green-500 bg-green-50' : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <input {...getInputProps()} />
        <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
        <p className="text-gray-600">
          {isDragActive
            ? 'Drop the file here...'
            : 'Drag and drop a file here, or click to select a file'}
        </p>
        <p className="text-sm text-gray-500 mt-2">
          Supported formats: .xlsx, .xls, .csv
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 flex items-center gap-2 text-red-700">
          <XCircle className="h-5 w-5 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {importing && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <div className="flex items-center gap-2 text-blue-700 mb-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <p>Importing data...</p>
          </div>
          {status && (
            <div className="space-y-2">
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-500"
                  style={{ width: `${(status.processed / status.total) * 100}%` }}
                />
              </div>
              <div className="text-sm text-gray-600">
                Processed {status.processed} of {status.total} records
                ({status.successful} successful, {status.failed} failed)
              </div>
            </div>
          )}
        </div>
      )}

      {!importing && status && status.processed === status.total && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4 flex items-center gap-2 text-green-700">
          <CheckCircle className="h-5 w-5 flex-shrink-0" />
          <p>
            Import complete: {status.successful} records imported successfully
            {status.failed > 0 && `, ${status.failed} failed`}
          </p>
        </div>
      )}
    </div>
  );
}