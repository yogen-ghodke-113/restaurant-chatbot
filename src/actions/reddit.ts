/**
 * Reddit API integration for restaurant recommendations
 * 
 * CURRENT LIMITS & IMPLEMENTATION:
 * 
 * 1. REDDIT API LIMITS (Public JSON endpoints):
 *    - No explicit rate limits on public JSON endpoints
 *    - Recommended: 1 request per second to be respectful
 *    - Reddit may impose temporary blocks if too many requests
 *    
 * 2. OUR IMPLEMENTATION LIMITS:
 *    - Max 50 comments per Reddit post (sorted by score)
 *    - Max 3 reply levels deep to avoid infinite recursion
 *    - Max 5 Reddit posts processed per search
 *    - Only comments with score ≥1 and length >10 chars
 *    - Total comments across all posts limited to 100
 *    
 * 3. REDDIT SEARCH FLOW:
 *    - Web search finds Reddit URLs about menu recommendations
 *    - Fetch each Reddit post's JSON (includes post + comments)
 *    - Process comments recursively (replies to replies)
 *    - Filter by relevance and score
 *    - Feed to LLM for menu recommendation extraction
 *    
 * 4. FALLBACK HANDLING:
 *    - If Reddit API fails: graceful degradation
 *    - If LLM analysis fails: pattern matching fallback
 *    - If web search fails: general restaurant search
 */

'use server';

import { 
  RedditComment, 
  RedditPost, 
  RedditSearchResponse,
  RedditSearchParams,
  CustomAPIError 
} from '@/types';

const REDDIT_CLIENT_ID = process.env.REDDIT_CLIENT_ID;
const REDDIT_CLIENT_SECRET = process.env.REDDIT_CLIENT_SECRET;
const REDDIT_API_BASE = 'https://oauth.reddit.com';
const REDDIT_AUTH_URL = 'https://www.reddit.com/api/v1/access_token';

// Cache for access token
let accessToken: string | null = null;
let tokenExpiresAt: number = 0;

/**
 * Gets Reddit OAuth access token using client credentials flow
 */
async function getAccessToken(): Promise<string> {
  // Check if we have a valid cached token
  if (accessToken && Date.now() < tokenExpiresAt) {
    return accessToken;
  }

  if (!REDDIT_CLIENT_ID || !REDDIT_CLIENT_SECRET) {
    throw new Error('Reddit API credentials not configured');
  }

  try {
    const credentials = btoa(`${REDDIT_CLIENT_ID}:${REDDIT_CLIENT_SECRET}`);
    
    const response = await fetch(REDDIT_AUTH_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'User-Agent': 'RestaurantBot/1.0',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });

    if (!response.ok) {
      throw new Error(`Reddit auth failed: ${response.status}`);
    }

    const data = await response.json();
    
    accessToken = data.access_token;
    tokenExpiresAt = Date.now() + (data.expires_in * 1000) - 60000; // 1 minute buffer
    
    console.log('Reddit access token obtained successfully');
    
    if (!accessToken) {
      throw new Error('Access token is null');
    }
    return accessToken;
  } catch (error) {
    console.error('Error getting Reddit access token:', error);
    throw error;
  }
}

/**
 * Searches Reddit for restaurant-related posts
 */
