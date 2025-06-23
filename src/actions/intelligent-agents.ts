'use server';

import { generateContent } from './gemini';

/**
 * Validates and sanitizes menu analysis response structure
 * Similar to Pydantic validation but in TypeScript
 */
function validateMenuAnalysis(data: any): {
  recommendations: Array<{
    item: string;
    description: string;
    user: string;
    upvotes: number;
    confidence: number;
    quote: string;
    source: 'reddit' | 'google';
  }>;
  avoid: Array<{
    item: string;
    reason: string;
    user: string;
    quote: string;
  }>;
  summary: string;
  top_recommendation: string;
  total_items_found: number;
  sources: {
    reddit: { posts: number; comments: number; };
    google: { reviews: number; };
  };
} {
  const validated = {
    recommendations: [],
    avoid: [],
    summary: '',
    top_recommendation: '',
    total_items_found: 0,
    sources: {
      reddit: { posts: 0, comments: 0 },
      google: { reviews: 0 }
    }
  };

  // Validate recommendations array
  if (Array.isArray(data.recommendations)) {
    validated.recommendations = data.recommendations
      .filter((rec: any) => rec && typeof rec === 'object')
      .map((rec: any) => ({
        item: String(rec.item || 'Unknown Item'),
        description: String(rec.description || 'No description'),
        user: String(rec.user || 'unknown').replace(/^u\//, ''), // Remove u/ prefix if present
        upvotes: Number(rec.upvotes) || 0,
        confidence: Number(rec.confidence) || 0.7, // Default confidence
        quote: String(rec.quote || 'No quote available').slice(0, 200), // Limit quote length
        source: (rec.source === 'reddit' || rec.source === 'google') ? rec.source : 'reddit'
      }))
      .filter((rec: any) => rec.item !== 'Unknown Item'); // Filter out invalid items
  }

  // Validate avoid array
  if (Array.isArray(data.avoid)) {
    validated.avoid = data.avoid
      .filter((avoid: any) => avoid && typeof avoid === 'object')
      .map((avoid: any) => ({
        item: String(avoid.item || 'Unknown Item'),
        reason: String(avoid.reason || 'No reason provided'),
        user: String(avoid.user || 'unknown').replace(/^u\//, ''),
        quote: String(avoid.quote || 'No quote available').slice(0, 200)
      }))
      .filter((avoid: any) => avoid.item !== 'Unknown Item');
  }

  // Validate sources
  if (data.sources) {
    if (data.sources.reddit) {
      validated.sources.reddit.posts = Number(data.sources.reddit.posts) || 0;
      validated.sources.reddit.comments = Number(data.sources.reddit.comments) || 0;
    }
    if (data.sources.google) {
      validated.sources.google.reviews = Number(data.sources.google.reviews) || 0;
    }
  }

  // Validate other fields
  validated.summary = String(data.summary || 'No summary available');
  validated.top_recommendation = String(data.top_recommendation || '');
  validated.total_items_found = Number(data.total_items_found) || validated.recommendations.length;

  console.log('✅ Menu analysis validated and sanitized');
  console.log(`   📊 Valid recommendations: ${validated.recommendations.length}`);
  console.log(`   ⚠️ Valid avoid items: ${validated.avoid.length}`);

  return validated;
}

// ===============================================
// 🧠 INTELLIGENT COMMENT ANALYSIS AGENT
// ===============================================
export async function analyzeCommentsForMenuRecommendations(
  comments: any[], 
  restaurantName: string
): Promise<{
  menuComments: any[];
  analysis: string;
  confidence: number;
}> {
  if (comments.length === 0) {
    return { menuComments: [], analysis: 'No comments found', confidence: 0 };
  }

  const prompt = `You are a menu recommendation expert analyzing Reddit comments about "${restaurantName}".

Your task: Identify which comments contain actual menu recommendations, specific dishes, or food advice.

Comments to analyze:
${comments.slice(0, 10).map((comment, i) => 
  `${i + 1}. [${comment.score} upvotes] ${comment.body.slice(0, 300)}`
).join('\n\n')}

Instructions:
1. Score each comment 0-10 for menu relevance
2. Look for: specific dishes, "try the", "order", "get the", "delicious", food adjectives
3. Ignore: general opinions, service comments, ambiance discussion
4. Return top 5 most relevant comments

Respond ONLY with this JSON:
{
  "relevantComments": [
    {
      "commentIndex": 1,
      "relevanceScore": 9,
      "menuItems": ["specific dish mentioned"],
      "reasoning": "why this is menu-relevant"
    }
  ],
  "overallAnalysis": "summary of menu insights",
  "confidence": 0.85
}`;

  try {
    const response = await generateContent(prompt);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      throw new Error('No JSON in response');
    }
    
    const analysis = JSON.parse(jsonMatch[0]);
    
    // Map back to actual comments
    const menuComments = analysis.relevantComments
      .filter((item: any) => item.relevanceScore >= 6)
      .map((item: any) => comments[item.commentIndex - 1])
      .filter(Boolean)
      .slice(0, 5);
    
    console.log('🧠 Menu Analysis Results:');
    console.log('- Relevant comments found:', menuComments.length);
    console.log('- Analysis:', analysis.overallAnalysis);
    console.log('- Confidence:', analysis.confidence);
    
    return {
      menuComments,
      analysis: analysis.overallAnalysis,
      confidence: analysis.confidence
    };
    
  } catch (error) {
    console.error('Error in menu analysis:', error);
    
    // No fallback - return empty results if LLM fails
    return {
      menuComments: [],
      analysis: 'LLM analysis failed - unable to analyze comments',
      confidence: 0
    };
  }
}

// ===============================================
// 🗺️ INTELLIGENT WORLDWIDE LOCATION RESOLVER AGENT  
// ===============================================
export async function resolveLocationCoordinates(location: string): Promise<{
  coordinates: { lat: number; lng: number };
  normalizedName: string;
  confidence: number;
}> {
  console.log(`🌍 Resolving location worldwide: "${location}"`);
  
  // 🥇 OPTION 1: Try Google Geocoding API first (most accurate)
  try {
    const geocodingResult = await geocodeWithGoogleAPI(location);
    if (geocodingResult) {
      console.log('✅ Google Geocoding API succeeded');
      return geocodingResult;
    }
  } catch (error) {
    console.log('⚠️ Google Geocoding API failed, trying LLM fallback:', error);
  }
  
  // 🥈 OPTION 2: Fallback to LLM Geographic Intelligence
  try {
    const llmResult = await geocodeWithLLM(location);
    console.log('✅ LLM Geographic Intelligence succeeded');
    return llmResult;
  } catch (error) {
    console.error('❌ Both geocoding methods failed:', error);
    
    // No hardcoded fallback - throw error if all LLM methods fail
    throw new Error(`Unable to resolve location "${location}" - all geocoding methods failed`);
  }
}

/**
 * 🌐 Google Geocoding API - Worldwide Location Resolution
 */
async function geocodeWithGoogleAPI(location: string): Promise<{
  coordinates: { lat: number; lng: number };
  normalizedName: string;
  confidence: number;
} | null> {
  const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
  
  if (!GOOGLE_API_KEY) {
    console.log('⚠️ Google Geocoding API: No API key available');
    return null;
  }
  
  const encodedLocation = encodeURIComponent(location);
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedLocation}&key=${GOOGLE_API_KEY}`;
  
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      console.log(`❌ Google Geocoding API: HTTP error ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    console.log(`📋 Google Geocoding API status: ${data.status}`);
    
    // Handle specific error cases
    if (data.status === 'REQUEST_DENIED') {
      console.log('❌ Google Geocoding API: REQUEST_DENIED');
      console.log(`   Error: ${data.error_message || 'API key does not have Geocoding API enabled'}`);
      console.log('   💡 Solution: Enable Geocoding API in Google Cloud Console');
      console.log('   📋 Fallback: Will use LLM geocoding instead');
      return null;
    }
    
    if (data.status === 'OVER_QUERY_LIMIT') {
      console.log('❌ Google Geocoding API: OVER_QUERY_LIMIT');
      console.log('   💡 Solution: Check quotas in Google Cloud Console');
      return null;
    }
    
    if (data.status === 'ZERO_RESULTS') {
      console.log('ℹ️ Google Geocoding API: No results found for this location');
      return null;
    }
    
    if (data.status !== 'OK') {
      console.log(`❌ Google Geocoding API: ${data.status} - ${data.error_message || 'Unknown error'}`);
      return null;
    }
    
    if (!data.results || data.results.length === 0) {
      console.log('ℹ️ Google Geocoding API: No results in response');
      return null;
    }
    
    const result = data.results[0];
    const coordinates = {
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng
    };
    
    // Determine confidence based on location_type
    let confidence = 0.95;
    switch (result.geometry.location_type) {
      case 'ROOFTOP':
        confidence = 0.99;
        break;
      case 'RANGE_INTERPOLATED':
        confidence = 0.95;
        break;
      case 'GEOMETRIC_CENTER':
        confidence = 0.90;
        break;
      case 'APPROXIMATE':
        confidence = 0.85;
        break;
    }
    
    console.log(`✅ Google Geocoding API: Success for "${location}"`);
    console.log(`   📍 Coordinates: ${coordinates.lat}, ${coordinates.lng}`);
    console.log(`   🎯 Confidence: ${confidence}`);
    
    return {
      coordinates,
      normalizedName: result.formatted_address,
      confidence
    };
    
  } catch (error) {
    console.log(`❌ Google Geocoding API: Network error - ${error instanceof Error ? error.message : 'Unknown error'}`);
    return null;
  }
}

