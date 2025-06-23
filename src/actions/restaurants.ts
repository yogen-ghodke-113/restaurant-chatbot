'use server';

import { 
  Place, 
  GooglePlacesTextSearchResponse, 
  GooglePlaceDetailsResponse,
  RestaurantSearchParams,
  CustomAPIError 
} from '@/types';
import { getTop5Restaurants } from '@/lib/scoring';
import { resolveLocationCoordinates } from './intelligent-agents';

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY!;
const PLACES_API_BASE = 'https://places.googleapis.com/v1/places';

if (!process.env.GOOGLE_API_KEY) {
  throw new Error('GOOGLE_API_KEY environment variable is required');
}

/**
 * Searches for restaurants using Google Places Text Search API
 */
export async function searchRestaurants(
  cuisine: string, 
  location: string,
  maxResults: number = 20
): Promise<Place[]> {
  const startTime = Date.now();
  
  try {
    const textQuery = `${cuisine} restaurants in ${location}`;
    
    const response = await fetch(`${PLACES_API_BASE}:searchText`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_API_KEY,
        'X-Goog-FieldMask': 'places.id,places.name,places.displayName,places.rating,places.userRatingCount,places.priceLevel,places.location,places.formattedAddress,places.types'
      },
      body: JSON.stringify({
        textQuery,
        maxResultCount: maxResults,
        locationBias: await getLocationBias(location)
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Google Places API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    // Places API response received successfully
    
    if (!data.places) {
      console.warn('No places returned from Google Places API');
      return [];
    }

    // Convert to our Place interface and filter restaurants
    const places: Place[] = data.places
      .filter((place: any) => place.types?.includes('restaurant'))
      .map((place: any) => convertToPlace(place));

    // Apply our scoring algorithm to get top 5
    const topRestaurants = getTop5Restaurants(places);
    
    const processingTime = Date.now() - startTime;
    console.log(`Restaurant search completed in ${processingTime}ms`);
    
    return topRestaurants;
  } catch (error) {
    console.error('Error searching restaurants:', error);
    throw new CustomAPIError({
      code: 'RESTAURANT_SEARCH_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      details: { cuisine, location, maxResults }
    });
  }
}

/**
 * Gets detailed information for a specific restaurant
 */
export async function getRestaurantDetails(placeId: string): Promise<Place> {
  try {
    const response = await fetch(`${PLACES_API_BASE}/${placeId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_API_KEY,
        'X-Goog-FieldMask': 'id,name,displayName,rating,userRatingCount,priceLevel,reviews,currentOpeningHours,photos,formattedAddress,location'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Google Places API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return convertToPlace(data);
  } catch (error) {
    console.error('Error getting restaurant details:', error);
    throw new CustomAPIError({
      code: 'RESTAURANT_DETAILS_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      details: { placeId }
    });
  }
}

/**
 * Searches for restaurants near a specific location
 */
export async function searchNearbyRestaurants(
  latitude: number,
  longitude: number,
  radius: number = 1500,
  maxResults: number = 20
): Promise<Place[]> {
  try {
    const response = await fetch(`${PLACES_API_BASE}:searchNearby`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_API_KEY,
        'X-Goog-FieldMask': 'places.id,places.name,places.displayName,places.rating,places.userRatingCount,places.priceLevel,places.location,places.formattedAddress'
      },
      body: JSON.stringify({
        includedTypes: ['restaurant'],
        maxResultCount: maxResults,
        locationRestriction: {
          circle: {
            center: { latitude, longitude },
            radius
          }
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Google Places API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.places) {
      return [];
    }

    const places: Place[] = data.places.map((place: any) => convertToPlace(place));
    return getTop5Restaurants(places);
  } catch (error) {
    console.error('Error searching nearby restaurants:', error);
    throw new CustomAPIError({
      code: 'NEARBY_SEARCH_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      details: { latitude, longitude, radius }
    });
  }
}

/**
 * Gets multiple restaurant details in parallel
 */
export async function getMultipleRestaurantDetails(placeIds: string[]): Promise<Place[]> {
  try {
    const promises = placeIds.map(placeId => getRestaurantDetails(placeId));
    const results = await Promise.allSettled(promises);
    
    return results
      .filter((result): result is PromiseFulfilledResult<Place> => result.status === 'fulfilled')
      .map(result => result.value);
  } catch (error) {
    console.error('Error getting multiple restaurant details:', error);
    throw error;
  }
}

/**
 * Converts Google Places API response to our Place interface
 */
function convertToPlace(googlePlace: any): Place {
  // Converting Google Places API response to internal format
  
  // Extract the actual restaurant name - try multiple possible fields
  let restaurantName = 'Unknown Restaurant';
  if (googlePlace.displayName?.text) {
    // Clean up any encoding issues
    restaurantName = googlePlace.displayName.text
      .replace(/├Æ/g, 'Ó')
      .replace(/├ù/g, 'Ñ')
      .replace(/├®/g, 'É')
      .trim();
  } else if (googlePlace.displayName) {
    restaurantName = googlePlace.displayName;
  } else if (googlePlace.name && !googlePlace.name.startsWith('places/')) {
    restaurantName = googlePlace.name;
  } else {
    // Fallback: Try to extract from address or use a descriptive name
    const address = googlePlace.formattedAddress || '';
    const addressParts = address.split(',');
    if (addressParts.length > 0) {
      const streetAddress = addressParts[0].trim();
      if (streetAddress) {
        restaurantName = `Restaurant at ${streetAddress}`;
      }
    }
  }
  
  // Convert price level from string to number
  let numericPriceLevel: number | undefined;
  if (googlePlace.priceLevel) {
    switch (googlePlace.priceLevel) {
      case 'PRICE_LEVEL_FREE':
        numericPriceLevel = 0;
        break;
      case 'PRICE_LEVEL_INEXPENSIVE':
        numericPriceLevel = 1;
        break;
      case 'PRICE_LEVEL_MODERATE':
        numericPriceLevel = 2;
        break;
      case 'PRICE_LEVEL_EXPENSIVE':
        numericPriceLevel = 3;
        break;
      case 'PRICE_LEVEL_VERY_EXPENSIVE':
        numericPriceLevel = 4;
        break;
      default:
        numericPriceLevel = undefined;
    }
  }
  
  // Place conversion completed
  
  return {
    id: googlePlace.id,
    place_id: googlePlace.id, // Legacy compatibility
    name: restaurantName,
    rating: googlePlace.rating || 0,
    userRatingCount: googlePlace.userRatingCount || 0,
    user_ratings_total: googlePlace.userRatingCount || 0, // Legacy compatibility
    priceLevel: numericPriceLevel,
    price_level: numericPriceLevel, // Legacy compatibility
    formattedAddress: googlePlace.formattedAddress || '',
    vicinity: googlePlace.formattedAddress || '', // Legacy compatibility
    location: {
      latitude: googlePlace.location?.latitude || 0,
      longitude: googlePlace.location?.longitude || 0
    },
    geometry: googlePlace.location ? {
      location: {
        lat: googlePlace.location.latitude,
        lng: googlePlace.location.longitude
      }
    } : undefined,
    photos: googlePlace.photos?.map((photo: any) => ({
      name: photo.name,
      widthPx: photo.widthPx,
      heightPx: photo.heightPx
    })),
    reviews: googlePlace.reviews?.map((review: any) => ({
      name: review.name,
      relativePublishTimeDescription: review.relativePublishTimeDescription,
      rating: review.rating,
      text: review.text,
      originalText: review.originalText,
      authorAttribution: review.authorAttribution,
      publishTime: review.publishTime
    })),
    currentOpeningHours: googlePlace.currentOpeningHours,
    opening_hours: googlePlace.currentOpeningHours ? {
      open_now: googlePlace.currentOpeningHours.openNow
    } : undefined,
    types: googlePlace.types || ['restaurant']
  };
}

/**
 * Gets location bias for improved search results using intelligent location resolution
 */
async function getLocationBias(location: string) {
  try {
    // 🧠 Use intelligent agent to resolve location coordinates
    const locationResult = await resolveLocationCoordinates(location);
    
    console.log(`🗺️ Location resolved: ${location} → ${locationResult.normalizedName}`);
    console.log(`📍 Coordinates: ${locationResult.coordinates.lat}, ${locationResult.coordinates.lng}`);
    
    return {
      circle: {
        center: { 
          latitude: locationResult.coordinates.lat, 
          longitude: locationResult.coordinates.lng 
        },
        radius: 2000 // 2km radius
      }
    };
  } catch (error) {
    console.error('Error resolving location with AI:', error);
    
    // No fallback - throw error if location resolution fails
    throw new Error(`Unable to resolve location "${location}" - please provide a more specific location`);
  }
}

 