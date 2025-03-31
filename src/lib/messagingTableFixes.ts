import { v4 as uuidv4 } from 'uuid';
import { supabase, usingMockData } from './supabase';
import { ThreadWithDetails, MessageWithUser, ClaimReference, ThreadParticipant, Message } from '../types/messaging';

/**
 * This file provides mock data and helper functions for the messaging system
 * when database tables are not yet available.
 * 
 * It follows the established schema standardization with _code and _desc suffix pairs
 * as documented in database_schema.md
 */

/**
 * Initialization function to set up any required data or connections for messaging
 * Called when the application starts
 */
export async function initMessagingTableFixes(): Promise<void> {
  if (usingMockData) {
    console.log('[Mock Mode] Initializing messaging system with mock data');
    return;
  }
  
  try {
    // In a real implementation, we might pre-fetch some data or validate
    // the database schema to ensure it matches our expected structure
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) {
      console.warn('No authenticated user found during messaging initialization');
    }
    
    // This is where we'd validate that the database has the proper schema
    // with _code/_desc suffix pairs as per the standardization requirements
    console.log('Messaging system initialized with database connection');
  } catch (error) {
    console.error('Failed to initialize messaging system:', error);
    throw error;
  }
}

/**
 * Get the current authenticated user ID from Supabase
 * Falls back to a mock ID when in development mode
 */
export async function getCurrentUserId(): Promise<string | undefined> {
  try {
    const { data } = await supabase.auth.getUser();
    return data?.user?.id;
  } catch (error) {
    console.warn('Failed to get auth user:', error);
    // In development mode with mock data, return a mock user ID
    return usingMockData ? 'mock-user-id-123' : undefined;
  }
}

// Type definition for claim status entries to ensure schema compliance
type ClaimStatus = {
  status_code: string;
  status_desc: string;
};

// Mock claim statuses following the _code/_desc pattern
export const MOCK_CLAIM_STATUSES: Record<string, ClaimStatus> = {
  DENIED: { status_code: 'DENIED', status_desc: 'Claim Denied' },
  REJECTED: { status_code: 'REJECTED', status_desc: 'Claim Rejected' },
  APPEALED: { status_code: 'APPEALED', status_desc: 'Claim Appealed' },
  APPROVED: { status_code: 'APPROVED', status_desc: 'Claim Approved' },
  PENDING: { status_code: 'PENDING', status_desc: 'Claim Pending' },
  IN_REVIEW: { status_code: 'IN_REVIEW', status_desc: 'Claim In Review' }
};

// Type definition for filing indicator entries to ensure schema compliance
type FilingIndicator = {
  claim_filing_indicator_code: string;
  claim_filing_indicator_desc: string;
};

// Mock claim filing indicators following the _code/_desc pattern 
export const MOCK_FILING_INDICATORS: Record<string, FilingIndicator> = {
  ELECTRONIC: { claim_filing_indicator_code: '1', claim_filing_indicator_desc: 'Electronic' },
  PAPER: { claim_filing_indicator_code: '2', claim_filing_indicator_desc: 'Paper' },
  PORTAL: { claim_filing_indicator_code: '3', claim_filing_indicator_desc: 'Portal Submission' },
  EDI: { claim_filing_indicator_code: '4', claim_filing_indicator_desc: 'EDI Transmission' }
};

/**
 * Generate mock claims that follow the schema standardization pattern
 * with proper _code and _desc suffix pairs
 * 
 * @param count Number of mock claims to generate
 * @returns Array of ClaimReference objects with standardized field names
 */
export function generateMockClaims(count: number = 10): ClaimReference[] {
  const claims: ClaimReference[] = [];
  
  for (let i = 0; i < count; i++) {
    const filingKeys = Object.keys(MOCK_FILING_INDICATORS);
    const filingKey = filingKeys[i % filingKeys.length];
    const filingIndicator = MOCK_FILING_INDICATORS[filingKey];
    
    if (!filingIndicator) continue; // Skip if no valid indicator (shouldn't happen)
    
    claims.push({
      claim_id: `CLM-${100000 + i}`,
      billing_code: `B${400000 + i}`,
      total_claim_charge_amount: 100.0 + (i * 25.5),
      claim_filing_indicator_code: filingIndicator.claim_filing_indicator_code,
      claim_filing_indicator_desc: filingIndicator.claim_filing_indicator_desc
    });
  }
  
  return claims;
}

