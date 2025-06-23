import { RedditComment, RedditSearchParams } from '@/types';

/**
 * Validates Reddit search parameters
 */
export function validateRedditParams(params: RedditSearchParams): boolean {
  if (!params.restaurantName || params.restaurantName.length < 2) {
    return false;
  }
  
  return true;
}

/**
 * Filters Reddit comments by relevance and quality
 */
export function filterQualityComments(comments: RedditComment[]): RedditComment[] {
  return comments
    .filter(comment => {
      // Filter out low-quality comments
      if (comment.score < 2) return false;
      if (comment.body.length < 20) return false;
      if (comment.body.toLowerCase().includes('deleted')) return false;
      if (comment.body.toLowerCase().includes('removed')) return false;
      
      return true;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 25); // Top 25 quality comments
}

/**
 * Extracts restaurant mentions from comment text
 */
export function extractRestaurantMentions(
  comments: RedditComment[],
  restaurantName: string
): RedditComment[] {
  const keywords = restaurantName.toLowerCase().split(' ');
  
  return comments.filter(comment => {
    const text = comment.body.toLowerCase();
    return keywords.some(keyword => text.includes(keyword));
  });
} 