'use client';

import { useChat } from '@/hooks/useChat';
import { ChatMessages } from '@/components/ChatMessages';
import { MessageInput } from '@/components/MessageInput';
import { QuickActions } from '@/components/QuickActions';
import { LoadingSpinner } from '@/components/LoadingSpinner';

export default function Home() {
  const {
    chatState,
    canSendMessage,
    sendMessage,
    handleQuickAction,
    selectRestaurant,
    clearChat,
    getSuggestions,
    getTypingIndicator,
  } = useChat();

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="bg-gray-800/90 backdrop-blur-sm border-b border-gray-700 sticky top-0 z-10 flex-shrink-0">
        <div className="max-w-6xl mx-auto px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
              <div className="text-xl sm:text-2xl">🍽️</div>
              <div className="min-w-0 flex-1">
                <h1 className="text-lg sm:text-xl font-bold text-white truncate">Restaurant Finder</h1>
                <div className="flex items-center space-x-1 sm:space-x-2 text-xs sm:text-sm text-gray-300">
                  <span className="hidden sm:inline">AI-powered dining recommendations</span>
                  <span className="sm:hidden">AI recommendations</span>
                  {chatState.messages.length > 0 && (
                    <>
                      <span className="hidden sm:inline">•</span>
                      <span className="flex items-center space-x-1">
                        <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                        <span className="hidden sm:inline">Session memory active ({chatState.messages.length} messages)</span>
                        <span className="sm:hidden">({chatState.messages.length})</span>
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center ml-2">
              <button
                onClick={clearChat}
                className="px-2 py-2 sm:px-4 text-xs sm:text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors flex items-center space-x-1 sm:space-x-2 border border-red-500"
                title="Clear all cache, cookies, and start fresh"
              >
                <span>🧹</span>
                <span className="hidden sm:inline">Clear All Cache</span>
                <span className="sm:hidden">Clear</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - Flex grow to take remaining space */}
      <div className="flex-1 flex flex-col bg-black">
        {/* Chat Area - Full height minus header/footer */}
        <div className="flex-1 flex justify-center px-2 py-3 sm:px-4 sm:py-6">
          <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-600 overflow-hidden flex-1 flex flex-col min-h-0 max-w-4xl">
            {/* Messages - Take remaining space */}
            <div className="flex-1 overflow-y-auto min-h-0">
              <ChatMessages 
                messages={chatState.messages}
                isLoading={chatState.isLoading}
                onSelectRestaurant={selectRestaurant}
                selectedRestaurant={chatState.selectedRestaurant}
              />
              
              {/* Typing Indicator */}
              {getTypingIndicator() && (
                <div className="px-6 py-4 border-t border-gray-100">
                  <div className="flex items-center space-x-3">
                    <LoadingSpinner size="sm" />
                    <span className="text-sm text-gray-600">{getTypingIndicator()}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Actions - Fixed at bottom */}
            <div className="border-t border-gray-100 p-4 flex-shrink-0">
              <QuickActions
                actions={getSuggestions()}
                onActionClick={handleQuickAction}
              />
            </div>

            {/* Message Input - Fixed at bottom */}
            <div className="border-t border-gray-100 p-4 flex-shrink-0">
              <MessageInput
                onSendMessage={sendMessage}
                disabled={!canSendMessage}
                placeholder={
                  chatState.isLoading 
                    ? "AI is thinking..." 
                    : chatState.selectedRestaurant
                      ? `Ask follow-up questions about ${chatState.selectedRestaurant.name}...`
                      : "Ask about restaurants, menus, or comparisons..."
                }
              />
            </div>
          </div>
        </div>
      </div>

      {/* Footer - Fixed at bottom */}
      <footer className="py-4 border-t border-gray-700 flex-shrink-0 bg-gray-800/50">
        <div className="max-w-4xl mx-auto px-4 text-center text-sm text-gray-400">
          <p>
            Powered by Google Places, Reddit discussions, and AI • Built for food lovers
          </p>
        </div>
      </footer>
    </div>
  );
}
