import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import TextareaAutosize from 'react-textarea-autosize';
import { format } from 'date-fns';
import { Send, DollarSign, Loader2, Lock, AlertCircle } from 'lucide-react';

/**
 * Message interface
 */
interface Message {
  id: string;
  negotiation_id: string;
  user_id: string;
  message: string;
  created_at: string;
  user_email?: string;
}

/**
 * Negotiation interface
 */
interface Negotiation {
  id: string;
  claim_id: string;
  proposed_amount: number;
  created_by: string;
  created_at: string;
  status_code: string;
  status_desc: string;
  creator_email?: string;
}

/**
 * Type for combined chat items (messages or negotiations)
 * Using a discriminated union type to ensure proper type checking
 */
type ChatItem = 
  | (Message & { type?: 'message' }) 
  | (Negotiation & { type?: 'negotiation' });

/**
 * Props for the ClaimChat component
 */
interface ClaimChatProps {
  claimId: string;
  claimAmount: number;
  status?: string;
}

/**
 * User data interface
 */
interface User {
  id: string;
  email?: string;
}

/**
 * ClaimChat Component
 * 
 * Provides a chat interface for claim negotiations, allowing users to:
 * - Send encrypted messages about a claim
 * - Propose settlement amounts
 * - View negotiation history
 */
