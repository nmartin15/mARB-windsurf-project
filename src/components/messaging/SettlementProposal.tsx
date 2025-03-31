import React, { useState } from 'react';
import { Loader2, Check, X, DollarSign } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { SettlementProposal as SettlementProposalType } from '../../types/messaging';

interface SettlementProposalProps {
  threadId: string;
  claimId: string;
  onProposalCreated?: (proposalId: string) => void;
  isReadOnly?: boolean;
  existingProposal?: SettlementProposalType;
}

/**
 * SettlementProposal Component
 * 
 * Provides an interface for creating and viewing settlement proposals
 */
export function SettlementProposal({ 
  threadId, 
  claimId, 
  onProposalCreated, 
  isReadOnly = false,
  existingProposal 
}: SettlementProposalProps) {
  const [proposedAmount, setProposedAmount] = useState<string>(
    existingProposal?.proposed_amount.toString() || ''
  );
  const [notes, setNotes] = useState<string>(existingProposal?.notes || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  /**
   * Creates a new settlement proposal
   */
  const handleCreateProposal = async () => {
    if (!proposedAmount || isNaN(Number(proposedAmount))) {
      setError('Please enter a valid amount');
      return;
    }
    
    try {
      setSubmitting(true);
      setError(null);
      
      // Get current user ID
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }
      
      // Create settlement proposal
      const { data: proposalData, error: proposalError } = await supabase
        .from('settlement_proposals')
        .insert({
          thread_id: threadId,
          claim_id: claimId,
          proposed_amount: Number(proposedAmount),
          proposer_id: user.id,
          status_code: 'PENDING',
          status_desc: 'Pending Review',
          notes
        })
        .select()
        .single();
      
      if (proposalError) throw proposalError;
      
      // Call success handler
      if (onProposalCreated && proposalData) {
        onProposalCreated(proposalData.id);
      }
      
      // Reset form
      setProposedAmount('');
      setNotes('');
      
    } catch (err) {
      console.error('Error creating settlement proposal:', err);
      setError('Failed to create settlement proposal');
    } finally {
      setSubmitting(false);
    }
  };
  
  /**
   * Handles updating a proposal status (accept/reject)
   */
  const handleUpdateStatus = async (newStatus: 'ACCEPTED' | 'REJECTED') => {
    if (!existingProposal) return;
    
    try {
      setSubmitting(true);
      setError(null);
      
      const { error: updateError } = await supabase
        .from('settlement_proposals')
        .update({
          status_code: newStatus,
          status_desc: newStatus === 'ACCEPTED' ? 'Accepted' : 'Rejected',
          updated_at: new Date().toISOString()
        })
        .eq('id', existingProposal.id);
      
      if (updateError) throw updateError;
      
    } catch (err) {
      console.error(`Error ${newStatus.toLowerCase()} settlement proposal:`, err);
      setError(`Failed to ${newStatus.toLowerCase()} settlement proposal`);
    } finally {
      setSubmitting(false);
    }
  };
  
  // Read-only view for existing proposals
  if (isReadOnly && existingProposal) {
    return (
      <div className="border rounded-lg p-4 mb-4 bg-blue-50">
        <div className="flex justify-between items-start mb-3">
          <h4 className="font-medium text-blue-800 flex items-center">
            <DollarSign className="h-4 w-4 mr-1" />
            Settlement Proposal
          </h4>
          <div className={`text-xs font-medium px-2 py-1 rounded ${
            existingProposal.status_code === 'ACCEPTED' ? 'bg-green-100 text-green-800' :
            existingProposal.status_code === 'REJECTED' ? 'bg-red-100 text-red-800' :
            'bg-yellow-100 text-yellow-800'
          }`}>
            {existingProposal.status_desc}
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4 mb-3">
          <div>
            <p className="text-xs text-gray-500">Proposed Amount</p>
            <p className="font-medium">${existingProposal.proposed_amount.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Proposed By</p>
            <p className="font-medium">{existingProposal.proposer_id}</p>
          </div>
        </div>
        
        {existingProposal.notes && (
          <div className="mb-3">
            <p className="text-xs text-gray-500">Notes</p>
            <p className="text-sm">{existingProposal.notes}</p>
          </div>
        )}
        
        {existingProposal.status_code === 'PENDING' && (
          <div className="flex justify-end space-x-2 mt-4">
            <button
              onClick={() => handleUpdateStatus('REJECTED')}
              disabled={submitting}
              className="flex items-center text-sm px-3 py-1 rounded border border-red-300 text-red-700 hover:bg-red-50"
            >
              {submitting ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <X className="h-3 w-3 mr-1" />}
              Reject
            </button>
            <button
              onClick={() => handleUpdateStatus('ACCEPTED')}
              disabled={submitting}
              className="flex items-center text-sm px-3 py-1 rounded bg-green-100 border border-green-300 text-green-700 hover:bg-green-200"
            >
              {submitting ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Check className="h-3 w-3 mr-1" />}
              Accept
            </button>
          </div>
        )}
      </div>
    );
  }
  
  // Form view for creating new proposals
  return (
    <div className="border rounded-lg p-4 mb-4">
      <h4 className="font-medium mb-4">Create Settlement Proposal</h4>
      
      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 p-2 rounded-md">
          {error}
        </div>
      )}
      
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Proposed Amount
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <DollarSign className="h-4 w-4 text-gray-500" />
          </div>
          <input
            type="number"
            value={proposedAmount}
            onChange={(e) => setProposedAmount(e.target.value)}
            className="pl-8 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            placeholder="0.00"
            min="0"
            step="0.01"
          />
        </div>
      </div>
      
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Notes (Optional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          placeholder="Explain your proposal..."
        />
      </div>
      
      <div className="flex justify-end">
        <button
          onClick={handleCreateProposal}
          disabled={!proposedAmount || submitting}
          className={`flex items-center px-4 py-2 rounded-md ${
            !proposedAmount || submitting
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          Submit Proposal
        </button>
      </div>
    </div>
  );
}
