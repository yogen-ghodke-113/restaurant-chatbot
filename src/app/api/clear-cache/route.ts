import { NextRequest, NextResponse } from 'next/server';

/**
 * Development-only API endpoint to clear server-side cache
 * This endpoint helps during development to ensure fresh data
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🧹 Server-side cache clearing initiated...');
    
    // Clear any Node.js module cache (development only)
    if (process.env.NODE_ENV === 'development') {
      // Clear require cache for dynamic imports
      Object.keys(require.cache).forEach(key => {
        if (!key.includes('node_modules')) {
          delete require.cache[key];
        }
      });
      console.log('✅ Cleared Node.js module cache');
    }
    
    // Clear any in-memory caches
    // (Add any specific cache clearing logic here for your app)
    
    // Clear Next.js cache
    if (typeof global !== 'undefined') {
      // Clear any global variables that might be caching data
      const globalAny = global as any;
      if (globalAny.__restaurant_cache__) {
        delete globalAny.__restaurant_cache__;
        console.log('✅ Cleared global restaurant cache');
      }
      if (globalAny.__reddit_cache__) {
        delete globalAny.__reddit_cache__;
        console.log('✅ Cleared global Reddit cache');
      }
      if (globalAny.__places_cache__) {
        delete globalAny.__places_cache__;
        console.log('✅ Cleared global Places API cache');
      }
    }
    
    console.log('🎉 Server-side cache clearing completed!');
    
    return NextResponse.json({
      success: true,
      message: 'Server-side cache cleared successfully',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV
    });
    
  } catch (error) {
    console.error('❌ Error clearing server-side cache:', error);
    
    return NextResponse.json({
      success: false,
      message: 'Failed to clear server-side cache',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

/**
 * GET endpoint for health check
 */
export async function GET() {
  return NextResponse.json({
    message: 'Cache clearing endpoint is available',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString()
  });
} 