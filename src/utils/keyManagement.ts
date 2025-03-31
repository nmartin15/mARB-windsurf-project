/**
 * Key Management Utilities for HIPAA-Compliant Messaging
 * 
 * This module provides functionality for securely managing encryption keys
 * for the messaging platform.
 */

import CryptoJS from 'crypto-js';
import { supabase } from '../lib/supabase';

/**
 * Derives a user-specific encryption key based on their authentication
 * 
 * @returns A promise resolving to the user's encryption key
 * @throws Error if no authenticated user is found
 */
export async function getUserEncryptionKey(): Promise<string> {
  // Get the current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No authenticated user');
  
  // Create a secure, user-specific key using PBKDF2
  // The key is derived from the user's ID and never stored directly
  const userKey = CryptoJS.PBKDF2(
    user.id, 
    'healthcare-claims-messaging-salt', // In production, use a more secure approach 
    { keySize: 256/32, iterations: 10000 }
  ).toString();
  
  return userKey;
}

/**
 * Gets or creates a thread-specific encryption key
 * 
 * @param threadId - The ID of the message thread
 * @returns The encryption key for the specified thread
 */
export async function getThreadKey(threadId: string): Promise<string> {
  const userKey = await getUserEncryptionKey();
  
  // Check if we already have the thread key in session storage
  const storedKey = sessionStorage.getItem(`thread_key_${threadId}`);
  if (storedKey) return storedKey;
  
  try {
    // Try to retrieve the thread key from the database
    const { data, error } = await supabase
      .from('thread_keys')
      .select('encrypted_key')
      .eq('thread_id', threadId)
      .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
      .single();
    
    if (error) throw error;
    
    if (data?.encrypted_key) {
      // Decrypt the thread key using the user's key
      const decryptedKey = CryptoJS.AES.decrypt(
        data.encrypted_key,
        userKey
      ).toString(CryptoJS.enc.Utf8);
      
      // Store in session storage for future use
      sessionStorage.setItem(`thread_key_${threadId}`, decryptedKey);
      return decryptedKey;
    }
  } catch (error) {
    console.error('Error retrieving thread key:', error);
  }
  
  // If no existing key, generate a new one
  return createThreadKey(threadId);
}

/**
 * Creates a new encryption key for a thread
 * 
 * @param threadId - The ID of the message thread
 * @returns The newly created thread key
 */
async function createThreadKey(threadId: string): Promise<string> {
  // Generate a random key for the thread
  const threadKey = CryptoJS.lib.WordArray.random(256/8).toString(CryptoJS.enc.Hex);
  const userKey = await getUserEncryptionKey();
  
  try {
    // Encrypt the thread key with the user's key
    const encryptedKey = CryptoJS.AES.encrypt(threadKey, userKey).toString();
    
    // Store the encrypted thread key in the database
    await supabase.from('thread_keys').insert({
      thread_id: threadId,
      user_id: (await supabase.auth.getUser()).data.user?.id,
      encrypted_key: encryptedKey,
      created_at: new Date().toISOString()
    });
    
    // Store in session storage for future use
    sessionStorage.setItem(`thread_key_${threadId}`, threadKey);
    return threadKey;
  } catch (error) {
    console.error('Error creating thread key:', error);
    // Fallback: derive a key from the thread ID and user key
    // This is less secure but prevents total failure
    return CryptoJS.HmacSHA256(threadId, userKey).toString();
  }
}

/**
 * Shares a thread key with another user
 * 
 * @param threadId - The thread ID
 * @param recipientId - The recipient's user ID
 * @returns Promise resolving to true if successful
 */
export async function shareThreadKey(threadId: string, recipientId: string): Promise<boolean> {
  try {
    // Get the thread key
    const threadKey = await getThreadKey(threadId);
    
    // Get recipient's public key (in a real system)
    // This is simplified - a production system would use asymmetric encryption
    const { data: recipientData } = await supabase
      .from('user_profiles')
      .select('user_id')
      .eq('id', recipientId)
      .single();
    
    if (!recipientData) return false;
    
    // For demonstration purposes - in production, encrypt with recipient's public key
    // Here we're using a shared secret approach which isn't ideal for production
    const sharedSecret = CryptoJS.SHA256(recipientId + threadId).toString();
    const encryptedKey = CryptoJS.AES.encrypt(threadKey, sharedSecret).toString();
    
    // Store the encrypted key for the recipient
    await supabase.from('thread_keys').insert({
      thread_id: threadId,
      user_id: recipientId,
      encrypted_key: encryptedKey,
      created_at: new Date().toISOString()
    });
    
    return true;
  } catch (error) {
    console.error('Error sharing thread key:', error);
    return false;
  }
}

/**
 * Clears thread key from session storage on logout
 */
export function clearThreadKeys(): void {
  // Find all session storage keys related to thread keys
  Object.keys(sessionStorage).forEach(key => {
    if (key.startsWith('thread_key_')) {
      sessionStorage.removeItem(key);
    }
  });
}
