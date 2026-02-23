import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { ThreadWithDetails } from '../../types/messaging';
import { MessageCircle, Plus, AlertCircle, FileText, X } from 'lucide-react';
import { formatCurrency } from '../../utils/format';

/**
 * Interface for available claim data
 * Following the schema standardization with _code and _desc suffix pairs
 */
interface AvailableClaim {
  claim_id: string;
  billing_code: string;
  total_claim_charge_amount: number;
  claim_filing_indicator_code: string;
  claim_filing_indicator_desc?: string;
  status_code?: string;
  status_desc?: string;
  provider_id?: string; 
}

/**
 * MessageThreadsList component displays a list of message threads
 * and provides functionality to create new threads and filter existing ones.
 * 
 * It follows the established schema standardization with _code and _desc suffix pairs.
 */
export function MessageThreadsList() {
  const [threads, setThreads] = useState<ThreadWithDetails[]>([]);
  const [filteredData, setFilteredData] = useState<ThreadWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('all'); 
  const [claimsLoading, setClaimsLoading] = useState(false);
  const [claimsForSettlement, setClaimsForSettlement] = useState<AvailableClaim[]>([]);
  const [showClaimsModal, setShowClaimsModal] = useState(false);
  const [creatingThread, setCreatingThread] = useState(false);
  const navigate = useNavigate();

  // Fetch available claims that don't have associated message threads
  useEffect(() => {
    async function fetchAvailableClaims() {
      try {
        setClaimsLoading(true);

        const { data: threadData, error: threadError } = await supabase
          .from('message_threads')
          .select('claim_id')
          .not('claim_id', 'is', null);

        if (threadError) throw threadError;

        const claimIdsWithThreads = (threadData || []).map(t => t.claim_id);

        const { data: claimsData, error: claimsError } = await supabase
          .from('claim_headers')
          .select('claim_id, total_charge_amount, claim_filing_indicator_code, claim_filing_indicator_desc, claim_status, payer_id')
          .in('claim_status', ['denied', 'rejected', 'appealed']);

        if (claimsError) throw claimsError;

        if (claimsData) {
          const availableClaims: AvailableClaim[] = claimsData
            .filter(claim => !claimIdsWithThreads.includes(claim.claim_id))
            .map(claim => ({
              claim_id: claim.claim_id,
              billing_code: '',
              total_claim_charge_amount: Number(claim.total_charge_amount) || 0,
              claim_filing_indicator_code: claim.claim_filing_indicator_code || '',
              claim_filing_indicator_desc: claim.claim_filing_indicator_desc,
              provider_id: claim.payer_id,
              status_code: claim.claim_status?.toUpperCase(),
              status_desc: claim.claim_status,
            }));
          setClaimsForSettlement(availableClaims);
        }
      } catch (error) {
        console.error('Error fetching available claims:', error);
      } finally {
        setClaimsLoading(false);
      }
    }

    fetchAvailableClaims();
  }, []);

  // Fetch message threads
  useEffect(() => {
    async function fetchThreadsData() {
      try {
        setLoading(true);

        const { data: userData } = await supabase.auth.getUser();
        const userId = userData?.user?.id;

        if (!userId) {
          setError('User not authenticated');
          return;
        }

        const { data: participantData, error: participantError } = await supabase
          .from('thread_participants')
          .select('thread_id')
          .eq('user_id', userId);

        if (participantError) {
          setError(`Error fetching thread participants: ${participantError.message}`);
          return;
        }

        if (!participantData || participantData.length === 0) {
          // No threads found
          setThreads([]);
          setFilteredData([]);
          return;
        }

        const threadIds = participantData.map(item => item.thread_id);

        const { data: threadData, error: threadError } = await supabase
          .from('message_threads')
          .select(`
            *,
            participants:thread_participants(*)
          `)
          .in('id', threadIds)
          .order('updated_at', { ascending: false });

        if (threadError) {
          setError(`Error fetching threads: ${threadError.message}`);
          return;
        }

        // For each thread, get the last message
        const threadsWithLastMessage = await Promise.all((threadData || []).map(async thread => {
          const { data: messageData, error: messageError } = await supabase
            .from('messages')
            .select('*')
            .eq('thread_id', thread.id)
            .order('created_at', { ascending: false })
            .limit(1);

          if (messageError) {
            console.error(`Error fetching messages for thread ${thread.id}:`, messageError);
          }

          // Get claim details if thread is associated with a claim
          let claim = null;
          if (thread.claim_id) {
            const { data: claimData, error: claimError } = await supabase
              .from('claim_headers')
              .select('*')
              .eq('claim_id', thread.claim_id)
              .single();

            if (claimError) {
              console.error(`Error fetching claim for thread ${thread.id}:`, claimError);
            } else {
              claim = claimData;
            }
          }

          return {
            ...thread,
            last_message: messageData && messageData.length > 0 ? messageData[0] : undefined,
            claim: claim,
            unread_count: 0 
          };
        }));

        setThreads(threadsWithLastMessage);
        setFilteredData(threadsWithLastMessage);
      } catch (error) {
        console.error('Error fetching threads:', error);
        setError('Failed to load message threads');
      } finally {
        setLoading(false);
      }
    }

    fetchThreadsData();
  }, []);

  // Duplicate claims fetch removed — covered by first useEffect above

  // Filter threads based on selected filter
  useEffect(() => {
    const applyFilter = () => {
      if (filter === 'all') {
        setFilteredData(threads);
        return;
      }

      const filtered = threads.filter(thread => {
        if (filter === 'unread') return thread.unread_count > 0;
        if (filter === 'claim') return !!thread.claim_id;
        if (filter === 'settlement') return thread.thread_type_code === 'SETL' || thread.subject.toLowerCase().includes('settlement');
        return true;
      });

      setFilteredData(filtered);
    };

    applyFilter();
  }, [filter, threads]);

  // Navigate to thread
  const navigateToThread = (threadId: string) => {
    navigate(`/messaging/thread/${threadId}`);
  };

  // Handle creating a new thread from a modal
  const startThreadFromClaim = (claimId: string) => {
    const claim = claimsForSettlement.find(c => c.claim_id === claimId);
    if (claim) {
      handleStartSettlement(claim);
    }
  };

  // Start a settlement discussion for a claim
  const handleStartSettlement = async (claim: AvailableClaim) => {
    try {
      setCreatingThread(true);
      
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      
      if (!userId) {
        setError('User not authenticated');
        return;
      }
      
      // Create the thread
      const { data: threadData, error: threadError } = await supabase
        .from('message_threads')
        .insert({
          subject: `Settlement Discussion for Claim #${claim.claim_id}`,
          claim_id: claim.claim_id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          status_code: 'ACTIVE',
          status_desc: 'Active Thread',
          thread_type_code: 'SETTLEMENT',
          thread_type_desc: 'Settlement Discussion'
        })
        .select()
        .single();
        
      if (threadError) {
        setError(`Error creating thread: ${threadError.message}`);
        return;
      }
      
      // Add participants
      await supabase.from('thread_participants').insert([
        {
          thread_id: threadData.id,
          user_id: userId,
          role_code: 'MEMBER',
          role_desc: 'Member',
          added_at: new Date().toISOString(),
          permissions: { can_read: true, can_write: true }
        },
        {
          thread_id: threadData.id,
          user_id: providerId,
          role_code: 'PROVIDER',
          role_desc: 'Provider',
          added_at: new Date().toISOString(),
          permissions: { can_read: true, can_write: true }
        }
      ]);
      
      // Add initial message
      const { error: messageError } = await supabase
        .from('messages')
        .insert({
          thread_id: threadData.id,
          sender_id: userId,
          encrypted_content: `I would like to discuss a settlement for this ${claim.claim_filing_indicator_desc?.toLowerCase() || ''} claim.`,
          content_iv: '',
          metadata: {},
          message_type_code: 'TEXT',
          message_type_desc: 'Text Message',
          created_at: new Date().toISOString()
        })
        .select()
        .single();
        
      if (messageError) {
        console.error('Error creating message:', messageError);
      }
      
      // Navigate to the new thread
      navigate(`/messaging/thread/${threadData.id}`);
    } catch (error) {
      console.error('Error starting settlement:', error);
      setError('Failed to start settlement discussion');
    } finally {
      setCreatingThread(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">Messages</h1>
          <button
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            onClick={() => setShowClaimsModal(true)}
          >
            <Plus className="-ml-0.5 mr-2 h-4 w-4" />
            New Message
          </button>
        </div>
        
        <div className="flex gap-4 mt-4">
          <button
            className={`px-3 py-1.5 text-sm font-medium rounded-full ${
              filter === 'all' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button
            className={`px-3 py-1.5 text-sm font-medium rounded-full ${
              filter === 'unread' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            onClick={() => setFilter('unread')}
          >
            Unread
          </button>
          <button
            className={`px-3 py-1.5 text-sm font-medium rounded-full ${
              filter === 'claim' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            onClick={() => setFilter('claim')}
          >
            Claim-Related
          </button>
          <button
            className={`px-3 py-1.5 text-sm font-medium rounded-full ${
              filter === 'settlement' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            onClick={() => setFilter('settlement')}
          >
            Settlement
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 border-b border-red-200 bg-red-50 text-red-700 flex items-center">
          <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
          <span>{error}</span>
          <button 
            className="ml-auto text-red-500 hover:text-red-700" 
            onClick={() => setError(null)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-gray-500">
          Loading message threads...
        </div>
      ) : filteredData.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          No message threads found.
        </div>
      ) : (
        <ul className="divide-y divide-gray-200">
          {filteredData.map(thread => (
            <li 
              key={thread.id}
              className="hover:bg-gray-50 transition-colors cursor-pointer"
              onClick={() => navigateToThread(thread.id)}
            >
              <div className="p-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-blue-600 truncate">{thread.subject}</h3>
                    <div className="mt-1 flex flex-wrap">
                      {thread.thread_type_code && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mr-2 mb-1">
                          {thread.thread_type_desc || thread.thread_type_code}
                        </span>
                      )}
                      {thread.claim && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 mr-2 mb-1">
                          <FileText className="mr-1 h-3 w-3" />
                          {`Claim #${thread.claim.claim_id}`}
                        </span>
                      )}
                      {thread.unread_count > 0 && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 mb-1">
                          {thread.unread_count} Unread
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="ml-5 flex-shrink-0">
                    <p className="text-xs text-gray-500">
                      {new Date(thread.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                
                {thread.last_message && (
                  <div className="mt-2">
                    <p className="text-sm text-gray-600 truncate">
                      {thread.last_message.decrypted_content || thread.last_message.encrypted_content}
                    </p>
                  </div>
                )}
                
                <div className="mt-2 flex items-center text-xs text-gray-500">
                  <MessageCircle className="h-4 w-4 mr-1" />
                  <span>
                    {thread.participants?.length || 0} Participants
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Claims that need settlement */}
      {claimsForSettlement.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Claims Needing Settlement</h2>
          <div className="space-y-3">
            {claimsForSettlement.map(claim => (
              <div 
                key={claim.claim_id} 
                className="bg-orange-50 border border-orange-200 rounded-lg p-4 hover:bg-orange-100 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium text-orange-800">
                      Claim #{claim.claim_id} {claim.billing_code && `(${claim.billing_code})`}
                    </h3>
                    <p className="text-sm text-orange-700 mt-1">
                      Amount: {formatCurrency(claim.total_claim_charge_amount || 0)}
                    </p>
                    <p className="text-sm text-orange-700">
                      Filing Method: {claim.claim_filing_indicator_desc || claim.claim_filing_indicator_code || 'Unknown'}
                    </p>
                    {claim.status_code && (
                      <p className="text-sm text-orange-700">
                        Status: {claim.status_desc || claim.status_code}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleStartSettlement(claim)}
                    disabled={creatingThread}
                    className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
                  >
                    {creatingThread ? 'Creating...' : 'Start Settlement Discussion'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal for creating a new thread */}
      {showClaimsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-gray-900">Start a New Conversation</h2>
              <button 
                className="text-gray-400 hover:text-gray-500"
                onClick={() => setShowClaimsModal(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="mt-4">
              <h3 className="text-sm font-medium text-gray-700">Select a Claim</h3>
              {claimsLoading ? (
                <p className="text-sm text-gray-500 py-2">Loading claims...</p>
              ) : claimsForSettlement.length === 0 ? (
                <p className="text-sm text-gray-500 py-2">No available claims found</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {claimsForSettlement.map(claim => (
                    <li 
                      key={claim.claim_id} 
                      className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                      onClick={() => {
                        startThreadFromClaim(claim.claim_id);
                        setShowClaimsModal(false);
                      }}
                    >
                      <h4 className="font-medium">Claim #{claim.claim_id}</h4>
                      <p className="text-sm text-gray-600 mt-1">
                        Billing: {claim.billing_code}, Amount: {formatCurrency(claim.total_claim_charge_amount)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            
            <div className="mt-6 flex justify-end">
              <button
                className="mr-3 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                onClick={() => setShowClaimsModal(false)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                onClick={() => {
                  // TODO: Create a new empty thread without claim association
                  setShowClaimsModal(false);
                }}
              >
                Create Without Claim
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