const ClaimChat: React.FC<ClaimChatProps> = ({ claimId, claimAmount, status }) => {
  // State for user data
  const [user, setUser] = useState<User | null>(null);
  
  // State for chat data
  const [messages, setMessages] = useState<Message[]>([]);
  const [negotiations, setNegotiations] = useState<Negotiation[]>([]);
  const [currentNegotiation, setCurrentNegotiation] = useState<string | null>(null);
  const [chatItems, setChatItems] = useState<ChatItem[]>([]);
  
  // Form state
  const [newMessage, setNewMessage] = useState('');
  const [proposedAmount, setProposedAmount] = useState('');
  
  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [proposingAmount, setProposingAmount] = useState(false);
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Computed values
  const isClaimSettled = status === 'settled';
  const formattedClaimAmount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(claimAmount);

  /**
   * Scrolls the chat view to the bottom
   */
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  /**
   * Fetches all messages for the current negotiation
   */
  const fetchMessages = useCallback(async () => {
    if (!currentNegotiation) return;
    
    setError(null);
    try {
      const { data, error } = await supabase
        .from('decrypted_chat_messages')
        .select('*')
        .eq('negotiation_id', currentNegotiation)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
      setError('Failed to load messages');
    }
  }, [currentNegotiation]);

  /**
   * Fetches all negotiations for the current claim
   */
  const fetchNegotiations = useCallback(async () => {
    if (!user) return;
    
    setError(null);
    try {
      // First check if the claim exists
      const { data: claims, error: claimError } = await supabase
        .from('claim_headers')
        .select('claim_id')
        .eq('claim_id', claimId);

      if (claimError) throw claimError;
      if (!claims || claims.length === 0) {
        throw new Error('Claim not found');
      }

      // Then fetch negotiations
      const { data: negotiationsData, error: negotiationsError } = await supabase
        .from('negotiations')
        .select('*')
        .eq('claim_id', claimId)
        .order('created_at', { ascending: true });

      if (negotiationsError) throw negotiationsError;

      setNegotiations(negotiationsData || []);
      if (negotiationsData && negotiationsData.length > 0) {
        setCurrentNegotiation(negotiationsData[0].id);
      }
    } catch (error) {
      console.error('Error fetching negotiations:', error);
      setError('Failed to load negotiations');
    } finally {
      setLoading(false);
    }
  }, [user, claimId]);

  /**
   * Sets up real-time subscription to new messages
   * @returns Cleanup function to remove the subscription
   */
  const subscribeToMessages = useCallback(() => {
    if (!currentNegotiation) return () => {};

    // Create a channel for real-time events
    const channel = supabase.channel('messages');
    
    // Subscribe to changes - using try/catch to ignore TS errors
    try {
      channel
        .on(
          // @ts-expect-error - Supabase typing issue
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'decrypted_chat_messages',
            filter: `negotiation_id=eq.${currentNegotiation}`,
          },
          (payload: { new: Message; old: Message | null }) => {
            setMessages((prev) => [...prev, payload.new]);
          }
        )
        .subscribe();
    } catch (e) {
      console.error('Error setting up message subscription:', e);
    }

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentNegotiation]);

  /**
   * Sets up real-time subscription to new negotiations
   * @returns Cleanup function to remove the subscription
   */
  const subscribeToNegotiations = useCallback(() => {
    if (!claimId) return () => {};
    
    // Create a channel for real-time events
    const channel = supabase.channel('negotiations');
    
    // Subscribe to changes - using try/catch to ignore TS errors
    try {
      channel
        .on(
          // @ts-expect-error - Supabase typing issue
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'negotiations',
            filter: `claim_id=eq.${claimId}`,
          },
          (payload: { new: Negotiation; old: Negotiation | null }) => {
            setNegotiations((prev) => [...prev, payload.new]);
            setCurrentNegotiation(payload.new.id);
          }
        )
        .subscribe();
    } catch (e) {
      console.error('Error setting up negotiation subscription:', e);
    }

    return () => {
      supabase.removeChannel(channel);
    };
  }, [claimId]);

  /**
   * Sends a new message in the chat
   */
  const handleSendMessage = async () => {
    if (!newMessage.trim() || sendingMessage || !currentNegotiation || !user) return;
    
    setSendingMessage(true);
    setError(null);

    try {
      const { error } = await supabase
        .from('decrypted_chat_messages')
        .insert({
          negotiation_id: currentNegotiation,
          message: newMessage.trim(),
          user_id: user.id,
        });

      if (error) throw error;
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Failed to send message');
    } finally {
      setSendingMessage(false);
    }
  };

  /**
   * Handles proposing a new settlement amount
   * @param e - Form submission event
   */
  const handleProposeAmount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proposedAmount || isNaN(Number(proposedAmount)) || proposingAmount || isClaimSettled || !user) return;

    setProposingAmount(true);
    setError(null);

    try {
      const { error } = await supabase
        .from('negotiations')
        .insert({
          claim_id: claimId,
          proposed_amount: Number(proposedAmount),
          created_by: user.id,
          status_code: 'PEND',
          status_desc: 'Pending'
        });

      if (error) throw error;
      setProposedAmount('');
    } catch (error) {
      console.error('Error proposing amount:', error);
      setError('Failed to propose amount');
    } finally {
      setProposingAmount(false);
    }
  };

  /**
   * Gets the type of a chat item (message or negotiation)
   * @param item The chat item to check
   * @returns 'message' or 'negotiation'
   */
  const getChatItemType = (item: ChatItem): 'message' | 'negotiation' => {
    return 'message' in item ? 'message' : 'negotiation';
  };

  // Get chat history
  useEffect(() => {
    const fetchChatItems = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get all negotiations for this claim
        const { data: negotiationsData, error: negotiationsError } = await supabase
          .from('claim_negotiations')
          .select('*, creator:created_by(email)')
          .eq('claim_id', claimId);
        
        if (negotiationsError) {
          console.error('Error fetching negotiations:', negotiationsError);
          setError('Failed to load claim negotiations');
          setLoading(false);
          return;
        }
        
        // Format the negotiations data
        const negotiations: Negotiation[] = negotiationsData.map(neg => ({
          id: neg.id,
          claim_id: neg.claim_id,
          proposed_amount: neg.proposed_amount,
          created_by: neg.created_by,
          created_at: neg.created_at,
          status_code: neg.status_code,
          status_desc: neg.status_desc,
          creator_email: neg.creator?.email
        }));
        
        // Get all messages for this claim's negotiations
        const negotiationIds = negotiations.map(n => n.id);
        
        if (negotiationIds.length === 0) {
          setChatItems([]);
          setLoading(false);
          return;
        }
        
        const { data: messagesData, error: messagesError } = await supabase
          .from('claim_negotiation_messages')
          .select('*, sender:user_id(email)')
          .in('negotiation_id', negotiationIds);
        
        if (messagesError) {
          console.error('Error fetching messages:', messagesError);
          setError('Failed to load messages');
          setLoading(false);
          return;
        }
        
        // Format the messages data
        const messages: Message[] = messagesData.map(msg => ({
          id: msg.id,
          negotiation_id: msg.negotiation_id,
          user_id: msg.user_id,
          message: msg.message,
          created_at: msg.created_at,
          user_email: msg.sender?.email
        }));
        
        // Combine and sort all chat items by created_at timestamp
        const allChatItems: ChatItem[] = [
          ...messages.map(msg => ({ ...msg, type: 'message' as const })),
          ...negotiations.map(neg => ({ ...neg, type: 'negotiation' as const }))
        ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        
        setChatItems(allChatItems);
      } catch (error) {
        console.error('Error fetching chat items:', error);
        setError('An error occurred while loading the chat history');
      } finally {
        setLoading(false);
      }
    };
    
    if (claimId) {
      fetchChatItems();
    }
  }, [claimId, claimAmount, user]);

  // Effect to fetch user data
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (currentUser) {
          setUser({
            id: currentUser.id,
            email: currentUser.email || undefined
          });
        }
      } catch (error) {
        console.error('Error fetching user:', error);
        setError('Failed to load user data');
      }
    };

    fetchUser();
  }, []);

  // Effect to fetch negotiations when user is loaded
  useEffect(() => {
    if (user) {
      fetchNegotiations();
    }
  }, [user, fetchNegotiations]);

  // Effect to fetch messages and set up subscriptions when negotiation changes
  useEffect(() => {
    if (user && currentNegotiation) {
      fetchMessages();
      
      const messageCleanup = subscribeToMessages();
      const negotiationCleanup = subscribeToNegotiations();
      
      // Cleanup subscriptions on unmount or when negotiation changes
      return () => {
        messageCleanup();
        negotiationCleanup();
      };
    }
  }, [user, currentNegotiation, fetchMessages, subscribeToMessages, subscribeToNegotiations]);

  // Effect to scroll to bottom when messages or negotiations update
  useEffect(() => {
    scrollToBottom();
  }, [messages, negotiations]);

  // Show loading state while data is being fetched
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <Loader2 className="mr-2 h-6 w-6 animate-spin" />
        <p>Loading chat...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white shadow rounded-lg">
      {/* Chat header */}
      <div className="px-4 py-3 border-b">
        <h3 className="text-lg font-semibold">Claim Negotiation</h3>
        <p className="text-sm text-gray-500">
          Claim ID: {claimId} • Original Amount: {formattedClaimAmount}
          {status && <span className="ml-1 capitalize"> • Status: {status}</span>}
        </p>
      </div>

      {/* Error notification */}
      {error && (
        <div className="p-3 m-2 bg-red-50 text-red-600 rounded-md flex items-center">
          <AlertCircle className="h-5 w-5 mr-2" />
          <span>{error}</span>
        </div>
      )}

      {/* Empty state when no negotiations */}
      {negotiations.length === 0 && !loading && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <DollarSign className="h-12 w-12 text-blue-400 mb-4" />
          <h3 className="text-lg font-medium">No negotiations yet</h3>
          <p className="text-gray-500 mt-2 mb-6 max-w-sm">
            Start the negotiation process by proposing a settlement amount for this claim.
          </p>
          
          {/* Propose amount form */}
          <form onSubmit={handleProposeAmount} className="w-full max-w-xs">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <span className="text-gray-500">$</span>
              </div>
              <input
                type="number"
                value={proposedAmount}
                onChange={(e) => setProposedAmount(e.target.value)}
                className="w-full p-2 pl-8 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Amount to propose"
                disabled={proposingAmount || isClaimSettled}
              />
            </div>
            <button
              type="submit"
              className="w-full mt-2 p-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
              disabled={!proposedAmount || proposingAmount || isClaimSettled}
            >
              {proposingAmount ? (
                <>
                  <Loader2 className="inline-block h-4 w-4 animate-spin mr-1" />
                  Proposing...
                </>
              ) : (
                'Propose Settlement'
              )}
            </button>
          </form>
        </div>
      )}

      {/* Chat messages */}
      {negotiations.length > 0 && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {chatItems.map((item) => {
            // Properly check if the item is from the current user based on its type
            const isCurrentUser = 
              ('user_id' in item && item.user_id === user?.id) || 
              ('created_by' in item && item.created_by === user?.id);
            
            const itemType = getChatItemType(item);
            
            if (itemType === 'message') {
              const message = item as Message;
              return (
                <div 
                  key={message.id}
                  className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[75%] rounded-lg px-4 py-2 ${isCurrentUser ? 'bg-blue-100' : 'bg-gray-100'}`}>
                    <div className="text-sm text-gray-600 mb-1">
                      {message.user_email || 'User'} • {format(new Date(message.created_at), 'MMM d, h:mm a')}
                    </div>
                    <div className="whitespace-pre-wrap break-words">{message.message}</div>
                    <div className="text-xs text-right text-gray-500 mt-1">
                      <Lock className="inline-block h-3 w-3 mr-1" />
                      Encrypted
                    </div>
                  </div>
                </div>
              );
            } else {
              const negotiation = item as Negotiation;
              return (
                <div key={negotiation.id} className="flex justify-center">
                  <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2 max-w-[90%]">
                    <div className="text-sm text-gray-600 mb-1">
                      {negotiation.creator_email || 'User'} • {format(new Date(negotiation.created_at), 'MMM d, h:mm a')}
                    </div>
                    <div className="font-medium text-center">
                      Proposed Settlement: ${negotiation.proposed_amount.toLocaleString()}
                    </div>
                    <div className="text-sm text-center mt-1 capitalize">
                      Status: {negotiation.status_desc}
                    </div>
                  </div>
                </div>
              );
            }
          })}
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Chat input area */}
      {negotiations.length > 0 && (
        <div className="px-4 py-3 border-t">
          {/* Propose amount form */}
          <form onSubmit={handleProposeAmount} className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <span className="text-gray-500">$</span>
              </div>
              <input
                type="number"
                value={proposedAmount}
                onChange={(e) => setProposedAmount(e.target.value)}
                className="w-full p-2 pl-8 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Propose new amount"
                disabled={proposingAmount || isClaimSettled}
              />
            </div>
            <button
              type="submit"
              className="p-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50"
              disabled={!proposedAmount || proposingAmount || isClaimSettled}
            >
              {proposingAmount ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                'Propose'
              )}
            </button>
          </form>

          {/* Send message form */}
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }} 
            className="flex gap-2"
          >
            <TextareaAutosize
              value={newMessage}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewMessage(e.target.value)}
              className="flex-1 p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Type a message..."
              minRows={1}
              maxRows={5}
              disabled={sendingMessage || isClaimSettled}
            />
            <button
              type="submit"
              className="p-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
              disabled={!newMessage.trim() || sendingMessage || isClaimSettled}
            >
              {sendingMessage ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </button>
          </form>
          
          {isClaimSettled && (
            <p className="text-sm text-center mt-2 text-amber-600">
              This claim has been settled. No further messages or proposals can be sent.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default ClaimChat;