/**
 * 🧠 LLM Geographic Intelligence - Worldwide Location Knowledge
 */
async function geocodeWithLLM(location: string): Promise<{
  coordinates: { lat: number; lng: number };
  normalizedName: string;
  confidence: number;
}> {
  const prompt = `You are a global geography expert with comprehensive knowledge of cities, neighborhoods, landmarks, and locations worldwide.

Location Query: "${location}"

Task: Provide precise coordinates for this location anywhere in the world.

Instructions:
- Use your extensive geographic knowledge 
- Handle cities, neighborhoods, landmarks, addresses globally
- Provide accurate lat/lng coordinates
- Include confidence score based on location specificity
- Normalize the location name properly

Examples of what you can handle:
- Cities: "Paris", "Tokyo", "Sydney", "Cairo"
- Neighborhoods: "Greenwich Village NYC", "Shibuya Tokyo", "Marais Paris"
- Landmarks: "Eiffel Tower", "Times Square", "Big Ben"
- Regions: "Silicon Valley", "Hollywood", "Wall Street"
- Countries: "Japan", "France", "Australia"
- States/Provinces: "California", "Ontario Canada", "Bavaria Germany"

Respond ONLY with this JSON format:
{
  "coordinates": {"lat": 48.8566, "lng": 2.3522},
  "normalizedName": "Paris, France",
  "confidence": 0.95,
  "reasoning": "Major world capital with precise coordinates"
}

Confidence levels:
- 0.95-0.99: Exact address/landmark
- 0.85-0.94: City/neighborhood center  
- 0.70-0.84: Region/area approximation
- 0.50-0.69: Country/state center`;

  const response = await generateContent(prompt, {
    response_mime_type: "application/json",
    response_schema: {
      type: "object",
      properties: {
        coordinates: {
          type: "object",
          properties: {
            lat: { type: "number" },
            lng: { type: "number" }
          },
          required: ["lat", "lng"]
        },
        normalizedName: { type: "string" },
        confidence: { type: "number" }
      },
      required: ["coordinates", "normalizedName", "confidence"]
    },
    maxOutputTokens: 1024
  });
  
  const result = JSON.parse(response);
  
  // Validate coordinates
  if (!result.coordinates || 
      typeof result.coordinates.lat !== 'number' || 
      typeof result.coordinates.lng !== 'number' ||
      Math.abs(result.coordinates.lat) > 90 ||
      Math.abs(result.coordinates.lng) > 180) {
    throw new Error('Invalid coordinates from LLM');
  }
  
  return {
    coordinates: result.coordinates,
    normalizedName: result.normalizedName || location,
    confidence: Math.max(0.5, Math.min(0.99, result.confidence || 0.8))
  };
}

