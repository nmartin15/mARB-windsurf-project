/**
 * Encryption Utilities for HIPAA-Compliant Messaging
 * 
 * This module provides client-side encryption/decryption functions
 * to ensure PHI (Protected Health Information) is properly secured.
 */

import CryptoJS from 'crypto-js';

/**
 * Generates a random encryption key
 * @returns A hex-encoded random encryption key
 */
export function generateEncryptionKey(): string {
  return CryptoJS.lib.WordArray.random(256/8).toString(CryptoJS.enc.Hex);
}

/**
 * Encrypts message content with AES-256
 * 
 * @param content - The plain text content to encrypt
 * @param key - The encryption key as a hex string
 * @returns Object containing the encrypted content and IV
 */
export function encryptMessage(content: string, key: string): { 
  encrypted: string, 
  iv: string 
} {
  const iv = CryptoJS.lib.WordArray.random(128/8);
  const encrypted = CryptoJS.AES.encrypt(content, key, { 
    iv: iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7
  });
  
  return {
    encrypted: encrypted.toString(),
    iv: iv.toString(CryptoJS.enc.Hex)
  };
}

/**
 * Decrypts encrypted message content
 * 
 * @param encryptedContent - The encrypted message content
 * @param key - The encryption key as a hex string
 * @param iv - The initialization vector used for encryption
 * @returns The decrypted plain text content
 */
export function decryptMessage(encryptedContent: string, key: string, iv: string): string {
  const decrypted = CryptoJS.AES.decrypt(encryptedContent, key, {
    iv: CryptoJS.enc.Hex.parse(iv),
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7
  });
  
  return decrypted.toString(CryptoJS.enc.Utf8);
}

/**
 * Encrypts a file
 * 
 * @param fileData - The file data as an ArrayBuffer
 * @param key - The encryption key
 * @returns Object containing encrypted file and IV
 */
export function encryptFile(fileData: ArrayBuffer, key: string): {
  encryptedFile: ArrayBuffer,
  iv: string
} {
  // Convert ArrayBuffer to WordArray
  const wordArray = CryptoJS.lib.WordArray.create(fileData);
  const iv = CryptoJS.lib.WordArray.random(128/8);
  
  // Encrypt the file data
  const encrypted = CryptoJS.AES.encrypt(wordArray, key, {
    iv: iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7
  });
  
  // Convert encrypted data to ArrayBuffer
  const encryptedBase64 = encrypted.toString();
  const encryptedBinary = atob(encryptedBase64);
  const encryptedBuffer = new ArrayBuffer(encryptedBinary.length);
  const encryptedView = new Uint8Array(encryptedBuffer);
  
  for (let i = 0; i < encryptedBinary.length; i++) {
    encryptedView[i] = encryptedBinary.charCodeAt(i);
  }
  
  return {
    encryptedFile: encryptedBuffer,
    iv: iv.toString(CryptoJS.enc.Hex)
  };
}

/**
 * Decrypts an encrypted file
 * 
 * @param encryptedData - The encrypted file data
 * @param key - The encryption key
 * @param iv - The initialization vector used for encryption
 * @returns The decrypted file as an ArrayBuffer
 */
export function decryptFile(encryptedData: ArrayBuffer, key: string, iv: string): ArrayBuffer {
  // Convert ArrayBuffer to WordArray
  const wordArray = CryptoJS.lib.WordArray.create(encryptedData);
  
  // Decrypt the file data
  const decrypted = CryptoJS.AES.decrypt(
    wordArray.toString(CryptoJS.enc.Base64), 
    key, 
    {
      iv: CryptoJS.enc.Hex.parse(iv),
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    }
  );
  
  // Convert decrypted data to ArrayBuffer
  const decryptedBinary = decrypted.toString(CryptoJS.enc.Latin1);
  const decryptedBuffer = new ArrayBuffer(decryptedBinary.length);
  const decryptedView = new Uint8Array(decryptedBuffer);
  
  for (let i = 0; i < decryptedBinary.length; i++) {
    decryptedView[i] = decryptedBinary.charCodeAt(i);
  }
  
  return decryptedBuffer;
}

/**
 * Generates a secure hash of file content (for integrity verification)
 * 
 * @param fileData - The file data as ArrayBuffer
 * @returns SHA-256 hash of the file content
 */
export function generateFileHash(fileData: ArrayBuffer): string {
  const wordArray = CryptoJS.lib.WordArray.create(fileData);
  return CryptoJS.SHA256(wordArray).toString();
}
