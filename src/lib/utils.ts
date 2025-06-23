/**
 * Validates restaurant search parameters
 */
export function validateSearchParams(params: { cuisine?: string; location?: string }): boolean {
  if (!params.cuisine || !params.location) {
    return false;
  }

  if (params.cuisine.length < 2 || params.location.length < 2) {
    return false;
  }

  return true;
}

/**
 * Validates web search parameters
 */
export function validateWebSearchParams(params: { query: string; numResults?: number }): boolean {
  if (!params.query || params.query.length < 2) {
    return false;
  }
  
  if (params.numResults && (params.numResults < 1 || params.numResults > 100)) {
    return false;
  }
  
  return true;
}

/**
 * Creates optimized search queries for different intents
 */
export function createSearchQuery(intent: string, restaurantName: string, location?: string): string {
  const locationPart = location ? ` ${location}` : '';
  
  switch (intent) {
    case 'menu':
      return `"what to order at ${restaurantName}" menu recommendations${locationPart}`;
    
    case 'reddit':
      return `site:reddit.com "${restaurantName}"${locationPart} restaurant review`;
    
    case 'pricing':
      return `"${restaurantName}"${locationPart} expensive price cost menu`;
    
    case 'hours':
      return `"${restaurantName}"${locationPart} hours open closed`;
    
    case 'reviews':
      return `"${restaurantName}"${locationPart} restaurant review`;
    
    case 'delivery':
      return `"${restaurantName}"${locationPart} delivery takeout order`;
    
    default:
      return `"${restaurantName}"${locationPart} restaurant`;
  }
}

/**
 * Filters search results by relevance score
 */
export function filterByRelevance(
  results: any[],
  keywords: string[]
): any[] {
  return results
    .map(result => ({
      ...result,
      relevanceScore: calculateRelevanceScore(result, keywords)
    }))
    .filter(result => result.relevanceScore > 0)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 10);
}

/**
 * Calculates relevance score based on keyword matches
 */
function calculateRelevanceScore(result: { title: string; snippet: string }, keywords: string[]): number {
  let score = 0;
  const text = `${result.title} ${result.snippet}`.toLowerCase();
  
  keywords.forEach(keyword => {
    const keywordLower = keyword.toLowerCase();
    const titleMatches = (result.title.toLowerCase().match(new RegExp(keywordLower, 'g')) || []).length;
    const snippetMatches = (result.snippet.toLowerCase().match(new RegExp(keywordLower, 'g')) || []).length;
    
    score += titleMatches * 3 + snippetMatches; // Title matches weighted higher
  });
  
  return score;
}

/**
 * Helper function to get price level emoji
 */
export function getPriceLevelEmoji(priceLevel?: number): string {
  switch (priceLevel) {
    case 1: return '💵';
    case 2: return '💰';
    case 3: return '💸';
    case 4: return '💎';
    default: return '💰';
  }
}

/**
 * Generate a UUID v4 compatible string that works in all browsers
 */
export function generateUUID(): string {
  // Try to use crypto.randomUUID if available (modern browsers)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // Fallback for older browsers or environments
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Comprehensive cache clearing utility
 * Clears localStorage, sessionStorage, cookies, and other cached data
 */
export async function clearAllCache(): Promise<void> {
  try {
    console.log('🧹 Clearing all browser cache and storage...');
    
    // Clear localStorage
    if (typeof localStorage !== 'undefined') {
      const localStorageKeys = Object.keys(localStorage);
      localStorageKeys.forEach(key => {
        localStorage.removeItem(key);
      });
      console.log('✅ Cleared localStorage');
    }
    
    // Clear sessionStorage
    if (typeof sessionStorage !== 'undefined') {
      const sessionStorageKeys = Object.keys(sessionStorage);
      sessionStorageKeys.forEach(key => {
        sessionStorage.removeItem(key);
      });
      console.log('✅ Cleared sessionStorage');
    }
    
    // Clear cookies
    if (typeof document !== 'undefined') {
      const cookies = document.cookie.split(';');
      cookies.forEach(cookie => {
        const eqPos = cookie.indexOf('=');
        const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie;
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${window.location.hostname}`;
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=.${window.location.hostname}`;
      });
      console.log('✅ Cleared cookies');
    }
    
    // Clear IndexedDB databases
    if (typeof indexedDB !== 'undefined') {
      try {
        const databases = await indexedDB.databases();
        await Promise.all(databases.map(db => {
          if (db.name) {
            return indexedDB.deleteDatabase(db.name);
          }
        }));
        console.log(`✅ Cleared IndexedDB (${databases.length} databases)`);
      } catch (error) {
        console.warn('Could not clear IndexedDB:', error);
      }
    }
    
    // Clear Cache API (Service Workers)
    if ('caches' in window) {
      try {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));
        console.log(`✅ Cleared Cache API (${cacheNames.length} caches)`);
      } catch (error) {
        console.warn('Could not clear Cache API:', error);
      }
    }
    
    // Clear any Next.js specific cache
    if (typeof window !== 'undefined' && window.__NEXT_DATA__) {
      (window as any).__NEXT_DATA__ = undefined;
      console.log('✅ Cleared Next.js cache data');
    }
    
    // Clear server-side cache via API
    if (typeof window !== 'undefined') {
      try {
        const response = await fetch('/api/clear-cache', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log('✅ Cleared server-side cache:', result.message);
        } else {
          console.warn('❌ Server-side cache clearing failed:', response.statusText);
        }
      } catch (error) {
        console.warn('Could not clear server-side cache:', error);
      }
    }
    
    console.log('🎉 Complete cache clearing finished successfully!');
    
  } catch (error) {
    console.error('❌ Error clearing cache:', error);
  }
}

/**
 * Clear specific restaurant chat cache
 */
export function clearChatCache(): void {
  try {
    const chatKeys = [
      'restaurant-chat-state',
      'restaurant-search-cache',
      'reddit-cache',
      'places-api-cache',
      'gemini-cache'
    ];
    
    chatKeys.forEach(key => {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(key);
      }
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem(key);
      }
    });
    
    console.log('✅ Cleared restaurant chat cache');
  } catch (error) {
    console.error('❌ Error clearing chat cache:', error);
  }
} 