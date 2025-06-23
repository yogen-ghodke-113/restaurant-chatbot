'use server';

import { generateContent } from './gemini';

export interface UserIntent {
  type: 'restaurant_search' | 'restaurant_insights' | 'restaurant_comparison' | 'restaurant_pricing' | 'general_help' | 'greeting' | 'incomplete_request' | 'context_switch' | 'unknown';
  confidence: number;
  extractedData: {
    restaurantName?: string;
    restaurant1?: string;
    restaurant2?: string;
    location?: string;
    cuisine?: string;
    mealType?: string;
    missingInfo?: string[]; // What info is missing for incomplete requests
  };
  reasoning: string;
}

export async function classifyUserIntent(userMessage: string): Promise<UserIntent> {
  const prompt = `You are an intent classifier for a restaurant recommendation chatbot. Analyze the user's message and classify their intent.

User message: "${userMessage}"

Classify this into one of these intent types:
1. "restaurant_search" - User wants to find restaurants (e.g., "best pizza in Manhattan", "good brunch spots")
2. "restaurant_insights" - User wants comprehensive info about a specific restaurant including menu recommendations, Reddit opinions, what to order, reviews, etc. (e.g., "what should I order at Joe's Pizza", "what do people on Reddit say about Barbounia", "tell me about Joe's Pizza")
3. "restaurant_comparison" - User wants to compare two or more restaurants (e.g., "Barbounia vs Kyma", "compare Thai Villa and Soothr")
4. "restaurant_pricing" - User asks about pricing or if a restaurant is expensive (e.g., "Is Per Se expensive?", "how much does it cost")
5. "general_help" - User needs help or guidance
6. "greeting" - User is greeting or starting conversation (e.g., "hi", "hello", "hey there")
7. "incomplete_request" - User wants food/restaurants but missing key info (e.g., "I want pizza" without location, "I'm hungry" without specifics)
8. "context_switch" - User is changing their mind or switching topics (e.g., "actually I want spaghetti", "never mind, let's try Chinese")
9. "unknown" - Cannot determine intent or nonsensical message

Extract these details if mentioned:
- restaurantName: Specific restaurant name mentioned
- restaurant1: First restaurant in comparison (for restaurant_comparison type)
- restaurant2: Second restaurant in comparison (for restaurant_comparison type)
- location: Location/neighborhood mentioned (default to "Manhattan" if NYC context)
- cuisine: Type of food mentioned
- mealType: breakfast, brunch, lunch, dinner, etc.
- missingInfo: Array of missing information needed to complete the request (e.g., ["location", "cuisine"])

Respond ONLY with this JSON format:
{
  "type": "intent_type_here",
  "confidence": 0.95,
  "extractedData": {
    "restaurantName": "extracted_name_or_null",
    "restaurant1": "first_restaurant_or_null",
    "restaurant2": "second_restaurant_or_null", 
    "location": "extracted_location_or_null", 
    "cuisine": "extracted_cuisine_or_null",
    "mealType": "extracted_meal_type_or_null",
    "missingInfo": ["location"] // Only for incomplete_request type
  },
  "reasoning": "Brief explanation of why you classified it this way"
}`;

  try {
    const response = await generateContent(prompt, {
      response_mime_type: "application/json",
      response_schema: {
        type: "object",
        properties: {
          type: { type: "string" },
          confidence: { type: "number" },
          extractedData: {
            type: "object",
            properties: {
              restaurantName: { type: "string" },
              restaurant1: { type: "string" },
              restaurant2: { type: "string" },
              location: { type: "string" },
              cuisine: { type: "string" },
              mealType: { type: "string" },
              missingInfo: { type: "array", items: { type: "string" } }
            }
          },
          reasoning: { type: "string" }
        },
        required: ["type", "confidence", "extractedData", "reasoning"]
      },
      maxOutputTokens: 2048  // Increased from default 1024 to prevent JSON truncation
    });
    
    // Parse structured JSON output
    let parsed: UserIntent;
    try {
      parsed = JSON.parse(response) as UserIntent;
    } catch (parseError) {
      console.error('Failed to parse structured JSON response:', parseError);
      console.error('Raw LLM response:', response);
      
      // No fallbacks - this should not happen with structured output
      throw new Error('Structured JSON output failed - this is a critical LLM issue');
    }
    
    // Validate the response structure with more lenient checks
    if (!parsed.type) {
      console.warn('Missing type in parsed response, defaulting to restaurant_search');
      parsed.type = 'restaurant_search';
    }
    
    if (typeof parsed.confidence !== 'number') {
      console.warn('Missing or invalid confidence, defaulting to 0.8');
      parsed.confidence = 0.8;
    }
    
    if (!parsed.extractedData) {
      console.warn('Missing extractedData, setting default');
      parsed.extractedData = {};
    }
    
    if (!parsed.reasoning) {
      console.warn('Missing reasoning, setting default');
      parsed.reasoning = 'Auto-classified based on partial parsing';
    }
    
    // Ensure confidence is between 0 and 1
    parsed.confidence = Math.max(0, Math.min(1, parsed.confidence));
    
    console.log('🧠 LLM Intent Classification:');
    console.log('- Intent:', parsed.type);
    console.log('- Confidence:', parsed.confidence);
    console.log('- Extracted data:', JSON.stringify(parsed.extractedData));
    console.log('- Reasoning:', parsed.reasoning);
    
    return parsed;
    
  } catch (error) {
    console.error('Error in intent classification:', error);
    
    // No fallback - return unknown intent if LLM fails
    return {
      type: 'unknown',
      confidence: 0,
      extractedData: {},
      reasoning: 'LLM analysis failed - unable to classify intent'
    };
  }
} 