import { formatCurrency, formatDate } from '../../utils/format';
import type { ClaimHeader } from '../../types';
import type { ClaimDetailData } from '../../hooks/useClaimDetails';

interface ClaimDetailPanelProps {
  detail: ClaimDetailData;
  claim: ClaimHeader;
}

export function ClaimDetailPanel({ detail, claim }: ClaimDetailPanelProps) {
  const { lines, diagnoses, dates, providers, payments } = detail;
  const score = claim.prediction_score;
  const scorePct = score != null ? `${Math.round(score * 100)}%` : '--';
  const riskBand = score == null ? '--' : score < 0.7 ? 'High' : score < 0.9 ? 'Medium' : 'Low';
  const riskClass =
    score == null
      ? 'bg-gray-100 text-gray-700'
      : score < 0.7
        ? 'bg-red-100 text-red-800'
        : score < 0.9
          ? 'bg-yellow-100 text-yellow-800'
          : 'bg-green-100 text-green-800';
  const factors = claim.prediction_factors as Record<string, unknown> | undefined;
  const riskFlags = Array.isArray(factors?.risk_flags)
    ? factors.risk_flags.filter((item): item is string => typeof item === 'string')
    : [];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
      <div>
        <h4 className="font-semibold text-gray-700 mb-2">Claim Info</h4>
        <div className="space-y-1 text-gray-600">
          <div>Type: <span className="text-gray-900">{claim.claim_type}</span></div>
          <div>Filing: <span className="text-gray-900">{claim.claim_filing_indicator_desc || '--'}</span></div>
          <div>Prior Auth: <span className="text-gray-900">{claim.prior_auth_number || 'N/A'}</span></div>
          <div>File: <span className="text-gray-900">{claim.file_name || '--'}</span></div>
        </div>
      </div>

      <div>
        <h4 className="font-semibold text-gray-700 mb-2">Acceptance Prediction</h4>
        <div className="space-y-2 text-gray-600">
          <div className="flex items-center justify-between">
            <span>Probability</span>
            <span className="text-gray-900 font-semibold">{scorePct}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Risk</span>
            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${riskClass}`}>
              {riskBand}
            </span>
          </div>
          {riskFlags.length > 0 ? (
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Risk Flags</p>
              <div className="flex flex-wrap gap-1">
                {riskFlags.slice(0, 4).map((flag) => (
                  <span key={flag} className="px-2 py-0.5 text-xs rounded bg-gray-100 text-gray-700">
                    {flag.replaceAll('_', ' ')}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-500">No prediction factors recorded yet.</p>
          )}
        </div>
      </div>

      <div>
        <h4 className="font-semibold text-gray-700 mb-2">Service Lines ({lines.length})</h4>
        {lines.length > 0 ? (
          <table className="w-full text-xs">
            <thead><tr className="text-gray-500">
              <th className="text-left">Line</th><th className="text-left">Code</th><th className="text-right">Charge</th><th className="text-right">Units</th>
            </tr></thead>
            <tbody>
              {lines.map((line, index) => (
                <tr key={index}>
                  <td>{String(line.line_number)}</td>
                  <td>{String(line.procedure_code || line.revenue_code || '--')}</td>
                  <td className="text-right">{formatCurrency(Number(line.charge_amount) || 0)}</td>
                  <td className="text-right">{String(line.unit_count || '--')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="text-gray-400">No service lines</p>}
      </div>

      <div>
        <h4 className="font-semibold text-gray-700 mb-2">Diagnoses ({diagnoses.length})</h4>
        {diagnoses.length > 0 ? (
          <div className="space-y-1">
            {diagnoses.map((diagnosis, index) => (
              <div key={index} className="flex justify-between">
                <span className="font-mono">{String(diagnosis.diagnosis_code)}</span>
                <span className="text-gray-500">{String(diagnosis.diagnosis_type)}</span>
              </div>
            ))}
          </div>
        ) : <p className="text-gray-400">No diagnoses</p>}
      </div>

      <div>
        <h4 className="font-semibold text-gray-700 mb-2">Providers ({providers.length})</h4>
        {providers.length > 0 ? (
          <div className="space-y-1">
            {providers.map((provider, index) => (
              <div key={index} className="flex justify-between">
                <span>{String(provider.last_or_org_name || '--')}{provider.first_name ? `, ${String(provider.first_name)}` : ''}</span>
                <span className="text-gray-500">{String(provider.provider_role)} {provider.npi ? `(${String(provider.npi)})` : ''}</span>
              </div>
            ))}
          </div>
        ) : <p className="text-gray-400">No providers</p>}
      </div>

      <div>
        <h4 className="font-semibold text-gray-700 mb-2">Dates ({dates.length})</h4>
        {dates.length > 0 ? (
          <div className="space-y-1">
            {dates.map((date, index) => (
              <div key={index} className="flex justify-between">
                <span className="text-gray-500">{String(date.date_qualifier_desc || date.date_qualifier)}</span>
                <span>{date.parsed_date ? formatDate(String(date.parsed_date)) : String(date.date_value)}</span>
              </div>
            ))}
          </div>
        ) : <p className="text-gray-400">No dates</p>}
      </div>

      <div>
        <h4 className="font-semibold text-gray-700 mb-2">Payments ({payments.length})</h4>
        {payments.length > 0 ? (
          <div className="space-y-1">
            {payments.map((payment, index) => (
              <div key={index} className="flex justify-between">
                <span>{String(payment.payer_name || '--')}</span>
                <span className="font-medium">{formatCurrency(Number(payment.paid_amount) || 0)}</span>
              </div>
            ))}
          </div>
        ) : <p className="text-gray-400">No payments recorded</p>}
      </div>
    </div>
  );
}
