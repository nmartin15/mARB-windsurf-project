import React, { useState, useEffect, useRef } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import { format } from 'date-fns';
import { Send, DollarSign, Loader2, Lock, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

/**
 * Interface for chat message data structure
 */
interface Message {
  id: string;
  message: string;
  created_at: string;
  user_id: string;
  negotiation_id?: string;
}

/**
 * Interface for negotiation data structure
 */
interface Negotiation {
  id: string;
  proposed_amount: number;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  created_by: string;
  claim_id?: string;
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
 * 
 * @param claimId - Unique identifier for the claim
 * @param claimAmount - Original amount of the claim
 * @param status - Current status of the claim (optional)
 */
export function ClaimChat({ claimId, claimAmount, status }: ClaimChatProps) {
  // State management
  const [messages, setMessages] = useState<Message[]>([]);
  const [negotiations, setNegotiations] = useState<Negotiation[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [proposedAmount, setProposedAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [proposingAmount, setProposingAmount] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [currentNegotiation, setCurrentNegotiation] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Check if the claim is in a final state
  const isClaimSettled = status === 'settled' || status === 'paid';

  /**
   * Initial data loading effect
   * Fetches user data and claim negotiations
   */
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };

    fetchUser();
    fetchNegotiations();
  }, [claimId]);

  /**
   * Effect to load messages and set up subscriptions when negotiation changes
   */
  useEffect(() => {
    if (currentNegotiation) {
      fetchMessages();
      const messageUnsubscribe = subscribeToMessages();
      const negotiationUnsubscribe = subscribeToNegotiations();
      
      // Cleanup subscriptions on unmount or when negotiation changes
      return () => {
        messageUnsubscribe?.();
        negotiationUnsubscribe?.();
      };
    }
  }, [currentNegotiation]);

  /**
   * Effect to scroll to bottom when messages or negotiations update
   */
  useEffect(() => {
    scrollToBottom();
  }, [messages, negotiations]);

  /**
   * Scrolls the chat view to the bottom
   */
  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  /**
   * Sets up real-time subscription to new messages
   * @returns Cleanup function to remove the subscription
   */
  const subscribeToMessages = () => {
    if (!currentNegotiation) return;

    const messages = supabase
      .channel('chat_messages')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'decrypted_chat_messages',
        filter: `negotiation_id=eq.${currentNegotiation}`,
      }, (payload: any) => {
        setMessages((prev: Message[]) => [...prev, payload.new as Message]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(messages);
    };
  };

  /**
   * Sets up real-time subscription to new negotiations
   * @returns Cleanup function to remove the subscription
   */
  const subscribeToNegotiations = () => {
    const negotiations = supabase
      .channel('negotiations')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'negotiations',
        filter: `claim_id=eq.${claimId}`,
      }, (payload: any) => {
        setNegotiations((prev: Negotiation[]) => [...prev, payload.new as Negotiation]);
        setCurrentNegotiation(payload.new.id);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(negotiations);
    };
  };

  /**
   * Fetches all messages for the current negotiation
   */
  const fetchMessages = async () => {
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
    } catch (error: any) {
      console.error('Error fetching messages:', error);
      setError('Failed to load messages');
    }
  };

  /**
   * Fetches all negotiations for the current claim
   */
  const fetchNegotiations = async () => {
    setError(null);
    try {
      // First check if the claim exists
      const { data: claims, error: claimError } = await supabase
        .from('healthcare_claims')
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
    } catch (error: any) {
      console.error('Error fetching negotiations:', error);
      setError('Failed to load negotiations');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handles sending a new message
   * @param e - Form submission event
   */
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentNegotiation || sendingMessage || isClaimSettled || !user) return;

    setSendingMessage(true);
    setError(null);

    try {
      const { error } = await supabase
        .from('chat_messages')
        .insert({
          negotiation_id: currentNegotiation,
          message: newMessage.trim(),
          user_id: user.id,
        });

      if (error) throw error;
      setNewMessage('');
    } catch (error: any) {
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
          status: 'pending'
        });

      if (error) throw error;
      setProposedAmount('');
    } catch (error: any) {
      console.error('Error proposing amount:', error);
      setError('Failed to propose amount');
    } finally {
      setProposingAmount(false);
    }
  };

  /**
   * Determines if a chat item was created by the current user
   * @param item - The chat item to check
   * @returns Boolean indicating if the item was created by the current user
   */
  const isItemFromCurrentUser = (item: ChatItem): boolean => {
    if (!user) return false;
    
    if ('message' in item) {
      // It's a message
      return item.user_id === user.id;
    } else {
      // It's a negotiation
      return item.created_by === user.id;
    }
  };

  /**
   * Renders a chat item (message or negotiation)
   * @param item - The chat item to render
   * @param type - The type of chat item ('message' or 'negotiation')
   * @returns JSX element for the chat item
   */
  const renderChatItem = (item: ChatItem, type: 'message' | 'negotiation') => {
    const isCurrentUser = isItemFromCurrentUser(item);
    const timestamp = format(new Date(item.created_at), 'MMM d, h:mm a');
    
    // Render a negotiation item
    if (type === 'negotiation') {
      const negotiation = item as Negotiation;
      return (
        <div className={`flex flex-col ${isCurrentUser ? 'items-end' : 'items-start'} mb-4`}>
          <div className={`max-w-[80%] rounded-lg p-3 ${
            isCurrentUser ? 'bg-green-100' : 'bg-blue-100'
          }`}>
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4" />
              <span className="font-medium">Proposed Amount: ${negotiation.proposed_amount.toLocaleString()}</span>
            </div>
            <div className="text-sm text-gray-600">
              Status: <span className="capitalize">{negotiation.status}</span>
            </div>
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {timestamp}
          </div>
        </div>
      );
    }
    
    // Render a message item
    const message = item as Message;
    return (
      <div className={`flex flex-col ${isCurrentUser ? 'items-end' : 'items-start'} mb-4`}>
        <div className={`max-w-[80%] rounded-lg p-3 ${
          isCurrentUser ? 'bg-green-100' : 'bg-blue-100'
        }`}>
          <div className="flex items-center gap-2 mb-1">
            <Lock className="h-3 w-3 text-gray-400" />
            <p className="text-gray-800">{message.message}</p>
          </div>
        </div>
        <div className="text-xs text-gray-500 mt-1">
          {timestamp}
        </div>
      </div>
    );
  };

  /**
   * Determines the type of a chat item
   * @param item - The chat item to check
   * @returns 'message' or 'negotiation'
   */
  const getChatItemType = (item: ChatItem): 'message' | 'negotiation' => {
    return 'message' in item ? 'message' : 'negotiation';
  };

  // Show loading state while data is being fetched
  if (loading) {
    return (
      <div className="flex flex-col h-[600px] bg-white rounded-lg shadow-sm">
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 text-gray-400 animate-spin" />
        </div>
      </div>
    );
  }

  // Main component render
  return (
    <div className="flex flex-col h-[600px] bg-white rounded-lg shadow-sm">
      {/* Header section */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Claim Negotiation</h2>
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Lock className="h-3 w-3" />
            <span>End-to-end encrypted</span>
          </div>
        </div>
        <p className="text-sm text-gray-600">
          Original Amount: ${claimAmount.toLocaleString()}
        </p>
        {error && (
          <div className="mt-2 text-sm text-red-600 bg-red-50 rounded-md p-2">
            {error}
          </div>
        )}
      </div>

      {/* Chat messages section */}
      <div className="flex-1 overflow-y-auto p-4">
        {[...negotiations, ...messages]
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
          .map((item) => (
            <div key={item.id}>
              {renderChatItem(
                item,
                getChatItemType(item)
              )}
            </div>
          ))}
        <div ref={chatEndRef} />
      </div>

      {/* Input section - conditional based on claim status */}
      {isClaimSettled ? (
        <div className="p-4 border-t bg-gray-50">
          <div className="flex items-center justify-center gap-2 text-gray-500">
            <AlertCircle className="h-5 w-5" />
            <span>This claim has been settled. No further negotiations are possible.</span>
          </div>
        </div>
      ) : (
        <div className="p-4 border-t">
          {/* Propose amount form */}
          <form onSubmit={handleProposeAmount} className="mb-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="number"
                  value={proposedAmount}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProposedAmount(e.target.value)}
                  placeholder="Propose amount"
                  className="w-full pl-8 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  disabled={proposingAmount}
                />
              </div>
              <button
                type="submit"
                disabled={proposingAmount}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {proposingAmount ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Proposing...
                  </>
                ) : (
                  'Propose'
                )}
              </button>
            </div>
          </form>

          {/* Send message form */}
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <TextareaAutosize
              value={newMessage}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 min-h-[40px] max-h-[120px] disabled:opacity-50 disabled:cursor-not-allowed"
              maxRows={4}
              disabled={sendingMessage || !currentNegotiation}
            />
            <button
              type="submit"
              disabled={sendingMessage || !currentNegotiation}
              className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sendingMessage ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}