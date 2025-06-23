'use client';

import { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChatMessage, Place } from '@/types';
import { RestaurantCard } from './RestaurantCard';
import { LoadingSpinner } from './LoadingSpinner';

interface ChatMessagesProps {
  messages: ChatMessage[];
  isLoading?: boolean;
  onSelectRestaurant: (restaurant: Place) => void;
}

export function ChatMessages({ messages, isLoading, onSelectRestaurant }: ChatMessagesProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Custom markdown components for better styling
  const markdownComponents = {
    // Headers with forced dark text to prevent white-on-white
    h1: ({ children }: any) => <h1 className="text-2xl font-bold text-gray-900 mb-4" style={{ color: '#111827' }}>{children}</h1>,
    h2: ({ children }: any) => <h2 className="text-xl font-semibold text-gray-900 mb-3" style={{ color: '#111827' }}>{children}</h2>,
    h3: ({ children }: any) => <h3 className="text-lg font-medium text-gray-900 mb-2" style={{ color: '#111827' }}>{children}</h3>,
    h4: ({ children }: any) => <h4 className="text-base font-medium text-gray-900 mb-2" style={{ color: '#111827' }}>{children}</h4>,
    
    // Paragraphs with forced dark text
    p: ({ children }: any) => <p className="mb-3 text-gray-800 leading-relaxed" style={{ color: '#1f2937' }}>{children}</p>,
    
    // Lists with forced dark text
    ul: ({ children }: any) => <ul className="mb-4 space-y-1 list-disc list-inside text-gray-800" style={{ color: '#1f2937' }}>{children}</ul>,
    ol: ({ children }: any) => <ol className="mb-4 space-y-1 list-decimal list-inside text-gray-800" style={{ color: '#1f2937' }}>{children}</ol>,
    li: ({ children }: any) => <li className="text-gray-800" style={{ color: '#1f2937' }}>{children}</li>,
    
    // Links
    a: ({ href, children }: any) => (
      <a 
        href={href} 
        target="_blank" 
        rel="noopener noreferrer" 
        className="text-blue-600 hover:text-blue-800 underline font-medium"
      >
        {children}
      </a>
    ),
    
    // Code
    code: ({ children }: any) => (
      <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono text-gray-800">
        {children}
      </code>
    ),
    
    // Block quotes
    blockquote: ({ children }: any) => (
      <blockquote className="border-l-4 border-blue-500 pl-4 py-2 mb-4 bg-blue-50 italic text-gray-700">
        {children}
      </blockquote>
    ),
    
    // Strong/Bold with forced dark text
    strong: ({ children }: any) => <strong className="font-semibold text-gray-900" style={{ color: '#111827' }}>{children}</strong>,
    
    // Emphasis/Italic with forced dark text
    em: ({ children }: any) => <em className="italic text-gray-800" style={{ color: '#1f2937' }}>{children}</em>,
    
    // Horizontal rule
    hr: () => <hr className="my-6 border-gray-300" />,
  };

  const getRoleIcon = (role: ChatMessage['role']) => {
    switch (role) {
      case 'user':
        return '👤';
      case 'assistant':
        return '🍽️';
      default:
        return '💬';
    }
  };

  const getRoleStyles = (role: ChatMessage['role']) => {
    switch (role) {
      case 'user':
        return 'bg-blue-50 border-blue-200';
      case 'assistant':
        return 'bg-white border-gray-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="p-6 space-y-6">
        {messages.map((message, index) => (
          <div key={message.id || `message-${index}`} className="flex items-start space-x-3">
            {/* Avatar */}
            <div className="flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-lg">
                {getRoleIcon(message.role)}
              </div>
            </div>

            {/* Message Content */}
            <div className="flex-1 min-w-0">
              <div className={`rounded-lg border p-4 ${getRoleStyles(message.role)}`}>
                {/* Message Text */}
                <div className="prose prose-sm max-w-none">
                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm]}
                    components={markdownComponents}
                  >
                    {message.content || ''}
                  </ReactMarkdown>
                </div>

                {/* Restaurant Cards */}
                {message.metadata?.restaurants && message.metadata.restaurants.length > 0 && (
                  <div className="mt-4 space-y-3">
                    <div className="text-sm font-medium text-gray-600 border-t border-gray-200 pt-3">
                      Restaurant Results:
                    </div>
                    <div className="grid gap-3">
                      {message.metadata.restaurants.slice(0, 5).map((restaurant: Place, index: number) => (
                        <RestaurantCard
                          key={restaurant.id || `restaurant-${index}`}
                          restaurant={restaurant}
                          isSelected={false}
                          onSelect={onSelectRestaurant}
                          rank={index + 1}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Metadata */}
                <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100">
                  <div className="text-xs text-gray-500">
                    {message.metadata?.processingTime && (
                      <span>
                        {message.metadata.processingTime}ms
                      </span>
                    )}
                    {message.metadata?.toolUsed && (
                      <span className="ml-2">
                        • via {message.metadata.toolUsed}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-lg">
                🍽️
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="flex items-center space-x-3">
                  <LoadingSpinner size="sm" />
                  <span className="text-sm text-gray-600">
                    Searching restaurants and analyzing reviews...
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Empty state */}
        {messages.length === 0 && !isLoading && (
          <div className="flex items-center justify-center h-64 text-gray-500">
            <div className="text-center">
              <div className="text-4xl mb-4">🍽️</div>
              <div className="text-lg font-medium">Welcome to Restaurant Finder</div>
              <div className="text-sm">Ask me about restaurants, menus, or recommendations!</div>
            </div>
          </div>
        )}
      </div>

      {/* Scroll anchor */}
      <div ref={messagesEndRef} />
    </div>
  );
} 