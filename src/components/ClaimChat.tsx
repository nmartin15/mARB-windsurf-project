import React, { useState, useEffect, useRef } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import { format } from 'date-fns';
import { Send, DollarSign, Loader2, Lock, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Message {
  id: string;
  message: string;
  created_at: string;
  user_id: string;
}

interface Negotiation {
  id: string;
  proposed_amount: number;
  status: string;
  created_at: string;
  created_by: string;
}

interface ClaimChatProps {
  claimId: string;
  claimAmount: number;
  status?: string;
}

export function ClaimChat({ claimId, claimAmount, status }: ClaimChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [negotiations, setNegotiations] = useState<Negotiation[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [proposedAmount, setProposedAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [proposingAmount, setProposingAmount] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [currentNegotiation, setCurrentNegotiation] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const isClaimSettled = status === 'settled' || status === 'paid';

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };

    fetchUser();
    fetchNegotiations();
  }, [claimId]);

  useEffect(() => {
    if (currentNegotiation) {
      fetchMessages();
      subscribeToMessages();
      subscribeToNegotiations();
    }
  }, [currentNegotiation]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, negotiations]);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const subscribeToMessages = () => {
    if (!currentNegotiation) return;

    const messages = supabase
      .channel('chat_messages')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'decrypted_chat_messages',
        filter: `negotiation_id=eq.${currentNegotiation}`,
      }, payload => {
        setMessages(prev => [...prev, payload.new as Message]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(messages);
    };
  };

  const subscribeToNegotiations = () => {
    const negotiations = supabase
      .channel('negotiations')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'negotiations',
        filter: `claim_id=eq.${claimId}`,
      }, payload => {
        setNegotiations(prev => [...prev, payload.new as Negotiation]);
        setCurrentNegotiation(payload.new.id);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(negotiations);
    };
  };

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
    } catch (error) {
      console.error('Error fetching messages:', error);
      setError('Failed to load messages');
    }
  };

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
    } catch (error) {
      console.error('Error fetching negotiations:', error);
      setError('Failed to load negotiations');
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentNegotiation || sendingMessage || isClaimSettled) return;

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
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Failed to send message');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleProposeAmount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proposedAmount || isNaN(Number(proposedAmount)) || proposingAmount || isClaimSettled) return;

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
    } catch (error) {
      console.error('Error proposing amount:', error);
      setError('Failed to propose amount');
    } finally {
      setProposingAmount(false);
    }
  };

  const renderChatItem = (item: Message | Negotiation, type: 'message' | 'negotiation') => {
    const isCurrentUser = item.user_id === user?.id || item.created_by === user?.id;
    const timestamp = format(new Date(item.created_at), 'MMM d, h:mm a');

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

  if (loading) {
    return (
      <div className="flex flex-col h-[600px] bg-white rounded-lg shadow-sm">
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 text-gray-400 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[600px] bg-white rounded-lg shadow-sm">
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

      <div className="flex-1 overflow-y-auto p-4">
        {[...negotiations, ...messages]
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
          .map((item) => (
            <div key={item.id}>
              {renderChatItem(
                item,
                'message' in item ? 'message' : 'negotiation'
              )}
            </div>
          ))}
        <div ref={chatEndRef} />
      </div>

      {isClaimSettled ? (
        <div className="p-4 border-t bg-gray-50">
          <div className="flex items-center justify-center gap-2 text-gray-500">
            <AlertCircle className="h-5 w-5" />
            <span>This claim has been settled. No further negotiations are possible.</span>
          </div>
        </div>
      ) : (
        <div className="p-4 border-t">
          <form onSubmit={handleProposeAmount} className="mb-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="number"
                  value={proposedAmount}
                  onChange={(e) => setProposedAmount(e.target.value)}
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

          <form onSubmit={handleSendMessage} className="flex gap-2">
            <TextareaAutosize
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
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