// ===============================================
// 🏷️ INTELLIGENT RESTAURANT NAME VARIATIONS AGENT
// ===============================================
export async function generateRestaurantSearchVariations(restaurantName: string): Promise<{
  variations: string[];
  strategy: string;
  confidence: number;
}> {
  const prompt = `You are a restaurant search expert. Generate smart search variations for this restaurant name.

Restaurant: "${restaurantName}"

Task: Create 5-8 search variations that would help find this restaurant on Reddit/web.

Consider:
- Common abbreviations (Joe's Pizza → "Joe's", "Joes")  
- Casual names vs formal names
- With/without descriptors ("Restaurant", "Bar", "&")
- Common misspellings or variations
- Nicknames people might use

Examples:
- "Junior's Restaurant & Bakery" → ["Junior's", "Juniors", "Junior's Restaurant", "Juniors bakery"]
- "Joe's Pizza" → ["Joe's", "Joes Pizza", "Joe's NY", "Joes"]

Respond ONLY with this JSON:
{
  "variations": ["variation1", "variation2", "variation3"],
  "strategy": "explanation of variation strategy",
  "confidence": 0.9
}`;

  try {
    const response = await generateContent(prompt, {
      response_mime_type: "application/json",
      response_schema: {
        type: "object",
        properties: {
          variations: { 
            type: "array", 
            items: { type: "string" }
          },
          strategy: { type: "string" },
          confidence: { type: "number" }
        },
        required: ["variations", "strategy", "confidence"]
      },
      maxOutputTokens: 1024
    });
    
    const result = JSON.parse(response);
    
    console.log('🏷️ Name Variations Generated:');
    console.log('- Original:', restaurantName);
    console.log('- Variations:', result.variations);
    console.log('- Strategy:', result.strategy);
    
    return result;
    
  } catch (error) {
    console.error('Error generating variations:', error);
    
    // No fallback - just return original name
    return {
      variations: [restaurantName],
      strategy: 'LLM failed - using original name only',
      confidence: 0.1
    };
  }
}

