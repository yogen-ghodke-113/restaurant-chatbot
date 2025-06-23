// Google Places API Types
export interface Place {
  id: string;
  place_id?: string;
  name: string;
  rating: number;
  userRatingCount: number;
  user_ratings_total?: number; // Legacy field name
  priceLevel?: number;
  price_level?: number; // Legacy field name
  formattedAddress: string;
  vicinity?: string; // Legacy field name
  location: {
    latitude: number;
    longitude: number;
  };
  geometry?: {
    location: {
      lat: number;
      lng: number;
    };
  };
  photos?: PlacePhoto[];
  reviews?: PlaceReview[];
  currentOpeningHours?: {
    openNow: boolean;
    periods?: OpeningPeriod[];
  };
  opening_hours?: {
    open_now: boolean;
  };
  types?: string[];
}

export interface PlacePhoto {
  name: string;
  widthPx: number;
  heightPx: number;
}

export interface PlaceReview {
  name: string;
  relativePublishTimeDescription: string;
  rating: number;
  text: {
    text: string;
    languageCode: string;
  };
  originalText?: {
    text: string;
    languageCode: string;
  };
  authorAttribution: {
    displayName: string;
    uri: string;
    photoUri?: string;
  };
  publishTime: string;
}

export interface OpeningPeriod {
  open: {
    day: number;
    hour: number;
    minute: number;
  };
  close?: {
    day: number;
    hour: number;
    minute: number;
  };
}

// Web Search Types
export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  position: number;
  date?: string;
  domain?: string;
}

export interface SerperResponse {
  organic: Array<{
    title: string;
    link: string;
    snippet: string;
    position: number;
    date?: string;
  }>;
  searchParameters?: {
    q: string;
    gl: string;
    hl: string;
  };
}

// Reddit Types
export interface RedditComment {
  id: string;
  body: string;
  score: number;
  author: string;
  created: number;
  permalink: string;
  replies?: RedditComment[];
  depth?: number;
}

export interface RedditPost {
  id: string;
  title: string;
  selftext: string;
  score: number;
  author: string;
  subreddit: string;
  url: string;
  permalink: string;
  created: number;
  num_comments: number;
}

export interface RedditSearchResponse {
  kind: string;
  data: {
    children: Array<{
      kind: string;
      data: RedditPost;
    }>;
    after?: string;
    before?: string;
  };
}

// Chat System Types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  metadata?: {
    restaurants?: Place[];
    selectedRestaurant?: Place;
    quickActions?: QuickAction[];
    searchResults?: SearchResult[];
    redditData?: {
      posts: RedditPost[];
      comments: RedditComment[];
    };
    toolUsed?: 'searchRestaurants' | 'webSearch' | 'getRedditData';
    processingTime?: number;
  };
}

export interface QuickAction {
  text: string;
  action: string;
}

export interface ChatState {
  messages: ChatMessage[];
  selectedRestaurant?: Place;
  lastTop5: Place[];
  conversationId: string;
  isLoading: boolean;
  error?: string;
}

// Tool Function Types
export interface ToolResult {
  toolName: string;
  success: boolean;
  data: any;
  error?: string;
  processingTime: number;
}

export interface RestaurantSearchParams {
  cuisine: string;
  location: string;
  maxResults?: number;
}

export interface WebSearchParams {
  query: string;
  numResults?: number;
  gl?: string;
  hl?: string;
}

export interface RedditSearchParams {
  restaurantName: string;
  location?: string;
  subreddits?: string[];
  timeframe?: string;
}

// Conversation Context Types
export interface ConversationContext {
  previousQueries: string[];
  selectedRestaurant?: Place;
  availableRestaurants: Place[];
  userPreferences: {
    location?: string;
    priceRange?: 'budget' | 'moderate' | 'expensive' | 'very_expensive';
    cuisineType?: string;
    dietaryRestrictions?: string[];
  };
  sessionMetadata: {
    startTime: Date;
    queryCount: number;
    lastActivity: Date;
  };
}

// Scoring and Ranking Types
export interface RestaurantScore {
  restaurant: Place;
  score: number;
  factors: {
    ratingScore: number;
    popularityScore: number;
    reviewCountScore: number;
    qualityScore: number;
  };
  explanation: string;
}

// API Response Types
export interface GooglePlacesTextSearchResponse {
  places: Place[];
  nextPageToken?: string;
}

export interface GooglePlaceDetailsResponse {
  place: Place;
}

// Error Types
export interface APIError {
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
}

export class CustomAPIError extends Error {
  code: string;
  details?: any;
  timestamp: Date;

  constructor({ code, message, details }: { code: string; message: string; details?: any }) {
    super(message);
    this.name = 'CustomAPIError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date();
  }
}

// Function Calling Schema Types
export interface FunctionCallSchema {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
    }>;
    required: string[];
  };
}

// Gemini Function Call Types
export interface GeminiFunctionCall {
  name: string;
  args: Record<string, any>;
}

export interface GeminiResponse {
  text: string;
  functionCalls?: GeminiFunctionCall[];
  metadata?: {
    tokenCount: number;
    processingTime: number;
  };
} 