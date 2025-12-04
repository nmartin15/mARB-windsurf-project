import React, { useState, useRef } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import { Send, Paperclip, X, Loader2, ShieldAlert } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { encryptMessage } from '../../utils/encryption';
import { getThreadKey } from '../../utils/keyManagement';

interface MessageComposerProps {
  threadId: string;
  parentMessageId?: string;
  onSendSuccess?: () => void;
}

/**
 * MessageComposer Component
 * 
 * Provides an interface for composing and sending encrypted messages in a thread
 */
export function MessageComposer({ threadId, parentMessageId, onSendSuccess }: MessageComposerProps) {
  const [message, setMessage] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Handles selecting files for attachment
   */
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const selectedFiles = event.target.files;
    
    if (selectedFiles && selectedFiles.length > 0) {
      // Check if any file exceeds size limit (10MB)
      const hasLargeFile = Array.from(selectedFiles).some(file => file.size > 10 * 1024 * 1024);
      
      if (hasLargeFile) {
        setError('File size must be less than 10MB');
        return;
      }
      
      // Add to current files array
      setFiles(prev => [...prev, ...Array.from(selectedFiles)]);
      
      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  /**
   * Removes a file from the attachments list
   */
  const handleRemoveFile = (index: number) => {
    setFiles(prev => {
      const newFiles = [...prev];
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  /**
   * Handles message sending with encryption
   */
  const handleSendMessage = async () => {
    if (!message.trim() && files.length === 0) return;
    
    try {
      setSending(true);
      setError(null);
      
      // Get thread encryption key
      const threadKey = await getThreadKey(threadId);
      
      // Encrypt message content
      const { encrypted, iv } = encryptMessage(message, threadKey);
      
      // Get current user ID
      const userId = (await supabase.auth.getUser()).data.user?.id;
      if (!userId) {
        throw new Error('User not authenticated');
      }
      
      // Create message record
      const { data: messageData, error: messageError } = await supabase
        .from('messages')
        .insert({
          thread_id: threadId,
          sender_id: userId,
          encrypted_content: encrypted,
          content_iv: iv,
          message_type_code: 'TEXT',
          message_type_desc: 'Text Message',
          parent_message_id: parentMessageId,
          metadata: {
            has_attachments: files.length > 0
          }
        })
        .select()
        .single();
      
      if (messageError) throw messageError;
      
      // Upload attachments if any
      if (files.length > 0 && messageData) {
        await Promise.all(
          files.map(async (file) => {
            // Generate a unique file path
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
            const filePath = `message_attachments/${threadId}/${messageData.id}/${fileName}`;
            
            // Upload file to storage
            const { error: uploadError } = await supabase.storage
              .from('secure_attachments')
              .upload(filePath, file);
            
            if (uploadError) throw uploadError;
            
            // Create attachment record
            const { error: attachmentError } = await supabase
              .from('message_attachments')
              .insert({
                message_id: messageData.id,
                file_name: file.name,
                file_type: file.type,
                file_size: file.size,
                storage_path: filePath,
                content_hash: 'placeholder' // In a production app, generate a real hash
              });
            
            if (attachmentError) throw attachmentError;
          })
        );
      }
      
      // Clear the form
      setMessage('');
      setFiles([]);
      
      // Call success handler
      if (onSendSuccess) {
        onSendSuccess();
      }
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  /**
   * Handles pressing Enter to send
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col">
      {/* Error message */}
      {error && (
        <div className="mb-2 text-sm text-red-600 bg-red-50 p-2 rounded-md">
          {error}
        </div>
      )}
      
      {/* File attachments */}
      {files.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {files.map((file, index) => (
            <div 
              key={index}
              className="flex items-center bg-gray-100 text-gray-800 text-xs rounded px-2 py-1"
            >
              <span className="truncate max-w-[150px]">{file.name}</span>
              <button
                onClick={() => handleRemoveFile(index)}
                className="ml-1 text-gray-500 hover:text-gray-700"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      
      {/* Message input */}
      <div className="flex items-end border rounded-lg overflow-hidden">
        <TextareaAutosize
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 p-3 min-h-[40px] resize-none focus:outline-none"
          placeholder="Type your message here..."
          maxRows={6}
          disabled={sending}
        />
        
        <div className="flex items-center px-2">
          {/* File attachment button */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="hidden"
            multiple
            disabled={sending}
          />
          
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-gray-500 hover:text-gray-700 p-2"
            disabled={sending}
          >
            <Paperclip className="h-5 w-5" />
          </button>
          
          {/* Send button */}
          <button
            onClick={handleSendMessage}
            disabled={(!message.trim() && files.length === 0) || sending}
            className={`p-2 rounded-md ${
              sending || (!message.trim() && files.length === 0)
                ? 'text-gray-400 cursor-not-allowed'
                : 'text-blue-600 hover:text-blue-800'
            }`}
          >
            {sending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>
      
      <p className="text-xs text-gray-500 mt-1 flex items-center">
        <ShieldAlert className="h-3 w-3 mr-1" />
        Messages are encrypted end-to-end for HIPAA compliance
      </p>
    </div>
  );
}
