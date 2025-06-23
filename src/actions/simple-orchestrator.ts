'use server';

import { 
  ChatState, 
  ChatMessage, 
  QuickAction,
  Place
} from '@/types';
import { classifyUserIntent } from './intent-classifier';
import { analyzeSessionContext } from './session-context';
import { searchRestaurants } from './restaurants';
import { explainRanking } from '@/lib/scoring';
import { generateGroundedContent } from './gemini';

/**
 * Enhanced conversational context builder
 */
function buildEnhancedContext(chatState: ChatState) {
  const recentMessages = chatState.messages.slice(-3);
  const conversationSummary = recentMessages.map(msg => 
    `${msg.role.toUpperCase()}: ${msg.content}`
  ).join('\n');
  
  const restaurantsDiscussed = chatState.lastTop5.length;
  const hasSelectedRestaurant = !!chatState.selectedRestaurant;
  
  return {
    conversationSummary,
    currentFocus: hasSelectedRestaurant 
      ? `Discussing ${chatState.selectedRestaurant?.name}` 
      : 'General restaurant discovery',
    availableReferences: chatState.lastTop5.map(r => r.name),
    sessionStats: {
      messageCount: chatState.messages.length,
      restaurantsDiscussed,
      lastActivity: new Date().toISOString()
    }
  };
}

/**
 * Main orchestrator function implementing the new simplified flow:
 * 1. Restaurant Search → Google Places API (visual cards)
 * 2. Reddit Tool → Web search + Reddit API + LLM analysis  
 * 3. Google Search Tool → Gemini 2.5 Pro with grounding (built-in)
 * 4. Quick Actions for selected restaurants
 * 5. Direct prompting for comparison/specific questions
 */
