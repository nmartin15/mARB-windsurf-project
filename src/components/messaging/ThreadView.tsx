import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { supabase, usingMockData } from '../../lib/supabase';
import { MessageWithUser, ThreadWithDetails, ClaimReference } from '../../types/messaging';
import { getThreadKey } from '../../utils/keyManagement';
import { decryptMessage } from '../../utils/encryption';
import { ArrowLeft, DollarSign, Shield, FileText } from 'lucide-react';
import { MessageComposer } from './MessageComposer';
import { SettlementProposal } from './SettlementProposal';
import { formatCurrency } from '../../utils/format';

/**
 * ThreadView Component
 * 
 * Displays messages in a thread and provides functionality for:
 * - Sending new messages
 * - Creating settlement proposals
 * - Adding participants
 * - Viewing attachments
 * - Managing message encryption/decryption
 */
export function ThreadView() {
  const { threadId } = useParams<{ threadId: string }>();
  const navigate = useNavigate();
  const messageEndRef = useRef<HTMLDivElement>(null);
  
  // Component state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [thread, setThread] = useState<ThreadWithDetails | null>(null);
  const [messages, setMessages] = useState<MessageWithUser[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [hasWritePermission, setHasWritePermission] = useState(false);
  const [showSettlementForm, setShowSettlementForm] = useState(false);
  const [claim, setClaim] = useState<ClaimReference | null>(null);
  const [decryptingMessages, setDecryptingMessages] = useState(false);

  // Get current user ID
  useEffect(() => {
    const getCurrentUser = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        setCurrentUserId(data.user?.id || null);
      } catch (error) {
        console.error('Error getting current user:', error);
        setCurrentUserId(null);
      }
    };
    
    getCurrentUser();
  }, []);

  // Decrypt all messages in the thread
  const decryptMessages = useCallback(async () => {
    if (!threadId || messages.length === 0) return;
    
    try {
      setDecryptingMessages(true);
      
      // TEMPORARY FIX: In development mode, use the decrypted_content directly
      if (usingMockData) {
        console.log('Using mock decryption in development mode');
        
        // The mock data already has decrypted_content so we can skip actual decryption
        // but we still need to set the state to maintain the component flow
        setDecryptingMessages(false);
        return;
      }
      
      const threadKey = await getThreadKey(threadId);
      
      const decryptedMessages = await Promise.all(
        messages.map(async (message) => {
          if (!message.encrypted_content || !message.content_iv) {
            return message;
          }
          
          try {
            const decryptedContent = decryptMessage(
              message.encrypted_content,
              threadKey,
              message.content_iv
            );
            
            return {
              ...message,
              decrypted_content: decryptedContent
            };
          } catch (error) {
            console.error(`Failed to decrypt message ${message.id}:`, error);
            return {
              ...message,
              decrypted_content: '[Encryption error: Unable to decrypt message]'
            };
          }
        })
      );
      
      setMessages(decryptedMessages);
    } catch (error) {
      console.error('Error decrypting messages:', error);
    } finally {
      setDecryptingMessages(false);
    }
  }, [threadId, messages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Fetch thread details and messages
  useEffect(() => {
    const fetchThreadData = async () => {
      if (!threadId) return;
      
      try {
        setLoading(true);
        
        // TEMPORARY FIX: Check if we're in development mode and return mock data
        // This will be removed once proper database migrations are applied
        if (usingMockData) {
          console.log('Using mock thread data in development mode');
          
          // Create mock data with proper schema standardization (_code and _desc suffix pairs)
          const mockUserId = (await supabase.auth.getUser()).data.user?.id || 'mock-user-id';
          const now = new Date().toISOString();
          const yesterday = new Date(Date.now() - 86400000).toISOString();
          
          // Create a mock thread based on the threadId parameter
          const mockThread: ThreadWithDetails = {
            id: threadId,
            subject: `Discussion about Claim #${threadId.slice(-5)}`,
            created_at: yesterday,
            updated_at: now,
            claim_id: `mock-claim-${threadId.slice(-5)}`,
            thread_type_code: 'CLAIM',
            thread_type_desc: 'Claim Discussion',
            status_code: 'ACTIVE',
            status_desc: 'Active Thread',
            participants: [
              {
                id: `mock-participant-${threadId}`,
                thread_id: threadId,
                user_id: mockUserId,
                added_at: yesterday,
                role_code: 'ADMIN',
                role_desc: 'Administrator',
                permissions: {
                  can_read: true,
                  can_write: true
                }
              }
            ],
            unread_count: 0
          };
          
          // Create mock messages for this thread
          const mockMessages: MessageWithUser[] = [
            {
              id: `mock-message-1-${threadId}`,
              thread_id: threadId,
              sender_id: mockUserId,
              encrypted_content: '',
              content_iv: '',
              metadata: {},
              created_at: yesterday,
              message_type_code: 'TEXT',
              message_type_desc: 'Text Message',
              decrypted_content: 'Hello, I would like to discuss this claim.',
              user: {
                id: mockUserId,
                email: 'user@example.com',
                full_name: 'Current User'
              }
            },
            {
              id: `mock-message-2-${threadId}`,
              thread_id: threadId,
              sender_id: 'other-user-id',
              encrypted_content: '',
              content_iv: '',
              metadata: {},
              created_at: now,
              message_type_code: 'TEXT',
              message_type_desc: 'Text Message',
              decrypted_content: 'Thank you for reaching out. What would you like to discuss?',
              user: {
                id: 'other-user-id',
                email: 'provider@example.com',
                full_name: 'Healthcare Provider'
              }
            }
          ];
          
          // Create mock claim data
          const mockClaim: ClaimReference = {
            claim_id: `mock-claim-${threadId.slice(-5)}`,
            billing_code: `CL-${threadId.slice(-3)}`,
            total_claim_charge_amount: 10000,
            claim_filing_indicator_code: 'electronic',
            claim_filing_indicator_desc: 'Electronic claim'
          };
          
          // Set the mock data
          setThread({...mockThread, claim: mockClaim});
          setMessages(mockMessages);
          setCurrentUserId(mockUserId);
          setHasWritePermission(true);
          setClaim(mockClaim);
          
          setLoading(false);
          return;
        }
        
        // Get thread details
        const { data: threadData, error: threadError } = await supabase
          .from('message_threads')
          .select(`
            *,
            participants:thread_participants(*)
          `)
          .eq('id', threadId)
          .single();
        
        if (threadError) throw threadError;
        if (!threadData) throw new Error('Thread not found');
        
        // Get claim details if this is a claim-related thread
        let claimData: ClaimReference | null = null;
        if (threadData.claim_id) {
          const { data: fetchedClaim } = await supabase
            .from('healthcare_claims')
            .select('claim_id, billing_code, total_claim_charge_amount, claim_filing_indicator_code, claim_filing_indicator_desc')
            .eq('claim_id', threadData.claim_id)
            .single();
          
          if (fetchedClaim) {
            claimData = {
              claim_id: fetchedClaim.claim_id || '',
              billing_code: fetchedClaim.billing_code || '',
              total_claim_charge_amount: fetchedClaim.total_claim_charge_amount || 0,
              claim_filing_indicator_code: fetchedClaim.claim_filing_indicator_code || '',
              claim_filing_indicator_desc: fetchedClaim.claim_filing_indicator_desc || ''
            };
            setClaim(claimData);
          }
        }
        
        // Format thread object
        const formattedThread: ThreadWithDetails = {
          ...threadData,
          participants: threadData.participants || [],
          unread_count: 0,
          claim: claimData
        };
        
        setThread(formattedThread);
        
        // Get messages
        const { data: messagesData, error: messagesError } = await supabase
          .from('messages')
          .select('*')
          .eq('thread_id', threadId)
          .order('created_at', { ascending: true });
        
        if (messagesError) throw messagesError;
        
        // Get user details for each message
        const messagesWithUsers = await Promise.all(
          (messagesData || []).map(async (message) => {
            // Get user information
            const { data: userData } = await supabase
              .from('user_profiles')
              .select('*')
              .eq('user_id', message.sender_id)
              .single();
            
            return {
              ...message,
              user: userData || undefined
            };
          })
        );
        
        setMessages(messagesWithUsers);
        
        // Mark messages as read
        const { data: { user } } = await supabase.auth.getUser();
        const userId = user?.id;
        if (userId) {
          const messagesToMark = messagesData?.filter(
            msg => msg.sender_id !== userId
          ) || [];
          
          // Insert read receipts
          if (messagesToMark.length > 0) {
            await Promise.all(
              messagesToMark.map(msg => 
                supabase.from('message_read_status').upsert({
                  message_id: msg.id,
                  user_id: userId,
                  read_at: new Date().toISOString()
                })
              )
            );
          }
        }
        
        // Set up subscription for new messages
        if (threadId) {
          const messagesSubscription = supabase
            .channel('messages')
            .on('postgres_changes', 
              { event: 'INSERT', schema: 'public', table: 'messages', filter: `thread_id=eq.${threadId}` },
              async (payload) => {
                const newMessage = payload.new as MessageWithUser;
                
                // Get user information
                const { data: userData } = await supabase
                  .from('user_profiles')
                  .select('*')
                  .eq('user_id', newMessage.sender_id)
                  .single();
                
                const messageWithUser = {
                  ...newMessage,
                  user: userData || undefined
                };
                
                // Add message to state
                setMessages(prev => [...prev, messageWithUser]);
                
                // Decrypt the message if possible
                try {
                  const threadKey = await getThreadKey(threadId);
                  const decryptedContent = decryptMessage(
                    newMessage.encrypted_content,
                    threadKey,
                    newMessage.content_iv
                  );
                  
                  setMessages(prev => 
                    prev.map(msg => 
                      msg.id === newMessage.id 
                        ? { ...msg, decrypted_content: decryptedContent } 
                        : msg
                    )
                  );
                } catch (error) {
                  console.error('Failed to decrypt new message:', error);
                }
                
                // Mark as read if from someone else
                const { data: { user: currentUser } } = await supabase.auth.getUser();
                if (currentUser?.id && newMessage.sender_id !== currentUser.id) {
                  await supabase.from('message_read_status').insert({
                    message_id: newMessage.id,
                    user_id: currentUser.id,
                    read_at: new Date().toISOString()
                  });
                }
              }
            )
            .subscribe();
            
          // Decrypt messages
          await decryptMessages();
          
          return () => {
            supabase.removeChannel(messagesSubscription);
          };
        }
      } catch (err) {
        console.error('Error fetching thread data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load thread data');
      } finally {
        setLoading(false);
      }
    };
    
    fetchThreadData();
  }, [threadId, decryptMessages]);

  useEffect(() => {
    if (claim) {
      // Future implementation using claim data
      console.log("Claim data available:", claim);
    }
  }, [claim]);

  useEffect(() => {
    decryptMessages();
  }, [decryptMessages]);

  useEffect(() => {
    if (decryptingMessages) {
      // Could add a decryption status indicator here
      console.log("Decrypting messages...");
    }
  }, [decryptingMessages]);

  useEffect(() => {
    const checkPermissions = async () => {
      if (!thread || !currentUserId) {
        setHasWritePermission(false);
        return;
      }
      
      try {
        const participant = thread.participants.find(p => p.user_id === currentUserId);
        setHasWritePermission(participant?.permissions.can_write ?? false);
      } catch (error) {
        console.error('Error checking permissions:', error);
        setHasWritePermission(false);
      }
    };
    
    checkPermissions();
  }, [thread, currentUserId]);

  const handleBack = () => {
    navigate('/messaging');
  };
  
  const renderTimestamp = (dateString: string) => {
    if (!dateString) return '';
    return format(new Date(dateString), 'MMM d, yyyy h:mm a');
  };
  
  const handleClaimReference = (claim: ClaimReference | null | undefined) => {
    if (!claim) return null;
    return {
      id: claim.claim_id || '',
      code: claim.billing_code || '',
      amount: claim.total_claim_charge_amount || 0,
      indicator: claim.claim_filing_indicator_code || '',
      description: claim.claim_filing_indicator_desc || ''
    };
  };

  const renderMessageContent = (message: MessageWithUser) => {
    // For settlement proposals
    if (message.message_type_code === 'SETL') {
      return (
        <div className="bg-green-50 p-3 rounded-md border border-green-200">
          <div className="flex items-center text-green-800 font-medium mb-2">
            <DollarSign className="h-4 w-4 mr-1" />
            Settlement Proposal
          </div>
          <p className="text-sm text-gray-700">
            {message.decrypted_content || '[Encrypted settlement details]'}
          </p>
        </div>
      );
    }
    
    // For regular text messages
    return (
      <p className="text-sm text-gray-700 whitespace-pre-wrap">
        {message.decrypted_content || '[Encrypted message]'}
      </p>
    );
  };

  const renderMessages = () => {
    if (!thread) return null;
    
    // Show loading indicator when decrypting messages
    if (decryptingMessages) {
      return (
        <div className="flex flex-col items-center justify-center p-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mb-2"></div>
          <p className="text-sm text-gray-500">Decrypting messages...</p>
        </div>
      );
    }
    
    return messages.map((message) => {
      const isCurrentUser = message.sender_id === currentUserId;
      const participant = thread.participants.find(p => p.user_id === message.sender_id);
      
      return (
        <div 
          key={message.id}
          className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
        >
          <div 
            className={`max-w-[70%] ${
              isCurrentUser 
                ? 'bg-blue-50 border-blue-100' 
                : 'bg-gray-50 border-gray-100'
            } rounded-lg border p-4`}
          >
            {!isCurrentUser && (
              <div className="flex items-center mb-2">
                <div className="h-6 w-6 rounded-full bg-gray-300 flex items-center justify-center text-xs text-white mr-2">
                  {message.user?.full_name?.charAt(0) || 'U'}
                </div>
                <span className="font-medium text-gray-900">
                  {message.user?.full_name || 'User'} 
                </span>
                <span className="text-xs text-gray-500 ml-2">
                  ({participant?.role_desc || 'Participant'})
                </span>
              </div>
            )}
            
            {renderMessageContent(message)}
            
            <div className="mt-2 text-xs text-gray-500 flex justify-between items-center">
              <span>{renderTimestamp(message.created_at)}</span>
              
              {message.encrypted_content && !message.decrypted_content && (
                <span className="flex items-center text-amber-600">
                  <Shield className="h-3 w-3 mr-1" />
                  Encrypted
                </span>
              )}
            </div>
          </div>
        </div>
      );
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  if (error || !thread) {
    return (
      <div className="p-6 text-center">
        <Shield className="h-8 w-8 mx-auto text-red-500 mb-2" />
        <p className="text-red-500">{error || 'Thread not found'}</p>
        <button 
          onClick={handleBack}
          className="mt-2 text-blue-600 hover:text-blue-800"
        >
          Back to Messages
        </button>
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-lg shadow-sm flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center">
          <Link 
            to="/messaging"
            className="mr-4 text-gray-500 hover:text-gray-700 flex items-center"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="ml-1 hidden sm:inline">Back to Messages</span>
          </Link>
          <h2 className="text-lg font-medium text-gray-900 truncate max-w-sm sm:max-w-md">
            {thread?.subject || 'Loading...'}
          </h2>
        </div>
        
        {/* Action buttons */}
        {thread && (
          <div className="flex">
            {thread.claim && (
              <button
                onClick={() => navigate(`/claims/${thread.claim?.claim_id}`)}
                className="inline-flex items-center px-3 py-1.5 mr-2 text-sm border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                <FileText className="h-4 w-4 mr-1" />
                View Claim
              </button>
            )}
            
            {thread.claim && (
              <button
                onClick={() => setShowSettlementForm(true)}
                className="inline-flex items-center px-3 py-1.5 text-sm border border-transparent rounded-md text-white bg-green-600 hover:bg-green-700"
              >
                <DollarSign className="h-4 w-4 mr-1" />
                Propose Settlement
              </button>
            )}
          </div>
        )}
      </div>
        
      {/* Claim info */}
      {thread.claim && (
        <div className="mt-3 p-3 bg-blue-50 rounded-md border border-blue-100">
          <div className="flex items-start">
            <FileText className="h-5 w-5 text-blue-500 mt-0.5 mr-2" />
            <div>
              <h3 className="text-sm font-medium text-blue-800">
                Claim {thread.claim.billing_code || thread.claim.claim_id}
              </h3>
              <div className="mt-1 text-sm text-blue-700">
                {(() => {
                  const claimRef = handleClaimReference(thread.claim);
                  if (!claimRef) return null;
                  return (
                    <>
                      <p>Insurance: {claimRef.description || claimRef.indicator}</p>
                      <p>Amount: {formatCurrency(claimRef.amount || 0)}</p>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Message thread and composer */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6">
          {showSettlementForm && thread.claim && (
            <SettlementProposal 
              threadId={threadId || ''}
              claimId={thread.claim.claim_id}
              onProposalCreated={() => setShowSettlementForm(false)}
            />
          )}
          
          {messages.length === 0 ? (
            <div className="text-center py-10 text-gray-500">
              <p>No messages yet. Start the conversation!</p>
            </div>
          ) : (
            <div className="space-y-6">
              {renderMessages()}
              <div ref={messageEndRef} />
            </div>
          )}
        </div>
        
        {/* Message composer */}
        <div className="border-t p-4">
          {hasWritePermission ? (
            <MessageComposer 
              threadId={threadId || ''}
              onSendSuccess={() => {
                // Could add a success message or refresh logic
              }}
            />
          ) : (
            <div className="text-center p-2 bg-gray-50 rounded text-gray-500">
              <p>You don't have permission to send messages in this thread</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
