'use server';

import { SearchResult, SerperResponse, WebSearchParams, CustomAPIError } from '@/types';

const SERPER_API_KEY = process.env.SERPER_API_KEY!;
const SERPER_API_BASE = 'https://google.serper.dev/search';

if (!process.env.SERPER_API_KEY) {
  throw new Error('SERPER_API_KEY environment variable is required');
}

/**
 * Performs a general web search using Serper.dev
 */
export async function webSearch(
  query: string,
  numResults: number = 10,
  gl: string = 'us',
  hl: string = 'en'
): Promise<SearchResult[]> {
  const startTime = Date.now();
  
  try {
    const response = await fetch(SERPER_API_BASE, {
      method: 'POST',
      headers: {
        'X-API-KEY': SERPER_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        q: query,
        num: numResults,
        gl, // Geographic location
        hl  // Language
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Serper API error: ${response.status} - ${errorText}`);
    }

    const data: SerperResponse = await response.json();
    
    const results: SearchResult[] = (data.organic || []).map((result, index) => ({
      title: result.title,
      url: result.link,
      snippet: result.snippet,
      position: result.position || index + 1,
      date: result.date,
      domain: extractDomain(result.link)
    }));

    const processingTime = Date.now() - startTime;
    console.log(`Web search completed in ${processingTime}ms for query: "${query}"`);
    
    return results;
  } catch (error) {
    console.error('Error performing web search:', error);
    throw new CustomAPIError({
      code: 'WEB_SEARCH_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      details: { query, numResults, gl, hl }
    });
  }
}

/**
 * Searches for Reddit discussions about a specific restaurant
 */
export async function searchRedditDiscussions(
  restaurantName: string,
  location?: string
): Promise<SearchResult[]> {
  try {
    // Construct a Reddit-specific search query
    const locationPart = location ? ` ${location}` : '';
    const query = `site:reddit.com "${restaurantName}"${locationPart} restaurant review`;
    
    console.log(`Searching Reddit for: ${query}`);
    
    const results = await webSearch(query, 10);
    
    // Filter to ensure we only get Reddit URLs and relevant results
    const redditResults = results
      .filter(result => result.url.includes('reddit.com'))
      .filter(result => !result.url.includes('/user/')) // Exclude user profiles
      .slice(0, 5); // Limit to top 5 Reddit results
    
    return redditResults;
  } catch (error) {
    console.error('Error searching Reddit discussions:', error);
    throw error;
  }
}

/**
 * Searches for menu recommendations for a specific restaurant
 */
export async function searchMenuRecommendations(restaurantName: string): Promise<SearchResult[]> {
  try {
    const query = `"what to order at ${restaurantName}" menu recommendations`;
    
    console.log(`Searching menu recommendations for: ${restaurantName}`);
    
    const results = await webSearch(query, 15);
    
    // Filter for more relevant results
    const relevantResults = results.filter(result => {
      const lowerTitle = result.title.toLowerCase();
      const lowerSnippet = result.snippet.toLowerCase();
      
      return (
        lowerTitle.includes('menu') ||
        lowerTitle.includes('order') ||
        lowerTitle.includes('recommend') ||
        lowerSnippet.includes('menu') ||
        lowerSnippet.includes('order') ||
        lowerSnippet.includes('recommend')
      );
    });
    
    return relevantResults.slice(0, 10);
  } catch (error) {
    console.error('Error searching menu recommendations:', error);
    throw error;
  }
}

/**
 * Searches for restaurant comparisons
 */
export async function searchRestaurantComparison(
  restaurant1: string,
  restaurant2: string,
  location?: string
): Promise<SearchResult[]> {
  try {
    const locationPart = location ? ` ${location}` : '';
    const query = `"${restaurant1}" vs "${restaurant2}"${locationPart} restaurant comparison`;
    
    console.log(`Searching comparison: ${restaurant1} vs ${restaurant2}`);
    
    const results = await webSearch(query, 15);
    
    // Also search for Reddit discussions about the comparison
    const redditQuery = `site:reddit.com "${restaurant1}" "${restaurant2}" comparison`;
    const redditResults = await webSearch(redditQuery, 5);
    
    // Combine and deduplicate results
    const allResults = [...results, ...redditResults];
    const uniqueResults = deduplicateResults(allResults);
    
    return uniqueResults.slice(0, 10);
  } catch (error) {
    console.error('Error searching restaurant comparison:', error);
    throw error;
  }
}

/**
 * Searches for restaurant pricing information
 */
export async function searchRestaurantPricing(
  restaurantName: string,
  location?: string
): Promise<SearchResult[]> {
  try {
    const locationPart = location ? ` ${location}` : '';
    const query = `"${restaurantName}"${locationPart} expensive price cost menu prices`;
    
    console.log(`Searching pricing info for: ${restaurantName}`);
    
    const results = await webSearch(query, 10);
    
    // Filter for pricing-related results
    const pricingResults = results.filter(result => {
      const lowerTitle = result.title.toLowerCase();
      const lowerSnippet = result.snippet.toLowerCase();
      
      return (
        lowerTitle.includes('price') ||
        lowerTitle.includes('cost') ||
        lowerTitle.includes('expensive') ||
        lowerTitle.includes('cheap') ||
        lowerTitle.includes('$') ||
        lowerSnippet.includes('price') ||
        lowerSnippet.includes('cost') ||
        lowerSnippet.includes('$')
      );
    });
    
    return pricingResults;
  } catch (error) {
    console.error('Error searching restaurant pricing:', error);
    throw error;
  }
}

/**
 * Performs multiple search queries in parallel for comprehensive results
 */
export async function comprehensiveRestaurantSearch(
  restaurantName: string,
  location?: string
): Promise<{
  general: SearchResult[];
  reddit: SearchResult[];
  menu: SearchResult[];
  pricing: SearchResult[];
}> {
  try {
    const [general, reddit, menu, pricing] = await Promise.allSettled([
      webSearch(`"${restaurantName}" ${location || ''} restaurant review`),
      searchRedditDiscussions(restaurantName, location),
      searchMenuRecommendations(restaurantName),
      searchRestaurantPricing(restaurantName, location)
    ]);

    return {
      general: general.status === 'fulfilled' ? general.value : [],
      reddit: reddit.status === 'fulfilled' ? reddit.value : [],
      menu: menu.status === 'fulfilled' ? menu.value : [],
      pricing: pricing.status === 'fulfilled' ? pricing.value : []
    };
  } catch (error) {
    console.error('Error in comprehensive restaurant search:', error);
    throw error;
  }
}

/**
 * Extracts domain from URL
 */
function extractDomain(url: string): string {
  try {
    const domain = new URL(url).hostname;
    return domain.replace('www.', '');
  } catch {
    return 'unknown';
  }
}

/**
 * Removes duplicate search results based on URL
 */
function deduplicateResults(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  return results.filter(result => {
    if (!result.url || seen.has(result.url)) {
      return false;
    }
    seen.add(result.url);
    return true;
  });
}

/**
 * Searches Reddit for specific menu recommendations using web search
 * Implements the exact flow: site:reddit.com RestaurantName Location ("best order" OR "what to order" OR ...)
 */
export async function searchRedditMenuRecommendations(
  restaurantName: string,
  location?: string
): Promise<SearchResult[]> {
  try {
    // Build the exact query format requested
    const locationPart = location ? ` ${location}` : '';
    const searchTerms = [
      '"best order"',
      '"what to order"', 
      '"must try"',
      '"must get"',
      'recommendations',
      '"favorite dish"',
      '"go-to order"',
      '"best thing on the menu"',
      '"underrated"',
      '"popular"',
      '"worth it"',
      'review'
    ].join(' OR ');
    
    const query = `site:reddit.com "${restaurantName}"${locationPart} (${searchTerms})`;
    
    console.log(`🔍 Searching Reddit for: ${restaurantName}`);
    
    const results = await webSearch(query, 10);
    console.log(`🌐 Found ${results.length} web results`);
    
    // Filter to ensure we only get Reddit URLs and relevant results
    const redditResults = results
      .filter(result => result.url && result.url.includes('reddit.com'))
      .filter(result => !result.url.includes('/user/')) // Exclude user profiles
      .filter(result => !result.url.includes('/r/all')) // Exclude generic r/all
      .filter(result => {
        // Ensure the result is actually about menu recommendations
        const text = `${result.title || ''} ${result.snippet || ''}`.toLowerCase();
        const menuKeywords = ['order', 'menu', 'recommend', 'try', 'best', 'dish', 'worth'];
        return menuKeywords.some(keyword => text.includes(keyword));
      })
      .slice(0, 5); // Top 5 Reddit results
    
    console.log(`✅ Filtered to ${redditResults.length} Reddit posts`);
    
    return redditResults;
  } catch (error) {
    console.error('❌ Error searching Reddit menu recommendations:', error);
    throw error;
  }
}

 