// ===============================================
// 🔍 INTELLIGENT SEARCH QUERY GENERATOR AGENT
// ===============================================
export async function generateOptimalSearchQuery(
  intent: string,
  restaurantName: string,
  location?: string,
  context?: string
): Promise<{
  query: string;
  alternativeQueries: string[];
  reasoning: string;
}> {
  const prompt = `You are a search optimization expert. Create the best search query for this intent.

Intent: ${intent}
Restaurant: ${restaurantName}
Location: ${location || 'Not specified'}
Context: ${context || 'Restaurant recommendation chatbot'}

Available intent types:
- "menu" - Find menu recommendations, what to order
- "reddit" - Find Reddit discussions about restaurant  
- "reviews" - Find general reviews and opinions
- "pricing" - Find price/cost information
- "hours" - Find operating hours
- "delivery" - Find delivery/takeout options

Task: Create 1 primary query + 2-3 alternative queries optimized for web search.

Consider:
- Search engine optimization best practices
- Natural language people use
- Specific sites (Reddit, Yelp, etc.) when relevant
- Geographic specificity

Respond ONLY with this JSON:
{
  "query": "primary optimized search query",
  "alternativeQueries": ["backup query 1", "backup query 2"],
  "reasoning": "why this query strategy works"
}`;

  try {
    const response = await generateContent(prompt);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      throw new Error('No JSON in response');
    }
    
    const result = JSON.parse(jsonMatch[0]);
    
    console.log('🔍 Search Query Generated:');
    console.log('- Intent:', intent);
    console.log('- Primary query:', result.query);
    console.log('- Alternatives:', result.alternativeQueries);
    
    return result;
    
  } catch (error) {
    console.error('Error generating search query:', error);
    
    // No fallback - return minimal query if LLM fails
    const basicQuery = `${restaurantName} ${intent}`;
    return {
      query: basicQuery,
      alternativeQueries: [basicQuery],
      reasoning: 'LLM failed - using basic query format'
    };
  }
}