export async function searchRedditPosts(
  restaurantName: string,
  location?: string,
  subreddits: string[] = ['nyc', 'AskNYC', 'FoodNYC', 'food', 'restaurants']
): Promise<RedditPost[]> {
  try {
    const token = await getAccessToken();
    const posts: RedditPost[] = [];
    
    // Search in multiple subreddits
    for (const subreddit of subreddits.slice(0, 3)) { // Limit to 3 subreddits for speed
      try {
        const searchTerm = location 
          ? `${restaurantName} ${location}`
          : restaurantName;
        
        const response = await fetch(
          `${REDDIT_API_BASE}/r/${subreddit}/search?q=${encodeURIComponent(searchTerm)}&restrict_sr=true&sort=relevance&limit=10`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'User-Agent': 'RestaurantBot/1.0'
            }
          }
        );

        if (response.ok) {
          const data: RedditSearchResponse = await response.json();
          
          const subredditPosts = data.data.children
            .map(child => child.data)
            .filter(post => {
              const title = (post.title || '').toLowerCase();
              const selftext = (post.selftext || '').toLowerCase();
              const searchTerms = restaurantName.toLowerCase().split(' ');
              
              // Check if post contains restaurant name or significant parts of it
              return searchTerms.some(term => 
                term.length > 2 && (title.includes(term) || selftext.includes(term))
              ) || title.includes(restaurantName.toLowerCase()) || selftext.includes(restaurantName.toLowerCase());
            })
            .slice(0, 3); // Top 3 posts per subreddit
          
          posts.push(...subredditPosts);
        }
      } catch (error) {
        console.warn(`Error searching r/${subreddit}:`, error);
        continue; // Continue with other subreddits
      }
    }
    
    // Sort by score and return top results
    return posts
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
      
  } catch (error) {
    console.error('Error searching Reddit posts:', error);
    
    // Fallback to public JSON endpoints if OAuth fails
    return await searchRedditPostsPublic(restaurantName, location);
  }
}

/**
 * Fallback method using public Reddit JSON endpoints
 */
async function searchRedditPostsPublic(
  restaurantName: string,
  location?: string
): Promise<RedditPost[]> {
  const subreddits = ['nyc', 'AskNYC', 'FoodNYC'];
  const posts: RedditPost[] = [];
  
  for (const subreddit of subreddits) {
    try {
      // Search recent posts in subreddit
      const response = await fetch(
        `https://www.reddit.com/r/${subreddit}/new.json?limit=100`,
        {
          headers: {
            'User-Agent': 'RestaurantBot/1.0'
          }
        }
      );
      
      if (response.ok) {
        const data: RedditSearchResponse = await response.json();
        
        const relevantPosts = data.data.children
          .map(child => child.data)
          .filter(post => {
            const text = `${post.title} ${post.selftext || ''}`.toLowerCase();
            const searchTerms = restaurantName.toLowerCase().split(' ');
            
            // Check if post contains restaurant name or significant parts of it
            return searchTerms.some(term => 
              term.length > 2 && text.includes(term)
            ) || text.includes(restaurantName.toLowerCase());
          })
          .slice(0, 2);
        
        posts.push(...relevantPosts);
      }
    } catch (error) {
      console.warn(`Error with public Reddit API for r/${subreddit}:`, error);
    }
  }
  
  return posts.sort((a, b) => b.score - a.score).slice(0, 5);
}

/**
 * Gets comments from a Reddit post using public JSON endpoint
 */
