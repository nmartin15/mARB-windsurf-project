/**
 * Type definitions for the Messaging Platform
 */

/**
 * Message Thread
 */
export interface MessageThread {
  id: string;
  subject: string; 
  claim_id?: string;
  created_at: string;
  updated_at: string;
  status_code: string;
  status_desc: string;
  thread_type_code: string;
  thread_type_desc: string;
  priority_code?: string;
  priority_desc?: string;
}

/**
 * Message
 */
export interface Message {
  id: string;
  thread_id: string;
  sender_id: string;
  encrypted_content: string;
  content_iv: string;
  metadata: Record<string, unknown>;
  created_at: string;
  message_type_code: string;
  message_type_desc: string;
  parent_message_id?: string;
  // Not from DB but added after decryption
  decrypted_content?: string;
}

/**
 * Message Attachment
 */
export interface MessageAttachment {
  id: string;
  message_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  encrypted_key?: string;
  uploaded_at: string;
  content_hash: string;
}

/**
 * Thread Participant
 */
export interface ThreadParticipant {
  id: string;
  thread_id: string;
  user_id: string;
  role_code: string;
  role_desc: string;
  added_at: string;
  permissions: {
    can_read: boolean;
    can_write: boolean;
  };
}

/**
 * Settlement Proposal
 */
export interface SettlementProposal {
  id: string;
  thread_id: string;
  message_id?: string;
  claim_id: string;
  proposed_amount: number;
  status_code: string;
  status_desc: string;
  proposer_id: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
  expiration_date?: string;
}

/**
 * Message Read Status
 */
export interface MessageReadStatus {
  id: string;
  message_id: string;
  user_id: string;
  read_at: string;
}

/**
 * Claim reference for thread details
 */
export interface ClaimReference {
  claim_id: string;
  billing_code?: string;
  total_claim_charge_amount?: number;
  claim_filing_indicator_code?: string;
  claim_filing_indicator_desc?: string;
}

/**
 * Thread with Extended Information
 */
export interface ThreadWithDetails extends MessageThread {
  participants: ThreadParticipant[];
  unread_count: number;
  last_message?: Message;
  claim?: ClaimReference;
}

/**
 * Message with User Information
 */
export interface MessageWithUser extends Message {
  user?: {
    id: string;
    email?: string;
    full_name?: string;
    avatar_url?: string;
    organization?: string;
  };
}

/**
 * New Thread Request
 */
export interface NewThreadRequest {
  subject: string;
  claim_id?: string;
  participants: string[];
  initial_message: string;
  thread_type_code?: string;
  priority_code?: string;
}

/**
 * New Message Request
 */
export interface NewMessageRequest {
  thread_id: string;
  content: string;
  parent_message_id?: string;
  message_type_code?: string;
  attachments?: File[];
}

/**
 * New Settlement Proposal Request
 */
export interface NewSettlementProposalRequest {
  thread_id: string;
  claim_id: string;
  proposed_amount: number;
  message?: string;
  expiration_date?: string;
}

/**
 * Thread Participants Update Request
 */
export interface UpdateThreadParticipantsRequest {
  thread_id: string;
  add_participants?: {
    user_id: string;
    role_code?: string;
  }[];
  remove_participants?: string[];
  update_permissions?: {
    user_id: string;
    permissions: {
      can_read?: boolean;
      can_write?: boolean;
    };
  }[];
}
