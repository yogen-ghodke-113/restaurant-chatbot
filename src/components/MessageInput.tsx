'use client';

import { useState, KeyboardEvent } from 'react';
import { PaperAirplaneIcon } from '@heroicons/react/24/outline';

interface MessageInputProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function MessageInput({ 
  onSendMessage, 
  disabled = false, 
  placeholder = "Type your message..." 
}: MessageInputProps) {
  const [message, setMessage] = useState('');

  const handleSend = () => {
    if (message.trim() && !disabled) {
      onSendMessage(message.trim());
      setMessage('');
    }
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex items-end space-x-3">
      <div className="flex-1">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="w-full px-4 py-3 text-gray-900 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none disabled:bg-gray-50 disabled:text-gray-500 placeholder-gray-500 text-input-override"
          style={{ minHeight: '52px', maxHeight: '120px', color: '#111827', backgroundColor: '#ffffff' }}
        />
      </div>
      
      <button
        onClick={handleSend}
        disabled={!message.trim() || disabled}
        className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
        style={{ minHeight: '52px', minWidth: '52px' }}
      >
        <PaperAirplaneIcon className="w-5 h-5" />
      </button>
    </div>
  );
} 