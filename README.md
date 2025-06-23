# 🍽️ Restaurant Recommendation Chatbot

A Next.js-powered AI chatbot that provides intelligent restaurant recommendations using multiple data sources and conversational AI.

## 🚀 Quick Start

```bash
# Clone and install
npm install

# Set up environment variables (see setup section below)
cp .env.example .env.local

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to start chatting!

## 📖 Table of Contents

- [🎯 Features](#-features)
- [⚙️ Setup Guide](#️-setup-guide)
- [🧠 AI Architecture](#-ai-architecture)
- [🗣️ Conversational Features](#️-conversational-features)
- [🤖 Intelligent Agents](#-intelligent-agents)
- [🧠 Session Memory](#-session-memory)
- [🛠️ Troubleshooting](#️-troubleshooting)
- [📊 Implementation Plan](#-implementation-plan)

---

## 🎯 Features

### 🔍 **Multi-Source Restaurant Discovery**

- **Google Places API**: Restaurant data with ratings, reviews, pricing
- **Reddit Integration**: Real user experiences and menu recommendations
- **Web Search**: Comprehensive restaurant information and reviews
- **Intelligent Ranking**: Composite scoring algorithm that balances ratings with review volume

### 🌍 **Worldwide Location Support**

- **Google Geocoding API**: Precise coordinates for any global location
- **LLM Geographic Intelligence**: Handles ambiguous location names worldwide
- **Robust Fallbacks**: Works even if geocoding services fail

### 🗣️ **Natural Conversations**

- **Greeting Handling**: Friendly responses to "hi", "hello", etc.
- **Incomplete Request Guidance**: "I want pizza" → "Where would you like me to search?"
- **Context Switching**: "Actually, I want spaghetti instead" with automatic context reset
- **Session Memory**: "What should I order there?" remembers previous restaurant

### 🧠 **LLM-Powered Intelligence**

- **Intent Classification**: Natural language understanding vs rigid pattern matching
- **Menu Analysis**: AI analyzes Reddit comments for genuine recommendations
- **Search Optimization**: Dynamic query generation for better results
- **Reference Resolution**: "Compare the top 2" automatically uses search results

---

## ⚙️ Setup Guide

### 1. Environment Variables

Create `.env.local` with the following:

```env
# Google APIs
GOOGLE_API_KEY=your_google_api_key_here

# AI Model
GEMINI_API_KEY=your_gemini_api_key_here

# Web Search
SERPER_API_KEY=your_serper_api_key_here

# Reddit (Optional)
REDDIT_CLIENT_ID=your_reddit_client_id
REDDIT_CLIENT_SECRET=your_reddit_client_secret
```

### 2. Google API Setup

#### Enable Required APIs:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create or select a project
3. Enable these APIs:
   - **Places API (New)**
   - **Geocoding API**
4. Create an API key in "APIs & Services" → "Credentials"

#### Fix "REQUEST_DENIED" Error:

If you get geocoding errors:

1. Enable **Geocoding API** in the Google Cloud Console
2. Check API key restrictions (set to "None" for testing)
3. Enable billing (required for most Google APIs)
4. Wait 5-10 minutes for changes to propagate

### 3. Additional API Keys

- **Gemini API**: Get from [Google AI Studio](https://aistudio.google.com)
- **Serper.dev**: Sign up at [serper.dev](https://serper.dev) for web search
- **Reddit API** (Optional): Create app at [reddit.com/prefs/apps](https://www.reddit.com/prefs/apps)

### 4. Test Your Setup

```bash
# Test Google Geocoding
node test-google-geocoding-simple.js

