'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChatState, ChatMessage, Place, QuickAction } from '@/types';
import { orchestrate } from '@/actions/simple-orchestrator';
import { generateUUID, clearAllCache, clearChatCache } from '@/lib/utils';

const CHAT_STORAGE_KEY = 'restaurant-chat-state';
const MAX_MESSAGES = 50; // Limit stored messages

// Initial chat state
const initialChatState: ChatState = {
  messages: [],
  selectedRestaurant: undefined,
  lastTop5: [],
  conversationId: generateUUID(),
  isLoading: false,
  error: undefined,
};

// Welcome message
const welcomeMessage: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content: `🍽️ **Welcome to your personal restaurant assistant!**

I can help you discover amazing restaurants, get menu recommendations, and find out what real people are saying about their dining experiences.

**Try asking me:**
• "Best Mediterranean restaurants in Flatiron"
• "What should I order at Joe's Pizza?"
• "Compare Katz's Deli vs Pastrami Queen"
• "Is Per Se expensive?"

What kind of food are you in the mood for today?`,
  timestamp: new Date(),
  metadata: {
    quickActions: [
      {
        text: 'Best Italian in NYC',
        action: 'What are the best Italian restaurants in NYC?',
      },
      {
        text: 'Budget-friendly spots',
        action: 'What are some great budget-friendly restaurants in Manhattan?',
      },
      {
        text: 'Flatiron District dining',
        action: 'What are the best restaurants in Flatiron?',
      },
    ],
  },
};

export function useChat() {
  const [chatState, setChatState] = useState<ChatState>(initialChatState);

  // 🧠 Initialize session with memory support (no automatic cache clearing)
  useEffect(() => {
    const initializeSession = () => {
      console.log('🚀 Initializing chat session with memory support...');
      
      // Start with fresh state but maintain session memory during conversation
      setChatState({
        ...initialChatState,
        conversationId: generateUUID(),
        messages: [welcomeMessage],
      });
      
      console.log('🎉 Chat session ready with session memory enabled!');
    };
    
    initializeSession();
  }, []);

  // Send a message to the chat
  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || chatState.isLoading) return;

    const userMessage: ChatMessage = {
      id: generateUUID(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };

    // Optimistic update - add user message immediately
    setChatState(prev => ({
      ...prev,
      messages: [...prev.messages, userMessage],
      isLoading: true,
      error: undefined,
    }));

    try {
      // Get response from orchestrator with full chat context
      const assistantMessage = await orchestrate(content, {
        ...chatState,
        messages: [...chatState.messages, userMessage] // Include the new user message in context
      });
      
      // Update state with assistant response
      setChatState(prev => {
        const newState = {
          ...prev,
          messages: [...prev.messages, assistantMessage],
          isLoading: false,
        };

        // Update context based on response
        if (assistantMessage.metadata?.restaurants && assistantMessage.metadata.restaurants.length > 0) {
          newState.lastTop5 = assistantMessage.metadata.restaurants.slice(0, 5);
          
          // If user seems to be asking about a specific restaurant, set it as selected
          if (assistantMessage.metadata.restaurants.length === 1) {
            newState.selectedRestaurant = assistantMessage.metadata.restaurants[0];
          }
        }

        // Maintain session context for follow-up questions
        console.log('💾 Session context updated');

        return newState;
      });
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Add error message
      const errorMessage: ChatMessage = {
        id: generateUUID(),
        role: 'assistant',
        content: 'I encountered an error processing your request. Please try again or rephrase your question.',
        timestamp: new Date(),
      };

      setChatState(prev => ({
        ...prev,
        messages: [...prev.messages, errorMessage],
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }));
    }
  }, [chatState]);

  // Handle quick action clicks
  const handleQuickAction = useCallback((action: QuickAction) => {
    sendMessage(action.action);
  }, [sendMessage]);

  // Select a restaurant from the last search results
  const selectRestaurant = useCallback((restaurant: Place) => {
    setChatState(prev => ({
      ...prev,
      selectedRestaurant: restaurant,
    }));
  }, []);

  // Clear the chat and all cache (manual action only)
  const clearChat = useCallback(async () => {
    console.log('🧹 Manual chat clear initiated...');
    
    // Clear all cache, cookies, storage
    await clearAllCache();
    
    // Reset to fresh state
    const newState: ChatState = {
      ...initialChatState,
      conversationId: generateUUID(),
      messages: [welcomeMessage],
    };
    
    setChatState(newState);
    console.log('✨ Chat cleared and reset to fresh state');
  }, []);

  // Get suggestions based on current context
  const getSuggestions = useCallback((): QuickAction[] => {
    const suggestions: QuickAction[] = [];
    
    if (chatState.selectedRestaurant) {
      // Merged menu & Reddit insights button
      suggestions.push({
        text: `Menu & Reddit insights`,
        action: `What should I order at ${chatState.selectedRestaurant.name}?`,
      });
    }

    if (chatState.lastTop5.length >= 2) {
      suggestions.push({
        text: 'Compare top restaurants',
        action: `Compare ${chatState.lastTop5[0].name} vs ${chatState.lastTop5[1].name}`,
      });
    }

    if (suggestions.length === 0) {
      // Default suggestions for new users
      suggestions.push(
        {
          text: 'Best pizza in NYC',
          action: 'What are the best pizza places in NYC?',
        },
        {
          text: 'Great brunch spots',
          action: 'Where can I get great brunch in Manhattan?',
        }
      );
    }

    return suggestions.slice(0, 4); // Limit to 4 suggestions
  }, [chatState.selectedRestaurant, chatState.lastTop5]);

  // Check if user can send message
  const canSendMessage = !chatState.isLoading;

  // Get current typing indicator
  const getTypingIndicator = (): string | null => {
    if (!chatState.isLoading) return null;
    
    const lastMessage = chatState.messages[chatState.messages.length - 1];
    if (lastMessage?.role === 'user') {
      return 'Analyzing conversation context and searching...';
    }
    
    return null;
  };

  // Get message count for display
  const getMessageCount = (): number => {
    return chatState.messages.filter(m => m.id !== 'welcome').length;
  };

  // Export chat as text (for debugging/sharing)
  const exportChat = useCallback((): string => {
    const chatText = chatState.messages
      .map(msg => `${msg.role.toUpperCase()}: ${msg.content}`)
      .join('\n\n');
    
    return `Restaurant Chat Export\nConversation ID: ${chatState.conversationId}\nDate: ${new Date().toISOString()}\n\n${chatText}`;
  }, [chatState]);

  // Get session context info for debugging
  const getSessionInfo = useCallback(() => {
    return {
      conversationId: chatState.conversationId,
      messageCount: getMessageCount(),
      selectedRestaurant: chatState.selectedRestaurant?.name,
      lastTop5: chatState.lastTop5.map(r => r.name),
      sessionDuration: chatState.messages.length > 1 ? 
        Date.now() - chatState.messages[1].timestamp.getTime() : 0
    };
  }, [chatState, getMessageCount]);

  return {
    // State
    chatState,
    canSendMessage,
    
    // Actions
    sendMessage,
    handleQuickAction,
    selectRestaurant,
    clearChat,
    
    // Utilities
    getSuggestions,
    getTypingIndicator,
    getMessageCount,
    exportChat,
    getSessionInfo,
  };
} 