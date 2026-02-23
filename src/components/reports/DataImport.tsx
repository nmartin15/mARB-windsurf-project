import { useState, useCallback } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface ImportResult {
  fileName: string;
  fileType: string;
  claimsLoaded: number;
  errors: string[];
  status: 'success' | 'error' | 'partial';
}

export function DataImport() {
  const [isDragging, setIsDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [progress, setProgress] = useState<string>('');

  const processFile = useCallback(async (file: File) => {
    const result: ImportResult = {
      fileName: file.name,
      fileType: 'JSON',
      claimsLoaded: 0,
      errors: [],
      status: 'success',
    };

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      const files = Array.isArray(data) ? data : [data];

      for (const fileData of files) {
        const fileType = fileData.file_type || 'unknown';
        result.fileType = fileType;

        if (fileType === '837P' || fileType === '837I') {
          for (const claim of fileData.claims || []) {
            try {
              setProgress(`Loading claim ${claim.claim?.claim_id || '?'}...`);
              await loadClaim(claim);
              result.claimsLoaded++;
            } catch (err) {
              result.errors.push(`Claim ${claim.claim?.claim_id || '?'}: ${err}`);
            }
          }
        } else if (fileType === '835') {
          for (const payment of fileData.payments || []) {
            try {
              setProgress(`Loading payment for ${payment.payment?.patient_control_number || '?'}...`);
              await loadPayment(payment);
              result.claimsLoaded++;
            } catch (err) {
              result.errors.push(`Payment ${payment.payment?.patient_control_number || '?'}: ${err}`);
            }
          }
        } else {
          result.errors.push(`Unknown file type: ${fileType}. Expected output from parse_837p.py or parse_835.py.`);
        }
      }
    } catch (err) {
      result.errors.push(`Parse error: ${err}`);
      result.status = 'error';
    }

    if (result.errors.length > 0 && result.claimsLoaded > 0) result.status = 'partial';
    else if (result.errors.length > 0) result.status = 'error';

    return result;
  }, []);

  async function loadClaim(claimData: Record<string, unknown>) {
    const claim = claimData.claim as Record<string, unknown>;

    const { data: headerResult, error: headerErr } = await supabase
      .from('claim_headers')
      .insert({
        claim_id: claim.claim_id,
        claim_type: claim.claim_type || 'professional',
        file_name: claim.file_name,
        file_type: claim.file_type,
        total_charge_amount: toNum(claim.total_charge_amount),
        claim_status: 'submitted',
        facility_type_code: claim.facility_type_code,
        facility_type_desc: claim.facility_type_desc,
        facility_code_qualifier: claim.facility_code_qualifier,
        claim_frequency_type_code: claim.claim_frequency_type_code,
        claim_frequency_type_desc: claim.claim_frequency_type_desc,
        assignment_code: claim.assignment_code,
        assignment_desc: claim.assignment_desc,
        benefits_assignment: claim.benefits_assignment,
        release_of_info_code: claim.release_of_info_code,
        claim_filing_indicator_code: claim.claim_filing_indicator_code,
        claim_filing_indicator_desc: claim.claim_filing_indicator_desc,
        payer_responsibility_code: claim.payer_responsibility_code,
        payer_responsibility_desc: claim.payer_responsibility_desc,
        payer_id: claim.payer_id,
        payer_name: claim.payer_name,
        prior_auth_number: claim.prior_auth_number,
        prior_auth_status: claim.prior_auth_status || 'none',
      })
      .select('id')
      .single();

    if (headerErr) throw headerErr;
    const headerId = headerResult.id;

    // Lines
    const lineMap: Record<number, number> = {};
    for (const line of (claimData.lines as Array<Record<string, unknown>>) || []) {
      const { data: lineRes, error } = await supabase
        .from('claim_lines')
        .insert({
          claim_header_id: headerId,
          line_number: line.line_number,
          procedure_code: line.procedure_code,
          procedure_qualifier: line.procedure_qualifier,
          modifier_1: line.modifier_1,
          modifier_2: line.modifier_2,
          modifier_3: line.modifier_3,
          modifier_4: line.modifier_4,
          charge_amount: toNum(line.charge_amount),
          unit_count: toNum(line.unit_count),
          unit_measurement_code: line.unit_measurement_code,
          place_of_service_code: line.place_of_service_code,
          revenue_code: line.revenue_code,
        })
        .select('id')
        .single();
      if (!error && lineRes) lineMap[Number(line.line_number)] = lineRes.id;
    }

    // Diagnoses
    for (const dx of (claimData.diagnoses as Array<Record<string, unknown>>) || []) {
      await supabase.from('claim_diagnoses').insert({
        claim_header_id: headerId,
        diagnosis_code: dx.diagnosis_code,
        diagnosis_type: dx.diagnosis_type || 'other',
        code_qualifier: dx.code_qualifier,
        sequence_number: dx.sequence_number || 1,
      });
    }

    // Header dates
    for (const dt of (claimData.dates_header as Array<Record<string, unknown>>) || []) {
      await supabase.from('claim_dates').insert({
        claim_header_id: headerId,
        date_qualifier: dt.date_qualifier,
        date_qualifier_desc: dt.date_qualifier_desc,
        date_format_qualifier: dt.date_format_qualifier,
        date_value: dt.date_value,
        parsed_date: dt.parsed_date,
      });
    }

    // Line dates
    for (const dt of (claimData.dates_line as Array<Record<string, unknown>>) || []) {
      const lineId = lineMap[Number(dt.line_number)];
      await supabase.from('claim_dates').insert({
        claim_header_id: headerId,
        claim_line_id: lineId || null,
        date_qualifier: dt.date_qualifier,
        date_qualifier_desc: dt.date_qualifier_desc,
        date_format_qualifier: dt.date_format_qualifier,
        date_value: dt.date_value,
        parsed_date: dt.parsed_date,
      });
    }

    // Providers
    for (const prov of (claimData.providers as Array<Record<string, unknown>>) || []) {
      await supabase.from('claim_providers').insert({
        claim_header_id: headerId,
        provider_role: prov.provider_role || 'other',
        entity_identifier_code: prov.entity_identifier_code,
        entity_type_qualifier: prov.entity_type_qualifier,
        npi: prov.npi,
        id_code_qualifier: prov.id_code_qualifier,
        last_or_org_name: prov.last_or_org_name,
        first_name: prov.first_name,
        middle_name: prov.middle_name,
        taxonomy_code: prov.taxonomy_code,
      });
    }

    // References
    for (const ref of (claimData.references as Array<Record<string, unknown>>) || []) {
      await supabase.from('claim_references').insert({
        claim_header_id: headerId,
        reference_qualifier: ref.reference_qualifier,
        reference_qualifier_desc: ref.reference_qualifier_desc,
        reference_value: ref.reference_value,
      });
    }
  }

  async function loadPayment(paymentData: Record<string, unknown>) {
    const pmt = paymentData.payment as Record<string, unknown>;
    const pcn = String(pmt.patient_control_number || '');

    // Match to existing claim
    const { data: matchResult } = await supabase
      .from('claim_headers')
      .select('id')
      .eq('claim_id', pcn)
      .limit(1);
    const claimHeaderId = matchResult?.[0]?.id || null;

    // Update claim status if matched
    if (claimHeaderId) {
      const paid = toNum(pmt.paid_amount);
      const status = pmt.claim_status_code === '4' ? 'denied' : (paid && paid > 0) ? 'paid' : 'partial';
      await supabase.from('claim_headers').update({
        paid_amount: paid,
        patient_responsibility: toNum(pmt.patient_responsibility),
        claim_status: status,
      }).eq('id', claimHeaderId);
    }

    const { data: pmtResult, error: pmtErr } = await supabase
      .from('claim_payments')
      .insert({
        claim_header_id: claimHeaderId,
        file_name: pmt.file_name,
        patient_control_number: pcn,
        claim_status_code: pmt.claim_status_code,
        claim_status_desc: pmt.claim_status_desc,
        total_charge_amount: toNum(pmt.total_charge_amount),
        paid_amount: toNum(pmt.paid_amount),
        patient_responsibility: toNum(pmt.patient_responsibility),
        payer_id: pmt.payer_id,
        payer_name: pmt.payer_name,
        check_number: pmt.check_number,
        payment_date: pmt.payment_date,
        payment_method_code: pmt.payment_method_code,
      })
      .select('id')
      .single();

    if (pmtErr) throw pmtErr;
    const paymentId = pmtResult.id;

    // Claim-level adjustments
    for (const adj of (paymentData.adjustments as Array<Record<string, unknown>>) || []) {
      await supabase.from('claim_adjustments').insert({
        claim_payment_id: paymentId,
        adjustment_group_code: adj.adjustment_group_code || 'OA',
        adjustment_group_desc: adj.adjustment_group_desc,
        carc_code: adj.carc_code || '',
        carc_description: adj.carc_description,
        adjustment_amount: toNum(adj.adjustment_amount),
        adjustment_quantity: adj.adjustment_quantity ? Number(adj.adjustment_quantity) : null,
      });
    }

    // Service lines
    for (const svc of (paymentData.service_lines as Array<Record<string, unknown>>) || []) {
      const { data: svcRes } = await supabase
        .from('claim_payment_lines')
        .insert({
          claim_payment_id: paymentId,
          procedure_code: svc.procedure_code,
          modifier_1: svc.modifier_1,
          charge_amount: toNum(svc.charge_amount),
          paid_amount: toNum(svc.paid_amount),
          revenue_code: svc.revenue_code,
          units_paid: toNum(svc.units_paid),
        })
        .select('id')
        .single();

      const svcLineId = svcRes?.id;
      for (const adj of (svc.adjustments as Array<Record<string, unknown>>) || []) {
        await supabase.from('claim_adjustments').insert({
          claim_payment_id: paymentId,
          claim_payment_line_id: svcLineId,
          adjustment_group_code: adj.adjustment_group_code || 'OA',
          adjustment_group_desc: adj.adjustment_group_desc,
          carc_code: adj.carc_code || '',
          carc_description: adj.carc_description,
          adjustment_amount: toNum(adj.adjustment_amount),
          adjustment_quantity: adj.adjustment_quantity ? Number(adj.adjustment_quantity) : null,
        });
      }
    }
  }

  function toNum(val: unknown): number | null {
    if (val === null || val === undefined || val === '') return null;
    const n = Number(val);
    return isNaN(n) ? null : n;
  }

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.json'));
    if (files.length === 0) return;

    setImporting(true);
    setResults([]);
    const newResults: ImportResult[] = [];

    for (const file of files) {
      setProgress(`Processing ${file.name}...`);
      const result = await processFile(file);
      newResults.push(result);
    }

    setResults(newResults);
    setImporting(false);
    setProgress('');
  }, [processFile]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter(f => f.name.endsWith('.json'));
    if (files.length === 0) return;

    setImporting(true);
    setResults([]);
    const newResults: ImportResult[] = [];

    for (const file of files) {
      setProgress(`Processing ${file.name}...`);
      const result = await processFile(file);
      newResults.push(result);
    }

    setResults(newResults);
    setImporting(false);
    setProgress('');
    e.target.value = '';
  }, [processFile]);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-2">Import EDI Data</h3>
        <p className="text-sm text-gray-500 mb-4">
          Upload JSON files generated by the EDI parsers (parse_837p.py or parse_835.py).
          The data will be loaded into the normalized database tables.
        </p>

        {/* Drop zone */}
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
          }`}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          {importing ? (
            <div className="flex flex-col items-center">
              <Loader2 className="h-10 w-10 text-blue-500 animate-spin mb-3" />
              <p className="text-sm text-gray-600">{progress}</p>
            </div>
          ) : (
            <>
              <Upload className="h-10 w-10 text-gray-400 mx-auto mb-3" />
              <p className="text-sm text-gray-600 mb-2">Drag and drop JSON files here, or</p>
              <label className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 text-sm">
                <FileText className="h-4 w-4 mr-2" />
                Browse Files
                <input
                  type="file"
                  accept=".json"
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </label>
              <p className="text-xs text-gray-400 mt-2">Accepts .json files from parse_837p.py, parse_835.py</p>
            </>
          )}
        </div>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-4">
          {results.map((result, i) => (
            <div key={i} className={`rounded-lg shadow p-4 ${
              result.status === 'success' ? 'bg-green-50 border border-green-200' :
              result.status === 'partial' ? 'bg-amber-50 border border-amber-200' :
              'bg-red-50 border border-red-200'
            }`}>
              <div className="flex items-start">
                {result.status === 'success' ? <CheckCircle className="h-5 w-5 text-green-600 mr-3 mt-0.5" /> :
                 result.status === 'partial' ? <AlertCircle className="h-5 w-5 text-amber-600 mr-3 mt-0.5" /> :
                 <AlertCircle className="h-5 w-5 text-red-600 mr-3 mt-0.5" />}
                <div className="flex-1">
                  <p className="font-medium text-sm">{result.fileName}</p>
                  <p className="text-xs text-gray-500">Type: {result.fileType} | Records loaded: {result.claimsLoaded}</p>
                  {result.errors.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-medium text-red-600">Errors ({result.errors.length}):</p>
                      {result.errors.slice(0, 5).map((err, j) => (
                        <p key={j} className="text-xs text-red-500 ml-2">{err}</p>
                      ))}
                      {result.errors.length > 5 && (
                        <p className="text-xs text-red-400 ml-2">...and {result.errors.length - 5} more</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
