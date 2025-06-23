import { ChatState, ChatMessage } from '@/types';

/**
 * Builds a concise conversation summary for context analysis
 */
export function buildConversationSummary(chatState: ChatState): string {
  // Get last 5 messages for context (exclude welcome message)
  const recentMessages = chatState.messages
    .filter(msg => msg.id !== 'welcome')
    .slice(-5);

  if (recentMessages.length === 0) {
    return 'No conversation history.';
  }

  let summary = '';
  recentMessages.forEach((msg, index) => {
    const role = msg.role === 'user' ? 'USER' : 'ASSISTANT';
    const content = msg.content.slice(0, 200); // Truncate long messages
    summary += `${role}: ${content}\n`;
    
    // Add restaurant context if available
    if (msg.metadata?.restaurants && msg.metadata.restaurants.length > 0) {
      const restaurantNames = msg.metadata.restaurants.map(r => r.name).join(', ');
      summary += `[RESTAURANTS SHOWN: ${restaurantNames}]\n`;
    }
  });

  return summary;
}

/**
 * Enhanced conversation context for better understanding
 */
export function buildEnhancedContext(chatState: ChatState): {
  conversationSummary: string;
  currentFocus: string;
  availableReferences: string[];
  sessionStats: {
    messageCount: number;
    restaurantsDiscussed: number;
    lastActivity: string;
  };
} {
  const recentMessages = chatState.messages.filter(msg => msg.id !== 'welcome');
  const allRestaurants = new Set<string>();
  
  // Collect all restaurants mentioned
  recentMessages.forEach(msg => {
    if (msg.metadata?.restaurants) {
      msg.metadata.restaurants.forEach(r => allRestaurants.add(r.name));
    }
  });

  let currentFocus = 'General restaurant discovery';
  if (chatState.selectedRestaurant) {
    currentFocus = `Focused on ${chatState.selectedRestaurant.name}`;
  } else if (chatState.lastTop5.length > 0) {
    currentFocus = `Comparing ${chatState.lastTop5.length} restaurants`;
  }

  const availableReferences = [
    ...(chatState.selectedRestaurant ? [`"this place" (${chatState.selectedRestaurant.name})`] : []),
    ...(chatState.lastTop5.length > 0 ? [`"the first one" (${chatState.lastTop5[0].name})`] : []),
    ...(chatState.lastTop5.length > 1 ? [`"the second one" (${chatState.lastTop5[1].name})`] : []),
  ];

  return {
    conversationSummary: buildConversationSummary(chatState),
    currentFocus,
    availableReferences,
    sessionStats: {
      messageCount: recentMessages.length,
      restaurantsDiscussed: allRestaurants.size,
      lastActivity: recentMessages[recentMessages.length - 1]?.timestamp.toISOString() || 'N/A'
    }
  };
} 