/**
 * Get mock claims filtered by status codes
 * @returns Filtered mock claims that need settlement
 */
export function getMockClaimsByStatus(): ClaimReference[] {
  // In a real implementation, we would filter by status_code
  // For now, we'll just return a subset of the claims
  const allClaims = generateMockClaims(20);
  
  // We don't have status fields in ClaimReference per the interface,
  // so we'll simulate filtering based on claim IDs (evens vs odds)
  return allClaims.filter((_, index) => index % 3 === 0); // Return every third claim
}

/**
 * Get denied, rejected, and appealed claims for settlement purposes
 * @returns Claims that need settlement according to their status
 */
export function getClaimsNeedingSettlement(): ClaimReference[] {
  // In a real implementation, we would filter by status_code
  // For now, just return a subset of claims
  return getMockClaimsByStatus();
}

/**
 * Helper function to generate random content for mock messages
 * @param threadIndex Index of the thread to help determine message content
 * @param messageIndex Index of the message within the thread
 * @returns A contextually appropriate message string
 */
function getRandomMessageContent(threadIndex: number, messageIndex: number): string {
  const messageTemplates = [
    "I have a question about this claim. Can you explain why it was denied?",
    "We need to discuss the status of this claim. It seems there may have been an error in processing.",
    "I'd like to appeal this decision. The provided service was medically necessary.",
    "Could you provide more details about why this claim was rejected?",
    "I believe this claim should be reconsidered based on the following information...",
    "Let's work together to find a resolution for this claim.",
    "I'm proposing a settlement amount of $X for this claim.",
    "I've attached additional documentation to support this claim.",
    "Can we schedule a call to discuss this claim in more detail?",
    "Thank you for your help with resolving this matter."
  ];
  
  return messageTemplates[(threadIndex + messageIndex) % messageTemplates.length];
}

/**
 * Generate mock message threads with proper schema standardization
 * 
 * @param count Number of mock threads to generate
 * @returns Array of ThreadWithDetails objects with standardized field names
 */
export function generateMockMessageThreads(count: number = 5): ThreadWithDetails[] {
  const currentUserId = 'mock-user-id-123';
  const threads: ThreadWithDetails[] = [];
  const claimsForThreads = generateMockClaims(count);
  
  for (let i = 0; i < count; i++) {
    const threadId = `thread-${uuidv4()}`;
    const otherUserId = `user-${i}-${uuidv4().substring(0, 8)}`;
    
    // Create mock participants following schema standards
    const participants: ThreadParticipant[] = [
      {
        id: `participant-${uuidv4()}`,
        thread_id: threadId,
        user_id: currentUserId,
        role_code: 'MEMBER',
        role_desc: 'Health Plan Member',
        added_at: new Date(Date.now() - (86400000 * 5)).toISOString(),
        permissions: {
          can_read: true,
          can_write: true
        }
      },
      {
        id: `participant-${uuidv4()}`,
        thread_id: threadId,
        user_id: otherUserId, 
        role_code: 'PROVIDER',
        role_desc: 'Healthcare Provider',
        added_at: new Date(Date.now() - (86400000 * 5)).toISOString(),
        permissions: {
          can_read: true,
          can_write: true
        }
      }
    ];
    
    // Generate a few mock messages for each thread
    const messagesList: MessageWithUser[] = [];
    const messageCount = 1 + Math.floor(Math.random() * 5); // 1-5 messages
    
    for (let j = 0; j < messageCount; j++) {
      const isFromCurrentUser = j % 2 === 0;
      const senderId = isFromCurrentUser ? currentUserId : otherUserId;
      const messageContent = getRandomMessageContent(i, j);
      
      messagesList.push({
        id: `msg-${uuidv4()}`,
        thread_id: threadId,
        sender_id: senderId,
        encrypted_content: `Encrypted: ${messageContent}`,
        content_iv: 'mock-iv',
        metadata: {},
        message_type_code: 'TEXT',
        message_type_desc: 'Text Message',
        created_at: new Date(Date.now() - ((messageCount - j) * 3600000)).toISOString(),
        decrypted_content: messageContent,
        user: {
          id: senderId,
          email: isFromCurrentUser ? 'you@example.com' : `provider${i + 1}@example.com`,
          full_name: isFromCurrentUser ? 'You' : `Provider ${i + 1}`,
          avatar_url: undefined
        }
      });
    }
    
    // Create the most recent message as the last message
    const lastMessage: Message | undefined = messagesList.length > 0 ? {
      id: messagesList[messagesList.length - 1].id,
      thread_id: threadId,
      sender_id: messagesList[messagesList.length - 1].sender_id,
      encrypted_content: messagesList[messagesList.length - 1].encrypted_content,
      content_iv: 'mock-iv',
      metadata: {},
      message_type_code: 'TEXT',
      message_type_desc: 'Text Message',
      created_at: messagesList[messagesList.length - 1].created_at,
      decrypted_content: messagesList[messagesList.length - 1].decrypted_content
    } : undefined;
    
    // Add a thread with associated claim for each one
    threads.push({
      id: threadId,
      subject: `Discussion about claim #${claimsForThreads[i].claim_id}`,
      created_at: new Date(Date.now() - (86400000 * 5)).toISOString(),
      updated_at: new Date(Date.now() - (3600000 * (5 - i))).toISOString(),
      status_code: 'ACTIVE',
      status_desc: 'Active Thread',
      thread_type_code: 'GENERAL',
      thread_type_desc: 'General Discussion',
      claim_id: claimsForThreads[i].claim_id,
      participants,
      unread_count: Math.floor(Math.random() * 3),
      claim: claimsForThreads[i],
      last_message: lastMessage
    });
  }
  
  return threads;
}