export async function orchestrate(
  userMessage: string,
  chatState: ChatState
): Promise<ChatMessage> {
  const startTime = Date.now();
  
  try {
    console.log(`Processing user message: "${userMessage}"`);
    
    // 🧠 STEP 1: Analyze session context for follow-up questions
    console.log('🔍 Analyzing session context...');
    const contextAnalysis = await analyzeSessionContext(userMessage, chatState);
    
    // Use resolved message if context was detected
    const processedMessage = contextAnalysis.hasContext 
      ? contextAnalysis.resolvedMessage 
      : userMessage;
    
    console.log(`🧠 Context: ${contextAnalysis.contextType} (confidence: ${contextAnalysis.confidence})`);
    
    // 🎯 STEP 2: Classify intent using the resolved message
    const intent = await classifyUserIntent(processedMessage);
    console.log(`🎯 Classified intent: ${intent.type} (confidence: ${intent.confidence})`);
    
    let response = '';
    let restaurants: any[] = [];
    let quickActions: QuickAction[] = [];
    let selectedRestaurant: Place | undefined;
    
    // 📊 STEP 3: Build enhanced context for better understanding
    const enhancedContext = buildEnhancedContext(chatState);
    console.log('📊 Enhanced context built');
    
    // Handle different intent types with enhanced conversation
    
    // Greeting - friendly welcome
    if (intent.type === 'greeting') {
      const greetings = [
        "Hi there! 👋 I'm your friendly restaurant assistant. How can I help you discover amazing food today?",
        "Hello! 🍽️ Ready to find some delicious restaurants? I can help you search, get menu recommendations, or find Reddit reviews!",
        "Hey! 😊 Looking for a great place to eat? I'm here to help with restaurant recommendations in NYC and beyond!",
        "Good to see you! 🌟 What kind of culinary adventure are you in the mood for today?"
      ];
      
      response = greetings[Math.floor(Math.random() * greetings.length)];
      
      // Add quick action suggestions
      quickActions = [
        { text: "Find pizza places", action: "best pizza in Manhattan" },
        { text: "Brunch spots", action: "good brunch in Brooklyn" },
        { text: "Surprise me!", action: "trending restaurants NYC" }
      ];
    }
    
    // Incomplete request - ask for missing information
    else if (intent.type === 'incomplete_request') {
      const cuisine = intent.extractedData.cuisine;
      const missingInfo = intent.extractedData.missingInfo || [];
      
      if (cuisine && missingInfo.includes('location')) {
        response = `Great choice! 🍕 I'd love to help you find amazing ${cuisine} places. Where would you like me to search? 📍`;
        
        // Add location suggestions as quick actions
        quickActions = [
          { text: "Manhattan", action: `best ${cuisine} in Manhattan` },
          { text: "Brooklyn", action: `best ${cuisine} in Brooklyn` },
          { text: "Queens", action: `best ${cuisine} in Queens` },
          { text: "Near me", action: `${cuisine} restaurants near me` }
        ];
      } else if (missingInfo.includes('cuisine')) {
        response = `I can help you find great food! What type of cuisine are you in the mood for? 🤔`;
        
        // Add cuisine suggestions as quick actions
        quickActions = [
          { text: "Pizza", action: "best pizza restaurants" },
          { text: "Italian", action: "Italian restaurants" },
          { text: "Asian", action: "Asian restaurants" },
          { text: "Mexican", action: "Mexican restaurants" }
        ];
      } else {
        response = `I'd love to help you find great food! Could you tell me what type of cuisine you're craving and where you'd like to eat? 🍽️`;
        
        quickActions = [
          { text: "Pizza in Manhattan", action: "best pizza in Manhattan" },
          { text: "Brunch in Brooklyn", action: "good brunch in Brooklyn" },
          { text: "Italian in Queens", action: "Italian restaurants in Queens" }
        ];
      }
    }
    
    // Context switch - acknowledge change and start fresh
    else if (intent.type === 'context_switch') {
      const newCuisine = intent.extractedData.cuisine;
      
      if (newCuisine) {
        response = `No problem! 🔄 Let's find you some great ${newCuisine} instead. Where would you like me to search?`;
        
        quickActions = [
          { text: "Manhattan", action: `best ${newCuisine} in Manhattan` },
          { text: "Brooklyn", action: `best ${newCuisine} in Brooklyn` },
          { text: "Queens", action: `best ${newCuisine} in Queens` }
        ];
        
        // Clear previous search context for fresh start
        if (chatState.lastTop5) {
          chatState.lastTop5 = [];
        }
        if (chatState.selectedRestaurant) {
          chatState.selectedRestaurant = undefined;
        }
      } else {
        response = `Of course! 🔄 What would you like to search for instead?`;
        
        quickActions = [
          { text: "Pizza", action: "best pizza restaurants" },
          { text: "Sushi", action: "best sushi restaurants" },
          { text: "Italian", action: "Italian restaurants" },
          { text: "Mexican", action: "Mexican restaurants" }
        ];
      }
    }
    
    // Restaurant search with Google Places API (visual cards)
    else if (intent.type === 'restaurant_search') {
      console.log('🏪 Restaurant search intent detected');
      
      const cuisine = intent.extractedData.cuisine || intent.extractedData.mealType || 'restaurants';
      const location = intent.extractedData.location || 
                      contextAnalysis.extractedContext.impliedLocation || 
                      'Manhattan'; // Default to Manhattan
      
      if (cuisine && location) {
        try {
          restaurants = await searchRestaurants(cuisine, location);
          console.log('✅ Google Places API succeeded');
          
          if (restaurants.length > 0) {
            const contextPrefix = contextAnalysis.hasContext 
              ? `Based on our conversation, here are ` 
              : `I found `;
            
            response = `🍽️ **${contextPrefix}${restaurants.length} excellent ${cuisine} restaurants in ${location}:**\n\n`;
            
            restaurants.forEach((restaurant, index) => {
              const priceLevel = restaurant.priceLevel || restaurant.price_level;
              const priceEmoji = priceLevel 
                ? ['💵', '💰', '💸', '💎'][priceLevel - 1] 
                : '💰';
              
              const reviewCount = restaurant.userRatingCount || restaurant.user_ratings_total || 0;
              const address = restaurant.formattedAddress || restaurant.vicinity || 'Address not available';
              
              response += `**${index + 1}. ${restaurant.name}** ${priceEmoji}\n`;
              response += `⭐ ${restaurant.rating}★ (${reviewCount.toLocaleString()} reviews)\n`;
              response += `📍 ${address}\n\n`;
            });
            
            response += `\n${explainRanking(restaurants)}`;
            
            // Generate quick actions for top restaurant - using merged intent
            const topRestaurant = restaurants[0];
            quickActions = [
              {
                text: `Menu & Reddit insights`,
                action: `What should I order at ${topRestaurant.name}?`
              }
            ];
            
            // Add comparison if we have multiple restaurants
            if (restaurants.length > 1) {
              quickActions.push({
                text: `⚖️ Compare top restaurants`,
                action: `Compare ${restaurants[0].name} vs ${restaurants[1].name} in ${location}`
              });
            }
            

          } else {
            response = `I couldn't find any ${cuisine} restaurants in ${location}. Try a different cuisine type or location.`;
          }
        } catch (error) {
          console.error('Restaurant search failed:', error);
          response = `I'm having trouble finding restaurants right now. Please try again in a moment.`;
        }
      }
    }
    
    // Restaurant insights - comprehensive menu recommendations + Reddit discussions + reviews
    else if (intent.type === 'restaurant_insights') {
      console.log('🍕 Restaurant insights intent detected');
      
      const restaurantName = intent.extractedData.restaurantName;
      const location = intent.extractedData.location || 
                      contextAnalysis.extractedContext.impliedLocation || 
                      'NYC'; // Default to NYC
      
      if (restaurantName) {
        // Check if we have restaurant context
        selectedRestaurant = chatState.selectedRestaurant;
        if (!selectedRestaurant || !selectedRestaurant.name.toLowerCase().includes(restaurantName.toLowerCase())) {
          // Look for restaurant in recent search results
          selectedRestaurant = chatState.lastTop5.find(restaurant => 
            restaurant.name.toLowerCase().includes(restaurantName.toLowerCase()) ||
            restaurantName.toLowerCase().includes(restaurant.name.toLowerCase())
          );
        }
        
        try {
          console.log('🔍 Using Gemini 2.5 Pro with Google Search grounding for comprehensive restaurant insights...');
          
          // Comprehensive prompt combining menu recommendations and Reddit insights
          const comprehensivePrompt = `Give me concise insights about ${restaurantName} in ${location}. Keep it organized but brief (3-5 paragraphs max):

## Menu Recommendations 🍽️
- What are the MUST-TRY dishes and signature items?
- What do food critics and reviewers say are the best things to order?
- Any items to avoid or that get poor reviews?
- Price range and value for money?

## Reddit Community Opinions 💬
- What do Reddit users say about this restaurant?
- Quote specific Reddit user comments and experiences (with usernames if available)
- What dishes do Redditors specifically recommend?
- Any Reddit warnings or things to avoid?
- Overall Reddit sentiment (positive/negative/mixed)?

## Restaurant Overview ⭐
- What type of cuisine and dining experience?
- Atmosphere, service quality, and ambiance?
- Best times to visit, reservations needed?
- Overall consensus from multiple review sources?

FORMATTING GUIDELINES:
- Use markdown formatting for better readability
- Use emojis sparingly but appropriately (🍕 🌟 💰 📍 etc.)
- Break up text with bullet points, headers, or short sections
- Use **bold** for key info like restaurant names, prices, ratings
- Keep paragraphs short (2-3 sentences max)
- Lead with the most important information first

Please provide a well-organized response with clear sections, specific menu recommendations, and quoted Reddit user feedback. Focus on actionable advice for someone planning to visit.`;

          const groundedResponse = await generateGroundedContent(
            comprehensivePrompt,
            { 
              temperature: 0.1, 
              enableThinking: true,
              maxOutputTokens: 3048  // Increased for comprehensive response
            }
          );
          
          response = groundedResponse.text;
          
          // Add grounding citations if available
          if (groundedResponse.citations && groundedResponse.citations.length > 0) {
            response += `\n\n### Sources\n`;
            groundedResponse.citations.forEach((citation, index) => {
              response += `${index + 1}. [${citation.title}](${citation.url})\n`;
            });
          }
          
          // Generate follow-up quick actions
          quickActions = [
            {
              text: `💰 Is it expensive?`,
              action: `Is ${restaurantName} expensive?`
            },
            {
              text: `🏪 Find similar places`,
              action: `restaurants similar to ${restaurantName} in ${location}`
            },
            {
              text: `🆚 Compare with others`,
              action: `compare ${restaurantName} with similar restaurants in ${location}`
            }
          ];
          
        } catch (error) {
          console.error('Restaurant insights failed:', error);
          response = `I'm having trouble getting restaurant insights right now. Please try again in a moment.`;
        }
      } else {
        response = `I'd be happy to help with restaurant insights! Which restaurant are you asking about?`;
      }
    }
    
    // Restaurant comparison using Google Search grounding
    else if (intent.type === 'restaurant_comparison') {
      console.log('⚖️ Restaurant comparison intent detected');
      
      const restaurant1 = intent.extractedData.restaurant1;
      const restaurant2 = intent.extractedData.restaurant2;
      const location = intent.extractedData.location || 
                      contextAnalysis.extractedContext.impliedLocation || 
                      'NYC';
      
      if (restaurant1 && restaurant2) {
        try {
          console.log('🔍 Generating comparison using Google Search grounding...');
          
          const groundedResponse = await generateGroundedContent(
            `Compare **${restaurant1}** vs **${restaurant2}** in ${location}. Keep it concise (3-4 paragraphs max) but informative:

🆚 **Quick Comparison Overview**
- Food quality, signature dishes, pricing
- Which one wins in different categories?

💬 **Reddit & Review Consensus**
- What do Reddit users and reviewers say about each?
- Quote specific opinions if available

🏆 **Bottom Line Recommendation**
- Which one should I choose and why?
- Best use cases for each restaurant

Use markdown formatting, emojis, and **bold** for key info. Keep paragraphs short and lead with the most important differences.`,
            { 
              temperature: 0.1, 
              enableThinking: true,
              maxOutputTokens: 2048
            }
          );
          
          response = groundedResponse.text;
          
          // Add citations if available
          if (groundedResponse.citations && groundedResponse.citations.length > 0) {
            response += `\n\n### Sources\n`;
            groundedResponse.citations.forEach((citation, index) => {
              response += `${index + 1}. [${citation.title}](${citation.url})\n`;
            });
          }
          
          // Generate follow-up actions
          quickActions = [
            {
              text: `🍽️ ${restaurant1} insights`,
              action: `What should I order at ${restaurant1}`
            },
            {
              text: `🍽️ ${restaurant2} insights`,
              action: `What should I order at ${restaurant2}`
            }
          ];
          
        } catch (error) {
          console.error('Restaurant comparison failed:', error);
          response = `I'm having trouble comparing restaurants right now. Please try again in a moment.`;
        }
      } else {
        response = `I'd be happy to compare restaurants! Please mention which two restaurants you'd like me to compare.`;
      }
    }
    
    // Pricing questions using Google Search grounding
    else if (intent.type === 'restaurant_pricing') {
      console.log('💰 Restaurant pricing intent detected');
      
      const restaurantName = intent.extractedData.restaurantName;
      const location = intent.extractedData.location || 
                      contextAnalysis.extractedContext.impliedLocation || 
                      'NYC';
      
      if (restaurantName) {
        try {
          console.log('🔍 Getting pricing info using Google Search grounding...');
          
          const groundedResponse = await generateGroundedContent(
            `Is **${restaurantName}** expensive? Keep it concise (2-3 paragraphs max):

💰 **Price Breakdown**
- Average costs per person, menu price ranges
- How does it compare to similar restaurants?

📊 **Value Assessment**  
- What do reviews say about value for money?
- Is it worth the price? Any Reddit opinions?

🎯 **Bottom Line**
- Expensive/moderate/budget? Best times for deals?

Use markdown formatting, emojis, and **bold** for key pricing info. Lead with the most important cost details.`,
            { 
              temperature: 0.1, 
              enableThinking: true,
              maxOutputTokens: 2048
            }
          );
          
          response = groundedResponse.text;
          
          // Add citations if available
          if (groundedResponse.citations && groundedResponse.citations.length > 0) {
            response += `\n\n### Sources\n`;
            groundedResponse.citations.forEach((citation, index) => {
              response += `${index + 1}. [${citation.title}](${citation.url})\n`;
            });
          }
          
          // Generate follow-up actions
          quickActions = [
            {
              text: `🍽️ What to order`,
              action: `What should I order at ${restaurantName}`
            },
            {
              text: `📍 Find alternatives`,
              action: `cheaper alternatives to ${restaurantName} in ${location}`
            }
          ];
          
        } catch (error) {
          console.error('Pricing query failed:', error);
          response = `I'm having trouble getting pricing information right now. Please try again in a moment.`;
        }
      } else {
        response = `I'd be happy to help with pricing information! Which restaurant are you asking about?`;
      }
    }
    
    // General questions using Google Search grounding
    else {
      console.log('❓ General question - using Google Search grounding');
      
      try {
        const generalPrompt = `${processedMessage}

Please provide a helpful, concise response (3-4 paragraphs max):

FORMATTING GUIDELINES:
- Use markdown formatting for better readability
- Use emojis sparingly but appropriately (🍕 🌟 💰 📍 etc.)
- Break up text with bullet points, headers, or short sections
- Use **bold** for key info like restaurant names, prices, ratings
- Keep paragraphs short (2-3 sentences max)
- Lead with the most important information first`;

        const groundedResponse = await generateGroundedContent(
          generalPrompt,
          { 
            temperature: 0.1, 
            enableThinking: true,
            maxOutputTokens: 2048
          }
        );
        
        response = groundedResponse.text;
        
        // Add citations if available
        if (groundedResponse.citations && groundedResponse.citations.length > 0) {
          response += `\n\n### Sources\n`;
          groundedResponse.citations.forEach((citation, index) => {
            response += `${index + 1}. [${citation.title}](${citation.url})\n`;
          });
        }
        
        // Add general quick actions
        quickActions = [
          { text: "Find restaurants", action: "best restaurants near me" },
          { text: "Pizza places", action: "best pizza in Manhattan" },
          { text: "Brunch spots", action: "good brunch places" }
        ];
        
      } catch (error) {
        console.error('General query failed:', error);
        response = `I'm having trouble processing your request right now. Please try rephrasing your question or try again in a moment.`;
      }
    }
    
    const processingTime = Date.now() - startTime;
    
    // Create response message
    const responseMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: response,
      timestamp: new Date(),
      metadata: {
        restaurants: restaurants.length > 0 ? restaurants : undefined,
        selectedRestaurant: selectedRestaurant || chatState.selectedRestaurant,
        quickActions: quickActions.length > 0 ? quickActions : undefined,
        processingTime,
        toolUsed: restaurants.length > 0 ? 'searchRestaurants' : undefined,

      },
    };

    console.log(`Orchestration completed in ${processingTime}ms`);
    
    return responseMessage;
    
  } catch (error) {
    console.error('Orchestration error:', error);
    
    const processingTime = Date.now() - startTime;
    
    return {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: "I'm having trouble processing your request right now. Please try rephrasing your question or try again in a moment.",
      timestamp: new Date(),
      metadata: {
        restaurants: [],
        quickActions: [],
        toolUsed: undefined,
        processingTime
      },
    };
  }
} 