export async function getRedditComments(url: string): Promise<RedditComment[]> {
  try {
    // Convert Reddit URL to JSON API endpoint
    let jsonUrl = url;
    
    // Handle different Reddit URL formats
    if (!url.endsWith('.json')) {
      jsonUrl = url.replace(/\/$/, '') + '.json';
    }
    
    console.log(`💬 Fetching comments from: ${jsonUrl}`);
    
    const response = await fetch(jsonUrl, {
      headers: {
        'User-Agent': 'RestaurantBot/1.0'
      }
    });

    if (!response.ok) {
      console.error(`❌ Reddit API error: ${response.status} for ${jsonUrl}`);
      throw new Error(`Reddit API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Reddit returns an array: [post, comments]
    if (!Array.isArray(data) || data.length < 2) {
      console.error(`❌ Invalid Reddit JSON response structure for ${jsonUrl}`);
      throw new Error('Invalid Reddit JSON response structure');
    }
    
    const postData = data[0]?.data?.children?.[0]?.data;
    const commentsData = data[1]?.data?.children || [];
    
    console.log(`📋 Reddit Post: ${postData?.title || 'N/A'} (${commentsData.length} comments)`);
    
    const comments: RedditComment[] = [];
    
    // Process comments recursively
    function processComment(commentData: any, depth: number = 0): void {
      if (!commentData.data || commentData.data.body === '[deleted]' || commentData.data.body === '[removed]') {
        return;
      }
      
      const comment: RedditComment = {
        id: commentData.data.id,
        body: commentData.data.body,
        score: commentData.data.score || 0,
        author: commentData.data.author || 'unknown',
        created: commentData.data.created_utc || 0,
        permalink: `https://reddit.com${commentData.data.permalink}`,
        depth
      };
      
      // Only include comments with reasonable score and content
      if (comment.score >= 1 && comment.body.length > 10) {
        comments.push(comment);
      }
      
      // Process replies (limit depth to avoid infinite recursion)
      if (depth < 3 && commentData.data.replies && commentData.data.replies.data) {
        commentData.data.replies.data.children.forEach((reply: any) => {
          processComment(reply, depth + 1);
        });
      }
    }
    
    // Process all top-level comments
    commentsData.forEach((comment: any) => processComment(comment));
    
    // Sort by score and return top comments
    const sortedComments = comments
      .sort((a, b) => b.score - a.score)
      .slice(0, 50); // Limit to top 50 comments per post
    
    console.log(`✅ Processed ${comments.length} comments, selected top ${sortedComments.length}`);
    
    return sortedComments;
  } catch (error) {
    console.error('❌ Error getting Reddit comments:', error);
    throw new CustomAPIError({
      code: 'REDDIT_COMMENTS_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      details: { url }
    });
  }
}

/**
 * Gets Reddit data for a restaurant (posts + comments)
 */
export async function getRedditData(
  restaurantName: string,
  location?: string
): Promise<{
  posts: RedditPost[];
  comments: RedditComment[];
  summary: string;
}> {
  try {
    console.log(`Getting Reddit data for: ${restaurantName}`);
    
    // Get relevant posts
    const posts = await searchRedditPosts(restaurantName, location);
    
    if (posts.length === 0) {
      return {
        posts: [],
        comments: [],
        summary: `No Reddit discussions found for ${restaurantName}.`
      };
    }
    
    // Get comments from top posts
    const allComments: RedditComment[] = [];
    const topPosts = posts.slice(0, 3); // Limit to top 3 posts
    
    for (const post of topPosts) {
      try {
        const postComments = await getRedditComments(`https://reddit.com${post.permalink}`);
        allComments.push(...postComments);
      } catch (error) {
        console.warn(`Error getting comments for post ${post.id}:`, error);
        continue;
      }
    }
    
    // Sort all comments by score and limit
    const topComments = allComments
      .sort((a, b) => b.score - a.score)
      .slice(0, 100); // Limit to top 100 comments total
    
    const summary = `Found ${posts.length} Reddit posts and ${topComments.length} comments about ${restaurantName}.`;
    
    return {
      posts,
      comments: topComments,
      summary
    };
  } catch (error) {
    console.error('Error getting Reddit data:', error);
    throw new CustomAPIError({
      code: 'REDDIT_DATA_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      details: { restaurantName, location }
    });
  }
}

/**
 * Searches for specific restaurant mentions in Reddit comments
 */
export async function searchRedditComments(
  restaurantName: string,
  subreddits: string[] = ['nyc', 'AskNYC', 'FoodNYC'],
  limit: number = 50
): Promise<RedditComment[]> {
  try {
    // This would typically use Pushshift API for better comment search
    // For MVP, we'll use the post-based approach above
    console.log(`Searching Reddit comments for: ${restaurantName}`);
    
    const redditData = await getRedditData(restaurantName);
    return redditData.comments.slice(0, limit);
  } catch (error) {
    console.error('Error searching Reddit comments:', error);
    return [];
  }
}