/**
 * Function to create a new message thread, with mock support
 * 
 * @param subject Thread subject
 * @param initialMessage First message content
 * @param participantIds Array of user IDs to add as participants
 * @param claimReference Optional claim to associate with the thread
 * @returns Newly created thread or undefined if creation failed
 */
export async function createMessageThread(
  subject: string, 
  initialMessage: string, 
  participantIds: string[],
  claimReference?: ClaimReference
): Promise<ThreadWithDetails | undefined> {
  // For development with mock data
  if (usingMockData) {
    const threadId = `thread-${uuidv4()}`;
    const currentUserId = await getCurrentUserId() || 'mock-user-id-123';
    
    const participants: ThreadParticipant[] = participantIds.map(userId => ({
      id: `participant-${uuidv4()}`,
      thread_id: threadId,
      user_id: userId,
      role_code: userId === currentUserId ? 'MEMBER' : 'PROVIDER',
      role_desc: userId === currentUserId ? 'Health Plan Member' : 'Healthcare Provider',
      added_at: new Date().toISOString(),
      permissions: {
        can_read: true,
        can_write: true
      }
    }));
    
    const message: MessageWithUser = {
      id: `msg-${uuidv4()}`,
      thread_id: threadId,
      sender_id: currentUserId,
      encrypted_content: `Encrypted: ${initialMessage}`,
      content_iv: 'mock-iv',
      metadata: {},
      message_type_code: 'TEXT',
      message_type_desc: 'Text Message',
      created_at: new Date().toISOString(),
      decrypted_content: initialMessage,
      user: {
        id: currentUserId,
        email: 'you@example.com',
        full_name: 'You',
        avatar_url: undefined
      }
    };
    
    const newThread: ThreadWithDetails = {
      id: threadId,
      subject,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status_code: 'ACTIVE',
      status_desc: 'Active Thread',
      thread_type_code: 'GENERAL',
      thread_type_desc: 'General Discussion',
      claim_id: claimReference?.claim_id,
      participants,
      unread_count: 0,
      claim: claimReference,
      last_message: message
    };
    
    console.debug("[Mock Mode] Created new message thread:", threadId);
    return newThread;
  }
  
  // Real implementation would be here, using supabase to create a new thread
  // and associated records in the database
  return undefined;
}

/**
 * Function to start a settlement discussion from a claim, with mock support
 * 
 * @param claim The claim to discuss settlement for
 * @param message Initial message content
 * @returns Newly created thread for the settlement discussion
 */
export async function startSettlementDiscussion(
  claim: ClaimReference, 
  message: string
): Promise<ThreadWithDetails | undefined> {
  const currentUserId = await getCurrentUserId();
  if (!currentUserId) return undefined;
  
  // For mock implementation
  const subject = `Settlement for claim #${claim.claim_id}`;
  
  // Here we would typically get the provider ID from the claim
  // For mock, we'll create a mock provider ID
  const providerId = 'mock-provider-123';
  
  return createMessageThread(
    subject,
    message,
    [currentUserId, providerId],
    claim
  );
}
