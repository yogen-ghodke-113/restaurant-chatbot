'use client';

import { Place } from '@/types';
import { StarIcon, MapPinIcon } from '@heroicons/react/24/solid';
import { getPriceLevelEmoji } from '@/lib/utils';

interface RestaurantCardProps {
  restaurant: Place;
  isSelected?: boolean;
  onSelect: (restaurant: Place) => void;
  rank?: number;
  showFullDetails?: boolean;
}

export function RestaurantCard({ 
  restaurant, 
  isSelected = false, 
  onSelect, 
  rank,
  showFullDetails = false 
}: RestaurantCardProps) {
  // 🔍 EXTENSIVE LOGGING FOR UI DEBUGGING
  console.log('🃏 RestaurantCard rendering with data:');
  console.log('- Restaurant object:', restaurant);
  console.log('- Name:', restaurant.name);
  console.log('- ID:', restaurant.id);
  console.log('- Rating:', restaurant.rating);
  console.log('- UserRatingCount:', restaurant.userRatingCount);
  console.log('- User_ratings_total:', restaurant.user_ratings_total);
  console.log('- PriceLevel:', restaurant.priceLevel);
  console.log('- Price_level:', restaurant.price_level);
  console.log('- FormattedAddress:', restaurant.formattedAddress);
  console.log('- Vicinity:', restaurant.vicinity);
  console.log('- Location:', restaurant.location);
  console.log('- Types:', restaurant.types);
  console.log('- Opening hours:', restaurant.currentOpeningHours);
  console.log('- Reviews:', restaurant.reviews?.length || 0, 'reviews');
  
  const rating = restaurant.rating || 0;
  const reviewCount = restaurant.userRatingCount || restaurant.user_ratings_total || 0;
  const priceLevel = restaurant.priceLevel || restaurant.price_level;
  
  console.log('📊 Computed values:');
  console.log('- Final rating:', rating);
  console.log('- Final reviewCount:', reviewCount);
  console.log('- Final priceLevel:', priceLevel);
  console.log('- Price emoji:', getPriceLevelEmoji(priceLevel));
  
  const handleClick = () => {
    onSelect(restaurant);
  };

  const getPriceLevelText = (level?: number) => {
    switch (level) {
      case 1: return 'Budget-friendly';
      case 2: return 'Moderate';
      case 3: return 'Expensive';
      case 4: return 'Very Expensive';
      default: return 'Price unavailable';
    }
  };

  const renderStars = (rating: number) => {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    
    return (
      <div className="flex items-center space-x-1">
        {[...Array(5)].map((_, i) => (
          <StarIcon
            key={i}
            className={`w-4 h-4 ${
              i < fullStars
                ? 'text-yellow-400'
                : i === fullStars && hasHalfStar
                ? 'text-yellow-300'
                : 'text-gray-300'
            }`}
          />
        ))}
        <span className="text-sm font-medium text-gray-700">{rating.toFixed(1)}</span>
      </div>
    );
  };

  return (
    <div 
      className={`border rounded-lg p-4 transition-all cursor-pointer hover:shadow-md ${
        isSelected 
          ? 'border-blue-500 bg-blue-50' 
          : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
      onClick={handleClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-2">
            {rank && (
              <span className="inline-flex items-center justify-center w-6 h-6 bg-blue-100 text-blue-800 text-sm font-semibold rounded-full">
                {rank}
              </span>
            )}
            <h3 className="font-semibold text-gray-900 text-lg leading-tight">
              {restaurant.name}
            </h3>
          </div>
          
          {/* Location */}
          <div className="flex items-center space-x-1 mt-1 text-gray-600">
            <MapPinIcon className="w-4 h-4" />
            <span className="text-sm">
              {restaurant.formattedAddress || restaurant.vicinity || 'Location unavailable'}
            </span>
          </div>
        </div>

        {/* Price Level */}
        {priceLevel && (
          <div className="text-right">
            <div className="text-lg">{getPriceLevelEmoji(priceLevel)}</div>
            {showFullDetails && (
              <div className="text-xs text-gray-600">{getPriceLevelText(priceLevel)}</div>
            )}
          </div>
        )}
      </div>

      {/* Rating and Reviews */}
      <div className="mt-3">
        {renderStars(rating)}
        <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600">
          <span>{reviewCount.toLocaleString()} reviews</span>
          {restaurant.currentOpeningHours?.openNow !== undefined && (
            <span className={`font-medium ${
              restaurant.currentOpeningHours.openNow ? 'text-green-600' : 'text-red-600'
            }`}>
              {restaurant.currentOpeningHours.openNow ? 'Open' : 'Closed'}
            </span>
          )}
        </div>
      </div>

      {/* Full Details Section */}
      {showFullDetails && (
        <div className="mt-4 space-y-3 border-t border-gray-200 pt-3">
          {/* Restaurant Types */}
          {restaurant.types && restaurant.types.length > 0 && (
            <div>
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                Cuisine Type
              </div>
              <div className="flex flex-wrap gap-1">
                {restaurant.types
                  .filter(type => type !== 'restaurant' && type !== 'food' && type !== 'establishment')
                  .slice(0, 3)
                  .map((type) => (
                    <span
                      key={type}
                      className="inline-block px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded"
                    >
                      {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </span>
                  ))}
              </div>
            </div>
          )}

          {/* Recent Reviews Preview */}
          {restaurant.reviews && restaurant.reviews.length > 0 && (
            <div>
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                Recent Review
              </div>
              <div className="bg-gray-50 rounded p-3">
                <div className="flex items-center space-x-2 mb-1">
                  <div className="flex">
                    {[...Array(5)].map((_, i) => (
                      <StarIcon
                        key={i}
                        className={`w-3 h-3 ${
                          i < restaurant.reviews![0].rating ? 'text-yellow-400' : 'text-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-gray-600">
                    by {restaurant.reviews[0].authorAttribution.displayName}
                  </span>
                </div>
                <p className="text-xs text-gray-700 line-clamp-2">
                  {restaurant.reviews[0].text.text}
                </p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-2 pt-2">
            <button className="flex-1 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded hover:bg-blue-100 transition-colors">
              Get Menu Recommendations
            </button>
            <button className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-50 rounded hover:bg-gray-100 transition-colors">
              Reddit Reviews
            </button>
          </div>
        </div>
      )}

      {/* Selection Indicator */}
      {isSelected && (
        <div className="mt-3 flex items-center space-x-2 text-blue-600">
          <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
          <span className="text-sm font-medium">Selected</span>
        </div>
      )}
    </div>
  );
} 