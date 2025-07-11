'use server';

import { GoogleGenAI } from '@google/genai';
import { 
  ChatState, 
  ChatMessage, 
  GeminiFunctionCall,
  ToolResult,
  QuickAction,
  CustomAPIError
} from '@/types';

// Tool imports
import { searchRestaurants, getRestaurantDetails } from './restaurants';
import { 
  webSearch, 
  searchRedditDiscussions, 
  searchMenuRecommendations,
  searchRestaurantComparison,
  searchRestaurantPricing
} from './search';
import { getRedditData, getRedditComments } from './reddit';
import { explainRanking, compareRestaurants } from '@/lib/scoring';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY environment variable is required');
}

const client = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// Function calling schemas for Gemini (currently disabled for new API migration)
const tools = [
  {
    name: 'searchRestaurants',
    description: 'Find restaurants by cuisine type and location. Returns top 5 rated restaurants with comprehensive scoring.',
    parameters: {
      type: "object",
      properties: {
        cuisine: {
          type: "string",
          description: 'Type of cuisine (e.g., Mediterranean, Italian, Thai, Chinese, Mexican, etc.)',
        },
        location: {
          type: "string", 
          description: 'Location to search (e.g., Flatiron, Manhattan, Brooklyn, NYC)',
        },
      },
      required: ['cuisine', 'location'],
    },
  },
  {
    name: 'webSearch',
    description: 'Search the web for restaurant reviews, menu recommendations, and general information',
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: 'Search query for restaurant information (e.g., "what to order at Joe\'s Pizza")',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'getRedditData',
    description: 'Get Reddit discussions and user experiences about a specific restaurant',
    parameters: {
      type: "object",
      properties: {
        restaurantName: {
          type: "string",
          description: 'Name of the restaurant to search for on Reddit',
        },
        location: {
          type: "string",
          description: 'Location of the restaurant for more specific results (optional)',
        },
      },
      required: ['restaurantName'],
    },
  },
  {
    name: 'compareRestaurants',
    description: 'Compare two restaurants and provide detailed analysis',
    parameters: {
      type: "object",
      properties: {
        restaurant1: {
          type: "string",
          description: 'Name of the first restaurant',
        },
        restaurant2: {
          type: "string",
          description: 'Name of the second restaurant',
        },
        location: {
          type: "string",
          description: 'Location context for the comparison (optional)',
        },
      },
      required: ['restaurant1', 'restaurant2'],
    },
  },
];

/**
 * Main orchestrator function that processes user messages and coordinates tool usage
 */
export async function orchestrate(
  userMessage: string,
  chatState: ChatState
): Promise<ChatMessage> {
  const startTime = Date.now();
  
  try {
    console.log(`Processing user message: "${userMessage}"`);
    
    // For now, use simple content generation - function calling will be added later
    const systemPrompt = createSystemPrompt(chatState);
    const fullPrompt = `${systemPrompt}\n\nUser: ${userMessage}`;
    
    const config = {
      temperature: 0.1,
      maxOutputTokens: 2048,
    };

    const result = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: fullPrompt,
      config: config
    });
    
    let toolResults: ToolResult[] = [];
    let finalResponse = result.text || "I apologize, but I wasn't able to generate a response. Please try again.";
    
    // Generate quick actions based on the response
    const quickActions = generateQuickActions(toolResults, chatState);
    
    const processingTime = Date.now() - startTime;
    
    // Create response message
    const responseMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: finalResponse,
      timestamp: new Date(),
      metadata: {
        restaurants: extractRestaurantsFromTools(toolResults),
        selectedRestaurant: chatState.selectedRestaurant,
        quickActions,
        toolUsed: toolResults[0]?.toolName as any,
        processingTime,
      },
    };

    console.log(`Orchestration completed in ${processingTime}ms`);
    
    return responseMessage;
    
  } catch (error) {
    console.error('Gemini orchestration error:', error);
    
    // No fallback - return error message if Gemini fails
    return {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: "I'm having trouble processing your request right now. Please try rephrasing your question or try again in a moment.",
      timestamp: new Date(),
      metadata: {
        restaurants: [],
        quickActions: [],
        processingTime: Date.now() - Date.now(),
        toolUsed: undefined
      }
    };
  }
}

/**
 * Executes a specific tool function
 */