// ===============================================
// 🏪 INTELLIGENT CATEGORY DETECTION AGENT
// ===============================================
export async function detectRestaurantCategory(restaurantName: string): Promise<{
  category: string;
  subcategories: string[];
  searchTerms: string[];
  confidence: number;
}> {
  const prompt = `You are a restaurant categorization expert. Analyze this restaurant name to determine its category.

Restaurant: "${restaurantName}"

Task: Determine the most likely restaurant category and related search terms.

Common categories:
- Pizza (pizzeria, pizza place)
- Italian (Italian restaurant, pasta, etc.)
- Chinese (Chinese food, takeout)
- Mexican (tacos, burritos, cantina) 
- American (diner, burger, grill)
- Bakery (pastries, bread, desserts)
- Brunch (breakfast, coffee, bagels)
- Bar (drinks, pub, tavern)
- Fast Food (chain, quick service)
- Fine Dining (upscale, expensive)

Look for clues in the name itself and common naming patterns.

Respond ONLY with this JSON:
{
  "category": "primary category",
  "subcategories": ["sub1", "sub2"],
  "searchTerms": ["term1", "term2", "term3"],
  "confidence": 0.85
}`;

  try {
    const response = await generateContent(prompt);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      throw new Error('No JSON in response');
    }
    
    const result = JSON.parse(jsonMatch[0]);
    
    console.log('🏪 Category Detection:');
    console.log('- Restaurant:', restaurantName);
    console.log('- Category:', result.category);
    console.log('- Search terms:', result.searchTerms);
    
    return result;
    
  } catch (error) {
    console.error('Error detecting category:', error);
    
    // No fallback - return generic restaurant category if LLM fails
    return {
      category: 'restaurant',
      subcategories: ['restaurant'],
      searchTerms: ['restaurant'],
      confidence: 0.1
    };
  }
}

/**
 * Fetches Google Places reviews for a restaurant
 */
async function getGooglePlacesReviews(placeId: string): Promise<any[]> {
  try {
    const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
    
    if (!GOOGLE_API_KEY) {
      console.log('⚠️ Google API key not configured for Places reviews');
      return [];
    }
    
    const PLACES_API_BASE = 'https://places.googleapis.com/v1/places';

    console.log(`🔍 Fetching Google Places reviews for place ID: ${placeId}`);
    
    const response = await fetch(`${PLACES_API_BASE}/${placeId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_API_KEY,
        'X-Goog-FieldMask': 'reviews'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Google Places API error: ${response.status} - ${errorText}`);
      return [];
    }

    const data = await response.json();
    const reviews = data.reviews || [];
    
    console.log(`📊 Google Places Reviews Summary:`);
    console.log(`   Total reviews fetched: ${reviews.length}`);
    
    if (reviews.length > 0) {
      console.log(`   Sample review ratings: ${reviews.slice(0, 5).map((r: any) => r.rating).join(', ')}`);
      console.log(`   Sample review (first 100 chars): "${reviews[0]?.text?.text?.slice(0, 100)}..."`);
    }
    
    return reviews;
  } catch (error) {
    console.error('❌ Error fetching Google Places reviews:', error);
    return [];
  }
}

/**
 * Comprehensive Reddit + Google Places Menu Recommendation Analysis
 * Combines Reddit discussions with Google Places reviews for complete menu insights
 */
