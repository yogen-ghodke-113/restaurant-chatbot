'use server';

import { ChatState, ChatMessage, Place } from '@/types';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { buildConversationSummary } from '@/lib/session-utils';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY environment variable is required');
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

/**
 * 🧠 Session Context Manager
 * Analyzes conversation history to understand context for follow-up questions
 */
export async function analyzeSessionContext(
  currentMessage: string,
  chatState: ChatState
): Promise<{
  hasContext: boolean;
  contextType: 'restaurant_reference' | 'location_reference' | 'comparison' | 'follow_up' | 'none';
  resolvedMessage: string;
  extractedContext: {
    referencedRestaurant?: Place;
    impliedLocation?: string;
    previousSearch?: string;
    comparisonItems?: string[];
  };
  confidence: number;
}> {
  try {
    // Skip context analysis for first message or if no history
    if (chatState.messages.length <= 1) {
      return {
        hasContext: false,
        contextType: 'none',
        resolvedMessage: currentMessage,
        extractedContext: {},
        confidence: 0
      };
    }

    // Build conversation history for context
    const conversationHistory = buildConversationSummary(chatState);
    
    const prompt = `You are a session context analyzer for a restaurant chatbot. Analyze the current user message in the context of the conversation history to detect follow-up questions and resolve references.

CONVERSATION HISTORY:
${conversationHistory}

CURRENT USER MESSAGE: "${currentMessage}"

CURRENT CONTEXT:
${chatState.selectedRestaurant ? `- Selected Restaurant: ${chatState.selectedRestaurant.name} (${chatState.selectedRestaurant.rating}★)` : ''}
${chatState.lastTop5.length > 0 ? `- Recent Search Results: ${chatState.lastTop5.map(r => r.name).join(', ')}` : ''}

Analyze if the current message contains:
1. References to "this place", "it", "that restaurant", "the first one", etc.
2. Implied location from previous searches
3. Comparison requests referring to previous results
4. Follow-up questions about menu, reviews, etc.

Return a JSON response with:
{
  "hasContext": boolean,
  "contextType": "restaurant_reference" | "location_reference" | "comparison" | "follow_up" | "none",
  "resolvedMessage": "string - rewrite the message with context resolved",
  "extractedContext": {
    "referencedRestaurant": "restaurant name if referenced",
    "impliedLocation": "location if implied from context", 
    "previousSearch": "previous search terms if relevant",
    "comparisonItems": ["items to compare if comparison detected"]
  },
  "confidence": number between 0-1
}

EXAMPLES:
- "What should I order there?" → resolvedMessage: "What should I order at [RestaurantName]?"
- "Is it expensive?" → resolvedMessage: "Is [RestaurantName] expensive?"
- "What about the second one?" → resolvedMessage: "Tell me about [SecondRestaurantName]"
- "Compare the top 2" → resolvedMessage: "Compare [Restaurant1] vs [Restaurant2]"
- "Any good pizza places?" (after searching Italian in Brooklyn) → resolvedMessage: "Any good pizza places in Brooklyn?"

Be precise and only detect context when you're confident (>0.7).`;

    const generationConfig: any = {
      temperature: 0.1,
      maxOutputTokens: 1000,
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          hasContext: { type: "boolean" },
          contextType: { type: "string" },
          resolvedMessage: { type: "string" },
          extractedContext: {
            type: "object",
            properties: {
              referencedRestaurant: { type: "string" },
              impliedLocation: { type: "string" },
              previousSearch: { type: "string" },
              comparisonItems: { type: "array", items: { type: "string" } }
            }
          },
          confidence: { type: "number" }
        },
        required: ["hasContext", "contextType", "resolvedMessage", "extractedContext", "confidence"]
      }
    };

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-pro',
      generationConfig,
    });

    const result = await model.generateContent(prompt);
    const response = result.response.text();
    
    // Parse structured JSON output
    let analysis;
    try {
      analysis = JSON.parse(response);
    } catch (parseError) {
      console.error('Failed to parse structured session context JSON:', parseError);
      console.error('Raw LLM response:', response);
      
      // Fallback: Try without structured output
      console.log('🔄 Fallback: Using simple session context analysis...');
      try {
        const simplePrompt = `Analyze this message in context: "${currentMessage}"
        
Previous conversation: ${conversationHistory}

Does this message reference a previous restaurant or location? Respond with just:
- NONE if no context needed
- RESTAURANT if it references a previous restaurant  
- LOCATION if it implies a previous location
- FOLLOW_UP if it's a follow-up question`;

        const fallbackModel = genAI.getGenerativeModel({
          model: 'gemini-2.5-pro',
          generationConfig: { temperature: 0.1, maxOutputTokens: 500 },
        });
        
        const fallbackResult = await fallbackModel.generateContent(simplePrompt);
        const fallbackResponse = fallbackResult.response.text().trim().toUpperCase();
        
        // Simple parsing
        const contextType = fallbackResponse.includes('RESTAURANT') ? 'restaurant_reference' :
                           fallbackResponse.includes('LOCATION') ? 'location_reference' :
                           fallbackResponse.includes('FOLLOW_UP') ? 'follow_up' : 'none';
        
        analysis = {
          hasContext: contextType !== 'none',
          contextType,
          resolvedMessage: currentMessage,
          extractedContext: {},
          confidence: 0.5
        };
        
        console.log('✅ Fallback session context succeeded');
        
      } catch (fallbackError) {
        console.error('Fallback session context also failed:', fallbackError);
        
        // Ultimate fallback - no context
        analysis = {
          hasContext: false,
          contextType: 'none',
          resolvedMessage: currentMessage,
          extractedContext: {},
          confidence: 0
        };
      }
    }
    
    console.log('🧠 Session Context Analysis:', {
      original: currentMessage,
      resolved: analysis.resolvedMessage,
      contextType: analysis.contextType,
      confidence: analysis.confidence
    });

    return {
      hasContext: analysis.hasContext || false,
      contextType: analysis.contextType || 'none',
      resolvedMessage: analysis.resolvedMessage || currentMessage,
      extractedContext: analysis.extractedContext || {},
      confidence: analysis.confidence || 0
    };

  } catch (error) {
    console.error('Session context analysis error:', error);
    
    // No fallback - return empty context if LLM fails
    return {
      hasContext: false,
      contextType: 'none',
      resolvedMessage: currentMessage,
      extractedContext: {},
      confidence: 0
    };
  }
}

 