async function executeTool(toolName: string, args: any): Promise<ToolResult> {
  const startTime = Date.now();
  
  try {
    console.log(`Executing tool: ${toolName} with args:`, args);
    
    let data: any;
    
    switch (toolName) {
      case 'searchRestaurants':
        data = await searchRestaurants(args.cuisine, args.location);
        break;
      
      case 'webSearch':
        data = await webSearch(args.query);
        break;
      
      case 'getRedditData':
        data = await getRedditData(args.restaurantName, args.location);
        break;
      
      case 'compareRestaurants':
        // For comparison, we need to get restaurant data first
        const [restaurants1, restaurants2] = await Promise.all([
          searchRestaurants('restaurant', args.location || 'NYC').then(results => 
            results.find(r => r.name.toLowerCase().includes(args.restaurant1.toLowerCase()))
          ),
          searchRestaurants('restaurant', args.location || 'NYC').then(results => 
            results.find(r => r.name.toLowerCase().includes(args.restaurant2.toLowerCase()))
          )
        ]);
        
        if (restaurants1 && restaurants2) {
          data = {
            comparison: compareRestaurants(restaurants1, restaurants2),
            restaurant1: restaurants1,
            restaurant2: restaurants2
          };
        } else {
          // Fallback to web search comparison
          data = await searchRestaurantComparison(args.restaurant1, args.restaurant2, args.location);
        }
        break;
      
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
    
    const processingTime = Date.now() - startTime;
    
    return {
      toolName,
      success: true,
      data,
      processingTime,
    };
  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    console.error(`Tool execution failed for ${toolName}:`, error);
    
    return {
      toolName,
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Unknown error',
      processingTime,
    };
  }
}

/**
 * Builds conversation history for Gemini context
 */
function buildConversationHistory(chatState: ChatState) {
  // Include last 5 messages for context while managing token usage
  const recentMessages = chatState.messages.slice(-5);
  
  return recentMessages.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }],
  }));
}

/**
 * Creates system prompt with current context
 */
function createSystemPrompt(chatState: ChatState): string {
  let prompt = `You are a helpful restaurant recommendation assistant with thinking capabilities. Think step by step to help users find great restaurants, get menu recommendations, compare options, and discover what people are saying on Reddit about dining experiences.

Key capabilities:
- Search for restaurants by cuisine and location using Google Places data
- Find menu recommendations and what to order through web search
- Get Reddit discussions and real user experiences about restaurants
- Compare restaurants and explain the differences
- Provide pricing information and explain restaurant rankings

RESPONSE STYLE GUIDELINES:
- Keep responses concise but informative (3-5 paragraphs max)
- Use markdown formatting for better readability
- Use emojis sparingly but appropriately (🍕 🌟 💰 📍 etc.)
- Break up text with bullet points, headers, or short sections
- Use **bold** for key info like restaurant names, prices, ratings
- Keep paragraphs short (2-3 sentences max)
- Lead with the most important information first

Always think through the user's request carefully, be helpful, informative, and enthusiastic about food. When presenting restaurant rankings, explain the scoring methodology briefly.`;

  // Add context about selected restaurant
  if (chatState.selectedRestaurant) {
    prompt += `\n\nCurrent context: The user is interested in ${chatState.selectedRestaurant.name} (${chatState.selectedRestaurant.rating}★, ${chatState.selectedRestaurant.userRatingCount || chatState.selectedRestaurant.user_ratings_total} reviews).`;
  }

  // Add context about recent restaurants
  if (chatState.lastTop5.length > 0) {
    const restaurantNames = chatState.lastTop5.map(r => r.name).join(', ');
    prompt += `\n\nRecent restaurant search results: ${restaurantNames}`;
  }

  return prompt;
}

/**
 * Builds synthesis prompt for tool results
 */
function buildSynthesisPrompt(
  userMessage: string, 
  toolResults: ToolResult[], 
  chatState: ChatState
): string {
  let prompt = `Based on the following tool results, provide a comprehensive and helpful response to the user's question: "${userMessage}"

Tool Results:
`;

  toolResults.forEach((result, index) => {
    if (result.success) {
      prompt += `\n${index + 1}. Tool: ${result.toolName}
Data: ${JSON.stringify(result.data, null, 2)}
`;
    } else {
      prompt += `\n${index + 1}. Tool: ${result.toolName} (FAILED)
Error: ${result.error}
`;
    }
  });

  prompt += `\nPlease synthesize this information into a clear, helpful response. Keep responses concise but informative - aim for 3-5 paragraphs maximum.

FORMATTING GUIDELINES:
- Use markdown for better readability
- Use emojis sparingly but appropriately (🍕 🌟 💰 📍 etc.)
- Break up text with bullet points, headers, or short sections
- Use bold (**text**) for key info like restaurant names, prices, ratings
- Keep paragraphs short (2-3 sentences max)
- Lead with the most important information first

If restaurants were found, highlight the top recommendation and explain why it's ranked highly. Include specific details like ratings, review counts, and any relevant information from Reddit or web searches.

If this is a follow-up question about a previously mentioned restaurant, provide more targeted information about that specific place.`;

  return prompt;
}

/**
 * Generates quick action buttons based on the current context
 */