export async function analyzeRedditMenuRecommendations(
  restaurantName: string,
  redditPosts: any[],
  redditComments: any[],
  placeId?: string
): Promise<{
  recommendations: {
    item: string;
    description: string;
    user: string;
    upvotes: number;
    confidence: number;
    quote: string;
    source: 'reddit' | 'google';
  }[];
  avoid: {
    item: string;
    reason: string;
    user: string;
    quote: string;
  }[];
  analysis: string;
  confidence: number;
  sources: {
    reddit: { posts: number; comments: number; };
    google: { reviews: number; };
  };
}> {
  console.log(`🧠 Starting hybrid analysis: Reddit + Google Places for ${restaurantName}`);
  
  // Fetch Google Places reviews if placeId is provided
  let googleReviews: any[] = [];
  if (placeId) {
    console.log(`🔍 Fetching Google Places reviews...`);
    googleReviews = await getGooglePlacesReviews(placeId);
  }
  
  console.log(`📊 Combined Analysis Input Data:`);
  console.log(`   Reddit Posts: ${redditPosts.length}`);
  console.log(`   Reddit Comments: ${redditComments.length}`);
  console.log(`   Google Places Reviews: ${googleReviews.length}`);
  
  // Log sample data being sent to LLM
  console.log(`📋 Sample Reddit Posts:`);
  redditPosts.slice(0, 3).forEach((post, index) => {
    console.log(`   ${index + 1}. ${post.title}`);
    console.log(`      URL: ${post.url}`);
  });
  
  console.log(`📋 Sample Reddit Comments (Top 5 by score):`);
  redditComments.slice(0, 5).forEach((comment, index) => {
    console.log(`   ${index + 1}. u/${comment.author} (${comment.score} pts): ${comment.body.slice(0, 150)}...`);
  });

  if (googleReviews.length > 0) {
    console.log(`📋 Sample Google Reviews (Top 5 by rating):`);
    googleReviews.slice(0, 5).forEach((review, index) => {
      console.log(`   ${index + 1}. ${review.authorAttribution?.displayName} (${review.rating}⭐): ${review.text?.text?.slice(0, 150)}...`);
    });
  }

  // Filter Reddit comments to reduce prompt size
  const relevantComments = redditComments.filter(comment => 
    comment.body.toLowerCase().includes(restaurantName.toLowerCase()) ||
    comment.body.toLowerCase().includes('order') ||
    comment.body.toLowerCase().includes('recommend') ||
    comment.body.toLowerCase().includes('try') ||
    comment.body.toLowerCase().includes('get') ||
    comment.body.toLowerCase().includes('menu') ||
    comment.body.toLowerCase().includes('dish') ||
    comment.body.toLowerCase().includes('food')
  ).slice(0, 15); // Reduce to 15 to make room for Google reviews

  // Filter Google reviews for relevant content (mentioning food items)
  const relevantGoogleReviews = googleReviews.filter(review => {
    const text = review.text?.text?.toLowerCase() || '';
    return text.includes('order') || text.includes('recommend') || 
           text.includes('try') || text.includes('dish') || 
           text.includes('menu') || text.includes('food') ||
           text.includes('delicious') || text.includes('taste') ||
           text.includes('flavor') || text.includes('meal');
  }).slice(0, 15); // Limit to top 15 relevant reviews

  const prompt = `Analyze Reddit discussions AND Google Places reviews to find menu recommendations for ${restaurantName}.

REDDIT DATA:
${JSON.stringify({ 
  posts: redditPosts.slice(0, 3),
  comments: relevantComments 
}, null, 2)}

GOOGLE PLACES REVIEWS:
${JSON.stringify(relevantGoogleReviews.map(review => ({
  rating: review.rating,
  author: review.authorAttribution?.displayName || 'Anonymous',
  text: review.text?.text || '',
  publishTime: review.relativePublishTimeDescription || 'Unknown'
})), null, 2)}

TASK: Extract specific menu items mentioned for ${restaurantName}. 

RULES:
- Extract menu items from BOTH Reddit and Google reviews
- Mark source as "reddit" or "google" for each recommendation
- Only extract actual food/drink menu items
- Ignore jokes, pets, atmosphere comments
- Normalize names: "plain slice" → "Plain Cheese Pizza"
- Extract multiple items if mentioned together
- Keep quotes under 100 characters
- Prioritize items mentioned multiple times across sources

CRITICAL: Return ONLY valid JSON with this exact structure:
{
  "recommendations": [
    {
      "item": "Menu Item Name",
      "description": "Why recommended",
      "user": "username_or_reviewer_name",
      "upvotes": 0,
      "quote": "Short relevant quote",
      "source": "reddit"
    }
  ],
  "avoid": [],
  "summary": "Brief summary of recommendations from both sources",
  "top_recommendation": "",
  "total_items_found": 0,
  "sources": {
    "reddit": {"posts": ${redditPosts.length}, "comments": ${relevantComments.length}},
    "google": {"reviews": ${relevantGoogleReviews.length}}
  }
}

NO markdown, NO extra text, ONLY JSON:`;

  // Define JSON schema for structured output
  const responseSchema = {
    type: "object",
    properties: {
      recommendations: {
        type: "array",
        items: {
          type: "object",
          properties: {
            item: { type: "string", description: "Name of the menu item" },
            description: { type: "string", description: "Why this item is recommended" },
            user: { type: "string", description: "Reddit username or Google reviewer name" },
            upvotes: { type: "number", description: "Number of upvotes for comment or Google review rating" },
            quote: { type: "string", description: "Relevant quote from the user" },
            source: { type: "string", enum: ["reddit", "google"], description: "Source of the recommendation" }
          },
          required: ["item", "description", "user", "upvotes", "quote", "source"]
        }
      },
      avoid: {
        type: "array",
        items: {
          type: "object",
          properties: {
            item: { type: "string" },
            reason: { type: "string" },
            user: { type: "string" },
            quote: { type: "string" }
          },
          required: ["item", "reason", "user", "quote"]
        }
      },
      summary: { type: "string", description: "Brief summary of recommendations from both sources" },
      top_recommendation: { type: "string", description: "Most mentioned or highest rated item" },
      total_items_found: { type: "number", description: "Total number of unique menu items found" },
      sources: {
        type: "object",
        properties: {
          reddit: {
            type: "object",
            properties: {
              posts: { type: "number" },
              comments: { type: "number" }
            },
            required: ["posts", "comments"]
          },
          google: {
            type: "object", 
            properties: {
              reviews: { type: "number" }
            },
            required: ["reviews"]
          }
        },
        required: ["reddit", "google"]
      }
    },
    required: ["recommendations", "avoid", "summary", "top_recommendation", "total_items_found", "sources"]
  };

  console.log(`🤖 Sending ${prompt.length} characters to LLM for structured analysis...`);

  try {
    // Use structured generation instead of free-form text
    const response = await generateContent(prompt, {
      response_mime_type: "application/json",
      response_schema: responseSchema
    });
    
    console.log(`📤 LLM Structured Response (first 300 chars): ${response.slice(0, 300)}...`);
    
    // With structured generation, the response should already be valid JSON
    let analysis;
    try {
      analysis = JSON.parse(response);
      console.log('✅ Structured JSON parsed successfully');
    } catch (parseError) {
      console.error('❌ Structured JSON Parse Error:', parseError);
      console.error('❌ Raw response:', response);
      
      // Fallback: try basic cleanup for any edge cases
      try {
        const cleanedResponse = response
          .replace(/```json\s*/g, '')
          .replace(/```\s*$/g, '')
          .trim();
        
        analysis = JSON.parse(cleanedResponse);
        console.log('✅ JSON parsed after basic cleanup');
      } catch (fallbackError) {
        console.error('❌ Fallback parsing also failed:', fallbackError);
        throw new Error('Structured generation failed to produce valid JSON');
      }
    }
    
    // Validate the structured response
    const validatedAnalysis = validateMenuAnalysis(analysis);
    
    console.log('🍽️ Reddit Menu Analysis Results:');
    console.log(`   ✅ Recommendations found: ${validatedAnalysis.recommendations?.length || 0}`);
    validatedAnalysis.recommendations?.forEach((rec: any, index: number) => {
      console.log(`     ${index + 1}. ${rec.item}`);
      console.log(`        User: u/${rec.user} | Quote: "${(rec.quote || '').slice(0, 100)}..."`);
    });
    
    console.log(`   ⚠️ Items to avoid: ${validatedAnalysis.avoid?.length || 0}`);
    validatedAnalysis.avoid?.forEach((avoid: any, index: number) => {
      console.log(`     ${index + 1}. ${avoid.item}`);
      console.log(`        Reason: ${avoid.reason} | User: u/${avoid.user}`);
    });
    
    console.log(`   📊 Total items found: ${validatedAnalysis.total_items_found}`);
    console.log(`   📝 Analysis summary: ${validatedAnalysis.summary}`);
    
    return {
      ...validatedAnalysis,
      analysis: validatedAnalysis.summary,
      confidence: validatedAnalysis.recommendations.length > 0 ? 0.8 : 0.2
    };
    
  } catch (error) {
    console.error('❌ Error analyzing Reddit + Google menu recommendations:', error);
    
    // Return proper structure matching the expected interface
    return {
      recommendations: [],
      avoid: [],
      analysis: 'Unable to analyze menu recommendations due to processing error. Please try again.',
      confidence: 0,
      sources: {
        reddit: { posts: redditPosts.length, comments: redditComments.length },
        google: { reviews: googleReviews.length }
      }
    };
  }
}

 