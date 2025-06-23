'use server';

import { generateContent } from './gemini';

export interface UserIntent {
  type: 'restaurant_search' | 'restaurant_insights' | 'restaurant_comparison' | 'restaurant_pricing' | 'incomplete_request' | 'context_switch' | 'conversational' | 'follow_up';
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

export async function classifyUserIntent(userMessage: string, conversationContext?: string): Promise<UserIntent> {
  const contextSection = conversationContext ? `
RECENT CONVERSATION CONTEXT:
${conversationContext}

CURRENT USER MESSAGE: "${userMessage}"

⚠️ IMPORTANT: Use the conversation context to determine if the current message is complete or incomplete.
- If location was mentioned recently, don't mark it as missing
- If cuisine was mentioned recently, don't mark it as missing
- Only classify as "incomplete_request" if truly missing information from RECENT context

` : `User message: "${userMessage}"`;

  const prompt = `You are an expert intent classifier for a restaurant recommendation chatbot. Analyze the user's message and classify their intent accurately.

${contextSection}

Classify this into ONE of these intent types (in order of priority):

1. "restaurant_search" - User wants to FIND/DISCOVER restaurants by cuisine, location, or meal type
   ✅ Examples: "best pizza in Manhattan", "Italian restaurants near me", "good brunch spots", "sushi places in Brooklyn", "where can I get tacos?"
   ❌ NOT for: specific restaurant questions, comparisons, or pricing

2. "restaurant_insights" - User wants DETAILED INFO about ONE specific restaurant 
   ✅ Examples: "what should I order at Joe's Pizza?", "tell me about Katz's Deli", "how is the food at Barbounia?", "what do people say about Junior's?", "is Katz's a tourist trap?"
   ❌ NOT for: general searches or comparisons

3. "restaurant_comparison" - User wants to COMPARE 2+ specific restaurants directly
   ✅ Examples: "Katz's vs Pastrami Queen", "compare Joe's Pizza and Prince Street", "which is better: X or Y?", "Thai Villa vs Soothr"
   ❌ NOT for: single restaurant questions

4. "restaurant_pricing" - User asks about COST/VALUE of a specific restaurant
   ✅ Examples: "Is Per Se expensive?", "how much does dinner cost at Le Bernardin?", "is it worth the price?", "what's the average cost?"
   ❌ NOT for: general restaurant questions

5. "incomplete_request" - User wants food/restaurants but MISSING crucial details (cuisine OR location)
   ✅ Examples: "I want pizza" (no location), "I'm hungry" (no cuisine/location), "find me food" (too vague), "good restaurants?" (no specifics)
   ❌ NOT for: complete requests or non-food topics

6. "context_switch" - User is CHANGING their mind or switching topics mid-conversation
   ✅ Examples: "actually I want Chinese instead", "never mind, let's try Italian", "wait, I changed my mind", "forget that, show me sushi"
   ❌ NOT for: first-time requests

7. "follow_up" - User wants MORE DETAILS/ELABORATION about previous responses
   ✅ Examples: "can you elaborate?", "tell me more", "explain that better", "go into more detail", "why is that?", "what do you mean?"
   ❌ NOT for: new topics or greetings

8. "conversational" - EVERYTHING ELSE: greetings, thanks, help, non-restaurant topics
   ✅ Examples: "hi", "hello", "thanks", "that's great", "what can you do?", "how does this work?", "good morning", "I appreciate it"
   ❌ NOT for: restaurant-specific requests

CLASSIFICATION PRIORITY (check in this order):
1. Is it asking for elaboration on a previous response? → follow_up
2. Is it changing/switching topics mid-conversation? → context_switch  
3. Does it compare 2+ specific restaurants? → restaurant_comparison
4. Does it ask about pricing/cost of a specific restaurant? → restaurant_pricing
5. Does it ask about ONE specific restaurant? → restaurant_insights
6. Does it search for restaurants but missing key info? → incomplete_request
7. Does it search for restaurants with sufficient details? → restaurant_search
8. Everything else (greetings, thanks, help, etc.) → conversational

EXTRACT these details when present:
- restaurantName: Full restaurant name (e.g., "Joe's Pizza", "Katz's Delicatessen") - for restaurant_insights & restaurant_pricing
- restaurant1: First restaurant name in comparison - for restaurant_comparison only
- restaurant2: Second restaurant name in comparison - for restaurant_comparison only  
- location: Neighborhood/city (e.g., "Manhattan", "Brooklyn", "NYC") - any geographic reference
- cuisine: Food type (e.g., "pizza", "Italian", "sushi", "Chinese") - any cuisine mentioned
- mealType: Meal timing (e.g., "breakfast", "brunch", "lunch", "dinner") - if specified
- missingInfo: What's missing for incomplete requests - ONLY for incomplete_request intent

CONFIDENCE SCORING:
- 0.95+: Very clear intent with obvious keywords
- 0.85-0.94: Clear intent with good context
- 0.70-0.84: Probable intent but some ambiguity  
- 0.50-0.69: Uncertain, best guess based on available info
- <0.50: Very uncertain classification

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
    "missingInfo": ["location", "cuisine"] // Array of what's missing, only for incomplete_request
  },
  "reasoning": "Brief explanation of classification decision and confidence level"
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
    
    // No fallback - return conversational intent if LLM fails
    return {
      type: 'conversational',
      confidence: 0,
      extractedData: {},
      reasoning: 'LLM analysis failed - defaulting to conversational intent'
    };
  }
} 