function generateQuickActions(toolResults: ToolResult[], chatState: ChatState): QuickAction[] {
  const actions: QuickAction[] = [];
  
  // If we found restaurants, offer merged menu & Reddit insights
  const restaurantResults = toolResults.find(r => r.toolName === 'searchRestaurants');
  if (restaurantResults?.success && restaurantResults.data?.length > 0) {
    const topRestaurant = restaurantResults.data[0];
    
    // Merged menu & Reddit insights button
    actions.push({
      text: `Menu & Reddit insights`,
      action: `What should I order at ${topRestaurant.name}?`,
    });
    
    if (restaurantResults.data.length > 1) {
      actions.push({
        text: 'Compare top restaurants',
        action: `Compare ${restaurantResults.data[0].name} vs ${restaurantResults.data[1].name}`,
      });
    }
  }
  
  // If we have a selected restaurant, offer more specific actions
  if (chatState.selectedRestaurant) {
    actions.push({
      text: `Is ${chatState.selectedRestaurant.name} expensive?`,
      action: `Is ${chatState.selectedRestaurant.name} expensive?`,
    });
  }
  
  return actions.slice(0, 4); // Limit to 4 quick actions
}

/**
 * Extracts restaurant data from tool results
 */
function extractRestaurantsFromTools(toolResults: ToolResult[]) {
  const restaurantResult = toolResults.find(r => r.toolName === 'searchRestaurants');
  return restaurantResult?.success ? restaurantResult.data : undefined;
}



/**
 * Simple text generation function for use by other modules
 * This is a lightweight wrapper around Gemini's generateContent method
 * Supports both regular text generation and structured JSON output
 */
export async function generateContent(
  prompt: string, 
  options?: {
    response_mime_type?: string;
    response_schema?: any;
    temperature?: number;
    maxOutputTokens?: number;
    enableThinking?: boolean;
  }
): Promise<string> {
  try {
    const config: any = {
      temperature: options?.temperature ?? 0.1,
      maxOutputTokens: options?.maxOutputTokens ?? 1024,
    };

    // Add structured output configuration if provided
    if (options?.response_mime_type) {
      config.responseMimeType = options.response_mime_type;
    }
    
    if (options?.response_schema) {
      config.responseSchema = options.response_schema;
    }

    const result = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: config
    });

    return result.text || "";
  } catch (error) {
    console.error('Error in generateContent:', error);
    throw error;
  }
}

/**
 * Generate content with Google Search grounding using Gemini 2.5 Pro
 * This replaces the need for separate Google Places reviews API calls
 */
export async function generateGroundedContent(
  prompt: string,
  options?: {
    temperature?: number;
    maxOutputTokens?: number;
    enableThinking?: boolean;
  }
): Promise<{
  text: string;
  groundingMetadata?: any;
  searchQueries?: string[];
  citations?: Array<{ url: string; title: string }>;
}> {
  try {
    console.log('🔍 Generating grounded content with Google Search...');
    
    // Create Google Search grounding tool as per new API docs
    const grounding_tool = {
      googleSearch: {}
    };

    const config = {
      tools: [grounding_tool],
      temperature: options?.temperature || 0.1,
      maxOutputTokens: options?.maxOutputTokens || 2048,
    };

    const result = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: config
    });
    
    let searchQueries: string[] = [];
    let citations: Array<{ url: string; title: string }> = [];
    
    // Extract grounding metadata if available
    const groundingMetadata = result.candidates?.[0]?.groundingMetadata;
    
    if (groundingMetadata) {
      console.log('✅ Found grounding metadata');
      
      // Extract search queries
      searchQueries = groundingMetadata.webSearchQueries || [];
      
      // Extract citations from grounding chunks
      const groundingChunks = groundingMetadata.groundingChunks || [];
      citations = groundingChunks.map((chunk: any) => ({
        url: chunk.web?.uri || '',
        title: chunk.web?.title || 'Source'
      })).filter((citation: any) => citation.url);
      
      console.log('📊 Grounding details:', {
        searchQueries: searchQueries.length,
        citations: citations.length
      });
    } else {
      console.log('ℹ️ No grounding metadata - model used existing knowledge');
    }

    return {
      text: result.text || "",
      groundingMetadata,
      searchQueries,
      citations
    };
    
  } catch (error) {
    console.error('Gemini grounded content generation error:', error);
    
    // Fallback: Try without grounding if grounding fails
    console.log('🔄 Fallback: Attempting generation without grounding...');
    try {
      const fallbackResult = await client.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          temperature: options?.temperature || 0.1,
          maxOutputTokens: options?.maxOutputTokens || 2048,
        }
      });
      
      console.log('✅ Fallback generation succeeded (without grounding)');
      return {
        text: fallbackResult.text || "",
        groundingMetadata: undefined,
        searchQueries: [],
        citations: []
      };
      
    } catch (fallbackError) {
      console.error('Fallback generation also failed:', fallbackError);
      throw new CustomAPIError({
        code: 'GROUNDED_CONTENT_ERROR',
        message: 'Failed to generate grounded content and fallback failed',
        details: { error, fallbackError }
      });
    }
  }
} 