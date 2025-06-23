import { Place, RestaurantScore } from '@/types';

/**
 * Scores a restaurant using our composite algorithm
 * Formula: rating × log10(1 + review_count)
 * This balances quality (rating) with popularity (review volume)
 */
export function scoreRestaurant(place: Place): number {
  const rating = place.rating || 0;
  const reviewCount = place.userRatingCount || place.user_ratings_total || 0;
  
  // Minimum threshold to avoid single-review bias
  if (reviewCount < 50) return 0;
  
  // Composite score: rating × log(review_count)
  // This weights popular places higher while not completely drowning small gems
  const score = rating * Math.log10(1 + reviewCount);
  
  return Math.round(score * 100) / 100; // Round to 2 decimal places
}

/**
 * Calculates detailed scoring factors for explanation
 */
export function getDetailedScore(place: Place): RestaurantScore {
  const rating = place.rating || 0;
  const reviewCount = place.userRatingCount || place.user_ratings_total || 0;
  
  const ratingScore = rating * 2; // Max 10 points for rating
  const popularityScore = Math.min(Math.log10(1 + reviewCount) * 2, 6); // Max 6 points for popularity
  const reviewCountScore = Math.min(reviewCount / 100, 4); // Max 4 points for review volume
  const qualityScore = rating >= 4.5 ? 2 : rating >= 4.0 ? 1 : 0; // Bonus for high quality
  
  const totalScore = scoreRestaurant(place);
  
  const explanation = generateScoreExplanation(place, {
    ratingScore,
    popularityScore,
    reviewCountScore,
    qualityScore
  });
  
  return {
    restaurant: place,
    score: totalScore,
    factors: {
      ratingScore,
      popularityScore,
      reviewCountScore,
      qualityScore
    },
    explanation
  };
}

/**
 * Filters and returns top 5 restaurants based on our scoring algorithm
 */
export function getTop5Restaurants(places: Place[]): Place[] {
  return places
    .filter(place => {
      const reviewCount = place.userRatingCount || place.user_ratings_total || 0;
      return reviewCount >= 50; // Minimum review threshold
    })
    .sort((a, b) => scoreRestaurant(b) - scoreRestaurant(a))
    .slice(0, 5);
}

/**
 * Gets top restaurants with detailed scoring information
 */
export function getTop5WithScores(places: Place[]): RestaurantScore[] {
  return places
    .filter(place => {
      const reviewCount = place.userRatingCount || place.user_ratings_total || 0;
      return reviewCount >= 50;
    })
    .map(place => getDetailedScore(place))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

/**
 * Explains the ranking methodology in human-readable format
 */
export function explainRanking(places: Place[]): string {
  if (places.length === 0) {
    return "No restaurants found that meet our minimum criteria (50+ reviews).";
  }
  
  const topPlace = places[0];
  const rating = topPlace.rating || 0;
  const reviewCount = topPlace.userRatingCount || topPlace.user_ratings_total || 0;
  const score = scoreRestaurant(topPlace);
  
  return `Restaurants are ranked using our composite scoring system: Rating × log10(1 + Review Count). 
This ensures we balance quality with popularity while filtering out places with fewer than 50 reviews.

Top recommendation: ${topPlace.name} 
- Rating: ${rating}★ 
- Reviews: ${reviewCount.toLocaleString()} 
- Score: ${score}

This scoring method prevents highly-rated restaurants with very few reviews from dominating the rankings while still recognizing genuinely excellent establishments.`;
}

/**
 * Generates a detailed explanation for a restaurant's score
 */
function generateScoreExplanation(place: Place, factors: RestaurantScore['factors']): string {
  const rating = place.rating || 0;
  const reviewCount = place.userRatingCount || place.user_ratings_total || 0;
  
  let explanation = `${place.name} scores well because of `;
  const reasons: string[] = [];
  
  if (rating >= 4.5) {
    reasons.push(`excellent ${rating}★ rating`);
  } else if (rating >= 4.0) {
    reasons.push(`strong ${rating}★ rating`);
  } else {
    reasons.push(`${rating}★ rating`);
  }
  
  if (reviewCount >= 1000) {
    reasons.push(`high popularity (${reviewCount.toLocaleString()} reviews)`);
  } else if (reviewCount >= 500) {
    reasons.push(`good popularity (${reviewCount} reviews)`);
  } else {
    reasons.push(`${reviewCount} reviews`);
  }
  
  if (factors.qualityScore > 0) {
    reasons.push(`quality bonus for ${rating}+ stars`);
  }
  
  explanation += reasons.join(', ') + '.';
  
  return explanation;
}

/**
 * Compares two restaurants and explains the difference
 */
export function compareRestaurants(restaurant1: Place, restaurant2: Place): string {
  const score1 = scoreRestaurant(restaurant1);
  const score2 = scoreRestaurant(restaurant2);
  const details1 = getDetailedScore(restaurant1);
  const details2 = getDetailedScore(restaurant2);
  
  const winner = score1 > score2 ? restaurant1 : restaurant2;
  const loser = score1 > score2 ? restaurant2 : restaurant1;
  const winnerScore = Math.max(score1, score2);
  const loserScore = Math.min(score1, score2);
  
  return `**${winner.name}** ranks higher with a score of ${winnerScore} vs ${loser.name}'s ${loserScore}.

${details1.explanation}

${details2.explanation}

The ranking considers both rating quality and review volume to provide balanced recommendations.`;
}

/**
 * Validates if a restaurant meets our minimum quality standards
 */
export function meetsQualityStandards(place: Place): boolean {
  const rating = place.rating || 0;
  const reviewCount = place.userRatingCount || place.user_ratings_total || 0;
  
  return rating >= 3.5 && reviewCount >= 50;
}

/**
 * Gets price level description
 */
export function getPriceLevelDescription(priceLevel?: number): string {
  if (!priceLevel) return 'Price not available';
  
  switch (priceLevel) {
    case 1:
      return 'Budget-friendly ($)';
    case 2:
      return 'Moderate ($$)';
    case 3:
      return 'Expensive ($$$)';
    case 4:
      return 'Very Expensive ($$$$)';
    default:
      return 'Price not available';
  }
} 