# Start the app
npm run dev
```

---

## 🧠 AI Architecture

### 🎯 **LLM Intent Classification vs Rigid Pattern Matching**

**The Problem with Pattern Matching:**

```typescript
// ❌ BREAKS with these variations:
if (/\b(reddit|what.*reddit|reddit.*say)\b/i.test(userMessage)) {
  // Reddit search
}
```

**What fails:**

- "Tell me about Reddit opinions on Junior's" ❌
- "Any Reddit threads discussing this place?" ❌
- "What's the word on Reddit about..." ❌

**The LLM Solution:**

```typescript
// ✅ WORKS with any natural phrasing:
const intent = await classifyUserIntent(userMessage);
```

**What works now:**

- "Tell me about Reddit opinions on Junior's" ✅
- "Any Reddit threads discussing this place?" ✅
- "What's the word on Reddit about..." ✅
- "Reddit discussions about this restaurant?" ✅

### 🏗️ **System Architecture**

```
User Interface (Next.js)
↓
Session Context Analysis (Gemini)
↓
Intent Classification (LLM-powered)
↓
Orchestrator (Smart Tool Selection)
↓
┌─────────────────┬─────────────────┬─────────────────┐
│ Google Places   │ Web Search      │ Reddit API      │
│ + Geocoding     │ (Serper.dev)    │ (Public JSON)   │
└─────────────────┴─────────────────┴─────────────────┘
↓
Response Synthesis (Gemini)
↓
User Interface Update
```

### 📊 **Restaurant Ranking Algorithm**

**Problem**: Avoid "1 review = 5 stars" bias while finding truly good restaurants.

**Solution**: Composite scoring system

```typescript
score = rating × log10(1 + review_count)
minimum_threshold = 50 reviews
```

**Examples**:

- Restaurant A: 4.5★ with 500 reviews = 4.5 × 2.7 = 12.15
- Restaurant B: 5.0★ with 60 reviews = 5.0 × 1.8 = 9.0
- Restaurant C: 5.0★ with 20 reviews = filtered out

---

## 🗣️ Conversational Features

### 1. **Greeting Detection**

**Handles**: "hi", "hello", "hey", "good morning", etc.

**Response**: Random friendly greeting with quick action suggestions

- "Hi there! 👋 I'm your friendly restaurant assistant. How can I help you discover amazing food today?"

**Quick Actions Generated**:

- "Find pizza places" → "best pizza in Manhattan"
- "Brunch spots" → "good brunch in Brooklyn"
- "Surprise me!" → "trending restaurants NYC"

### 2. **Incomplete Request Handling**

**Examples**:

- "I want pizza" (missing location)
- "I'm hungry" (missing cuisine and location)

**Smart Responses**:

- **Missing Location**: "Great choice! 🍕 I'd love to help you find amazing pizza places. Where would you like me to search? 📍"
- **Missing Cuisine**: "I can help you find great food! What type of cuisine are you in the mood for? 🤔"

**Context-Aware Quick Actions**:

- When cuisine is known: Location options (Manhattan, Brooklyn, Queens, Near me)
- When location is known: Cuisine options (Pizza, Italian, Asian, Mexican)

### 3. **Context Switching**

**Examples**:

- "Actually, I want spaghetti instead"
- "Never mind, let's try Chinese"

**Smart Response**:

- Acknowledges the change: "No problem! 🔄 Let's find you some great spaghetti instead."
- **Automatically clears previous context** for fresh start
- Provides relevant quick actions

### 4. **Enhanced Error Recovery**

Instead of generic help text, provides conversational responses:

- "I'm not quite sure what you're looking for, but I'm here to help with all things food! 🤔"
- Includes helpful quick actions to get users back on track

---

## 🤖 Intelligent Agents

### 🗺️ **Worldwide Location Resolution Agent**

**Capabilities**: Handles ANY location worldwide using hybrid approach:

1. **🥇 Google Geocoding API** (Primary)

   - Most accurate coordinates for any address/location globally
   - Confidence scoring based on precision level

2. **🥈 LLM Geographic Intelligence** (Fallback)

   - Comprehensive knowledge of worldwide locations
   - Handles ambiguous or colloquial location names

3. **🥉 Hardcoded Fallback** (Ultimate backup)

**Global Examples**:

```javascript
"Paris" → 48.8566, 2.3522 (Paris, France)
"Tokyo" → 35.6762, 139.6503 (Tokyo, Japan)
"Shibuya Tokyo" → 35.6598, 139.7006 (Shibuya, Tokyo, Japan)
"Eiffel Tower" → 48.8584, 2.2945 (Tour Eiffel, Paris)
"Silicon Valley" → 37.3874, -122.0575 (Silicon Valley, CA)
```

### 🍽️ **Menu Comment Analysis Agent**

Intelligently analyzes Reddit comments for genuine menu recommendations:

**Input Comment**: "Just had their truffle pasta - absolutely divine! The portion was huge and the sauce was perfectly creamy. Skip the dessert though, overpriced."

**AI Analysis**:

```json
{
  "recommendations": [
    {
      "item": "truffle pasta",
      "sentiment": "very_positive",
      "confidence": 0.95
    }
  ],
  "avoid": [
    {
      "item": "dessert",
      "reasoning": "explicitly mentioned as 'overpriced'",
      "confidence": 0.9
    }
  ]
}
```

### 🔍 **Smart Restaurant Name Generator**

Creates intelligent search variations for better discovery:

**Input**: "Junior's Restaurant & Bakery"

**AI Variations**:

- "Junior's Restaurant & Bakery" (Full official name)
- "Junior's Restaurant" (Without category)
- "Junior's NYC" (With location)
- "Junior's cheesecake" (With signature item)

### 🎯 **Optimal Search Query Generator**

Creates SEO-optimized search queries for different platforms:

**Basic Input**: "Italian food Manhattan"

**AI-Optimized Queries**:

- **Google**: "best Italian restaurants Manhattan NYC 2024 reviews"
- **Reddit**: "Italian restaurant recommendations Manhattan where to eat"
- **Reviews**: "top rated Italian food Manhattan authentic pasta"

---

## 🧠 Session Memory

### **Natural Follow-up Conversations**

**Before**: Users had to repeat full context

- ❌ "What should I order at Joe's Pizza?" (after already discussing Joe's)

**After**: Natural follow-up questions work seamlessly

- ✅ "What should I order there?" (automatically resolves to current restaurant)
- ✅ "Is it expensive?" (understands "it" refers to selected restaurant)
- ✅ "Compare the top 2" (automatically compares first 2 restaurants from results)

### **Context Types Detected**

| Context Type           | Description                              | Examples                                 |
| ---------------------- | ---------------------------------------- | ---------------------------------------- |
| `restaurant_reference` | References to specific restaurants       | "this place", "it", "there"              |
| `location_reference`   | Implied locations from previous searches | "pizza places" (after Brooklyn search)   |
| `comparison`           | Comparison requests using context        | "compare them", "the top 2"              |
| `follow_up`            | Follow-up questions about current topic  | "what should I order", "is it expensive" |

### **Example Conversation Flow**

```
User: "Best pizza in Brooklyn"
Bot: [Shows 5 pizza places including Joe's Pizza, Prince Street Pizza, Lucali...]

User: "What should I order at the first one?"
Bot: [Analyzes context] → "What should I order at Joe's Pizza?"
     [Shows menu recommendations for Joe's Pizza]

User: "Is it expensive?"
Bot: [Analyzes context] → "Is Joe's Pizza expensive?"
     [Shows pricing information for Joe's Pizza]
```

### **Technical Implementation**

- **No LangChain/LangGraph needed**: Uses existing Gemini API with smart prompting
- **Fast Analysis**: < 1 second context resolution
- **Robust Fallbacks**: LLM analysis with regex pattern fallbacks
- **Minimal Tokens**: ~100-200 tokens per context analysis

---

## 🛠️ Troubleshooting

### **Google Geocoding API Issues**

**Problem**: `REQUEST_DENIED - This API project is not authorized to use this API`

**Solution**:

1. Enable **Geocoding API** in Google Cloud Console
2. Go to "APIs & Services" → "Library" → Search "Geocoding API" → Enable
3. Check API key restrictions (set to "None" for testing)
4. Enable billing (required for most Google APIs)
5. Wait 5-10 minutes for changes to propagate

**Test Fix**:

```bash
node test-google-geocoding-simple.js
```

### **Common Issues**

| Issue                     | Solution                                 |
| ------------------------- | ---------------------------------------- |
| "Billing must be enabled" | Enable billing in Google Cloud Console   |
| "API key not valid"       | Generate a new API key                   |
| "Daily quota exceeded"    | Check quotas in APIs & Services → Quotas |
| Server won't start        | Check if ports 3000-3002 are available   |

### **Alternative: LLM-Only Mode**

If you prefer not to use Google APIs:

1. Remove `GOOGLE_API_KEY` from `.env.local`
2. App automatically uses LLM-based geocoding only
3. Works worldwide without API setup

---

## 📊 Implementation Plan

### **Technology Stack**

| Component            | Choice                | Reasoning                                 |
| -------------------- | --------------------- | ----------------------------------------- |
| **Frontend**         | Next.js 14 App Router | Server actions, streaming, optimization   |
| **AI Orchestration** | Gemini 2.5 Pro        | 1M token context, native function calling |
| **Restaurant Data**  | Google Places API     | Best coverage, $200 monthly credit        |
| **Web Search**       | Serper.dev            | Cost-effective, reliable                  |
| **Styling**          | Tailwind CSS          | Utility-first, responsive design          |

### **Development Phases**

1. **Foundation** (4 hours): Project setup, environment configuration
2. **Data Layer** (8 hours): API integrations, scoring algorithms
3. **AI Orchestration** (8 hours): Intent classification, function calling
4. **Frontend** (12 hours): Chat interface, responsive design
5. **Testing** (8 hours): Error handling, optimization
6. **Deployment** (8 hours): Vercel setup, documentation

### **API Usage & Costs**

**Daily Usage Scenario** (100 user queries):

- Google Places: $6/day
- Serper: $0.25/day
- Gemini: $35/day
- **Total**: ~$41/day

**Recommended Limits for MVP**:

- Max 50 queries/day during testing
- Cache API responses for 4 hours
- User rate limiting (5 queries/hour)

### **Performance Optimizations**

- **Parallel API Calls**: Multiple tools execute simultaneously
- **Smart Caching**: 4-hour cache for repeated queries
- **Token Management**: Context window optimization
- **Graceful Degradation**: Fallbacks for all failure modes

---

## 🎯 Success Metrics

### **Functional Capabilities**

- ✅ Handles worldwide restaurant searches
- ✅ Natural conversation flow with memory
- ✅ Multi-source data synthesis (Google + Reddit + Web)
- ✅ Intelligent intent classification
- ✅ Context-aware follow-up questions

### **Technical Achievements**

- ✅ Built with Next.js App Router
- ✅ No complex dependencies (LangChain-free)
- ✅ Deployed to Vercel
- ✅ Responsive mobile design
- ✅ Production-ready error handling

### **User Experience**

- ✅ Conversational greetings and guidance
- ✅ Progressive information gathering
- ✅ Smart context switching
- ✅ Helpful error recovery
- ✅ Global location support

---

## 🚀 Future Enhancements

- **Multi-turn Planning**: Complex multi-step requests
- **Preference Learning**: Remember user preferences across sessions
- **Time-based Suggestions**: Breakfast vs dinner recommendations
- **Dietary Restrictions**: Vegetarian, allergy-friendly options
- **Reservation Integration**: Direct booking capabilities

---

## 📝 License

This project is built for demonstration purposes. Please ensure proper API key management and respect rate limits in production use.

---

**🎉 Transform your dining decisions with AI-powered restaurant discovery!**
