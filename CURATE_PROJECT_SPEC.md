# Curate - AI-Powered Personalized News Aggregator
## Complete Project Specification for Claude Code

---

## 📋 Project Overview

**Name:** Curate  
**Tagline:** "News that matters to you"  
**Type:** Personalized news aggregation platform with AI summarization

### Core Concept
A web application that discovers news articles from multiple sources (RSS feeds, Google News RSS, Reddit), uses AI to generate concise summaries, ranks content based on user preferences, and delivers a personalized feed optimized for each user's interests.

---

## 🎯 Project Goals

1. **Build a production-grade feed engine** that can power any content delivery system
2. **Implement multi-source content discovery** (RSS, Google News, Reddit)
3. **Use AI for intelligent summarization** (Gemini API - FREE)
4. **Create personalized ranking algorithms** that learn from user behavior
5. **Deliver a beautiful, responsive frontend** with excellent UX
6. **Demonstrate system design expertise** for portfolio/interviews

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     FRONTEND (React)                    │
│  - Feed view with infinite scroll                      │
│  - Onboarding flow for preferences                     │
│  - Preference management UI                            │
└────────────────────┬────────────────────────────────────┘
                     │ REST API
┌────────────────────┴────────────────────────────────────┐
│              BACKEND (Node.js + Express)                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │   Feed       │  │   Content    │  │   User       │ │
│  │   Engine     │  │   Discovery  │  │   Service    │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────┴────────────────────────────────────┐
│                    DATA LAYER                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │   MongoDB    │  │    Redis     │  │  Background  │ │
│  │  (Primary)   │  │   (Cache)    │  │    Jobs      │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────┘
                     │
┌────────────────────┴────────────────────────────────────┐
│                EXTERNAL SERVICES                        │
│  - RSS Feeds (TechCrunch, Wired, etc.)                 │
│  - Google News RSS (search queries)                    │
│  - Reddit API (community curation)                     │
│  - Gemini API (AI summarization - FREE)                │
└─────────────────────────────────────────────────────────┘
```

---

## 📊 Database Schema (MongoDB)

### Collection 1: users
```javascript
{
  _id: ObjectId("..."),
  email: "user@example.com",
  username: "john_doe",
  passwordHash: "bcrypt_hash",
  avatar: "https://...",
  settings: {
    emailDigest: true,
    digestTime: "08:00",
    articlesPerPage: 20,
    theme: "light"
  },
  lastActiveAt: ISODate("2024-01-13T10:00:00Z"),
  createdAt: ISODate("2024-01-01T00:00:00Z"),
  updatedAt: ISODate("2024-01-13T10:00:00Z")
}

Indexes:
- email (unique)
- lastActiveAt
```

### Collection 2: user_preferences
```javascript
{
  _id: ObjectId("..."),
  userId: ObjectId("..."),
  preferenceType: "TOPIC", // TOPIC, SOURCE, KEYWORD
  preferenceValue: "artificial intelligence",
  weight: 0.85, // 0-1, learned over time
  source: "EXPLICIT", // EXPLICIT (user selected) or IMPLICIT (learned)
  clickCount: 15,
  dismissCount: 2,
  lastInteractionAt: ISODate("2024-01-13T08:00:00Z"),
  active: true,
  createdAt: ISODate("2024-01-01T00:00:00Z"),
  updatedAt: ISODate("2024-01-13T10:00:00Z")
}

Indexes:
- userId + active
- userId + weight DESC
```

### Collection 3: articles
```javascript
{
  _id: ObjectId("..."),
  url: "https://techcrunch.com/...", // unique
  title: "OpenAI Releases GPT-5",
  description: "Brief description...",
  imageUrl: "https://...",
  author: "Jane Smith",
  
  source: {
    name: "TechCrunch",
    type: "RSS", // RSS, GOOGLE_NEWS, REDDIT
    url: "https://techcrunch.com/feed/",
    quality: "TIER_1"
  },
  
  publishedAt: ISODate("2024-01-13T09:00:00Z"),
  discoveredAt: ISODate("2024-01-13T09:15:00Z"),
  
  summary: {
    text: "AI-generated 2-3 sentence summary",
    keyPoints: ["Point 1", "Point 2", "Point 3"],
    generatedAt: ISODate("2024-01-13T09:20:00Z")
  },
  
  content: {
    text: "Full article text (if scraped)",
    wordCount: 1200,
    readingTimeMinutes: 5
  },
  
  topics: [
    { name: "artificial intelligence", confidence: 0.95 },
    { name: "technology", confidence: 0.85 }
  ],
  
  engagement: {
    upvotes: 1523, // for Reddit
    comments: 234,
    score: 1523
  },
  
  summaryStatus: "COMPLETED", // PENDING, COMPLETED, FAILED
  
  createdAt: ISODate("2024-01-13T09:15:00Z"),
  updatedAt: ISODate("2024-01-13T09:20:00Z")
}

Indexes:
- url (unique)
- publishedAt DESC
- topics.name
- summaryStatus
```

### Collection 4: user_feed_cache
```javascript
{
  _id: ObjectId("..."),
  userId: ObjectId("..."),
  articleId: ObjectId("..."),
  
  relevance: {
    score: 0.87,
    matchedPreferences: [
      { preference: "artificial intelligence", weight: 0.9 }
    ],
    scoreBreakdown: {
      preferenceMatch: 0.85,
      recency: 0.90,
      sourceQuality: 0.88,
      engagement: 0.85
    }
  },
  
  position: 1,
  
  generatedAt: ISODate("2024-01-13T10:00:00Z"),
  expiresAt: ISODate("2024-01-13T11:00:00Z"), // 1 hour TTL
  
  createdAt: ISODate("2024-01-13T10:00:00Z")
}

Indexes:
- userId + relevance.score DESC
- expiresAt (TTL index)
```

### Collection 5: user_interactions
```javascript
{
  _id: ObjectId("..."),
  userId: ObjectId("..."),
  articleId: ObjectId("..."),
  action: "CLICK", // VIEW, CLICK, DISMISS, BOOKMARK, SHARE
  
  context: {
    feedPosition: 3,
    sourceType: "RSS",
    matchedPreferences: ["AI", "technology"],
    relevanceScore: 0.87
  },
  
  durationSeconds: 45,
  clickedThrough: true,
  
  timestamp: ISODate("2024-01-13T10:30:00Z"),
  createdAt: ISODate("2024-01-13T10:30:00Z")
}

Indexes:
- userId + timestamp DESC
- articleId
- userId + action
```

### Collection 6: content_sources
```javascript
{
  _id: ObjectId("..."),
  type: "RSS", // RSS, GOOGLE_NEWS, REDDIT
  name: "TechCrunch",
  identifier: "https://techcrunch.com/feed/",
  category: "technology",
  topics: ["tech news", "startups", "AI"],
  quality: "TIER_1",
  
  active: true,
  checkInterval: 30, // minutes
  lastCheckedAt: ISODate("2024-01-13T10:00:00Z"),
  lastSuccessAt: ISODate("2024-01-13T10:00:00Z"),
  
  stats: {
    totalArticles: 1523,
    articlesLast24h: 45,
    avgArticlesPerDay: 42,
    successRate: 0.98
  },
  
  lastError: null,
  consecutiveFailures: 0,
  
  createdAt: ISODate("2024-01-01T00:00:00Z"),
  updatedAt: ISODate("2024-01-13T10:00:00Z")
}

Indexes:
- type + active
- category
- lastCheckedAt
```

---

## 🔧 Tech Stack

### Backend
- **Runtime:** Node.js 18+
- **Framework:** Express.js
- **Database:** MongoDB (local installation)
- **Cache:** Redis (local installation)
- **Job Queue:** BullMQ
- **Authentication:** JWT (jsonwebtoken)
- **Password Hashing:** bcrypt
- **Validation:** Joi or Zod

### Content Discovery
- **RSS Parser:** rss-parser
- **Web Scraping:** axios + cheerio (for article content)
- **Reddit:** Direct API calls (no auth needed for reading)

### AI Summarization
- **Primary:** Google Gemini API (FREE tier - 1,500 requests/day)
- **Fallback:** None needed with Gemini's generous limits

### Frontend
- **Framework:** React 18
- **Build Tool:** Vite
- **Routing:** React Router v6
- **State Management:** React Context + useReducer
- **Styling:** Tailwind CSS
- **HTTP Client:** axios
- **Infinite Scroll:** react-intersection-observer

### Development Tools
- **API Testing:** Postman/Thunder Client
- **Code Quality:** ESLint + Prettier
- **Environment:** dotenv
- **Process Manager:** PM2 (production)

---

## 📁 Project Structure

```
curate/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── database.js          # MongoDB connection
│   │   │   ├── redis.js             # Redis connection
│   │   │   └── constants.js         # App constants
│   │   ├── models/
│   │   │   ├── User.js
│   │   │   ├── Article.js
│   │   │   ├── UserPreference.js
│   │   │   ├── UserInteraction.js
│   │   │   └── ContentSource.js
│   │   ├── services/
│   │   │   ├── auth/
│   │   │   │   ├── AuthService.js
│   │   │   │   └── JWTService.js
│   │   │   ├── feed/
│   │   │   │   ├── FeedGenerator.js
│   │   │   │   ├── RankingEngine.js
│   │   │   │   └── FeedCache.js
│   │   │   ├── discovery/
│   │   │   │   ├── RSSFetcher.js
│   │   │   │   ├── GoogleNewsFetcher.js
│   │   │   │   ├── RedditFetcher.js
│   │   │   │   └── ContentRouter.js
│   │   │   ├── ai/
│   │   │   │   └── SummarizationService.js (Gemini)
│   │   │   ├── learning/
│   │   │   │   └── PreferenceLearner.js
│   │   │   └── content/
│   │   │       └── ArticleExtractor.js
│   │   ├── controllers/
│   │   │   ├── authController.js
│   │   │   ├── feedController.js
│   │   │   ├── preferencesController.js
│   │   │   └── interactionsController.js
│   │   ├── routes/
│   │   │   ├── auth.routes.js
│   │   │   ├── feed.routes.js
│   │   │   ├── preferences.routes.js
│   │   │   └── interactions.routes.js
│   │   ├── middleware/
│   │   │   ├── authenticate.js
│   │   │   ├── validateRequest.js
│   │   │   └── errorHandler.js
│   │   ├── jobs/
│   │   │   ├── articleDiscovery.job.js
│   │   │   ├── summarization.job.js
│   │   │   ├── feedGeneration.job.js
│   │   │   └── preferenceLearning.job.js
│   │   ├── utils/
│   │   │   ├── logger.js
│   │   │   ├── validators.js
│   │   │   └── helpers.js
│   │   └── app.js                   # Express app setup
│   ├── .env.example
│   ├── package.json
│   └── server.js                    # Entry point
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── common/
│   │   │   │   ├── Header.jsx
│   │   │   │   ├── Sidebar.jsx
│   │   │   │   ├── LoadingSkeleton.jsx
│   │   │   │   └── ErrorBoundary.jsx
│   │   │   ├── feed/
│   │   │   │   ├── FeedContainer.jsx
│   │   │   │   ├── ArticleCard.jsx
│   │   │   │   └── InfiniteScroll.jsx
│   │   │   ├── onboarding/
│   │   │   │   ├── Welcome.jsx
│   │   │   │   ├── TopicSelection.jsx
│   │   │   │   └── Confirmation.jsx
│   │   │   ├── preferences/
│   │   │   │   ├── PreferencesPage.jsx
│   │   │   │   ├── TopicList.jsx
│   │   │   │   └── SourceList.jsx
│   │   │   └── auth/
│   │   │       ├── Login.jsx
│   │   │       └── Signup.jsx
│   │   ├── contexts/
│   │   │   ├── UserContext.jsx
│   │   │   ├── FeedContext.jsx
│   │   │   └── PreferencesContext.jsx
│   │   ├── services/
│   │   │   ├── api.js              # Axios instance
│   │   │   ├── authService.js
│   │   │   ├── feedService.js
│   │   │   └── preferencesService.js
│   │   ├── hooks/
│   │   │   ├── useAuth.js
│   │   │   ├── useFeed.js
│   │   │   └── useInfiniteScroll.js
│   │   ├── pages/
│   │   │   ├── HomePage.jsx
│   │   │   ├── OnboardingPage.jsx
│   │   │   ├── PreferencesPage.jsx
│   │   │   └── LoginPage.jsx
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── .env.example
│   ├── package.json
│   ├── vite.config.js
│   └── tailwind.config.js
│
├── docs/
│   ├── API.md                       # API documentation
│   ├── ARCHITECTURE.md              # System architecture
│   └── DEPLOYMENT.md                # Deployment guide
│
└── README.md
```

---

## 🔑 Core Features Implementation

### Phase 1: Feed Engine Foundation (Week 1)

#### 1.1 MongoDB Setup & Models
```javascript
// Required setup
- Install MongoDB locally
- Create database: curate_db
- Define Mongoose models for all collections
- Set up indexes
- Create seed data for testing
```

#### 1.2 Redis Setup & Caching
```javascript
// Feed caching strategy
- Install Redis locally
- Set up connection pooling
- Implement FeedCache service
- Key patterns: feed:{userId}, article_summary:{articleId}
- TTL management
```

#### 1.3 Authentication System
```javascript
// JWT-based auth
- User registration (POST /auth/signup)
- User login (POST /auth/login)
- Token generation & validation
- Password hashing with bcrypt
- Auth middleware for protected routes
```

#### 1.4 User Preferences Management
```javascript
// CRUD for preferences
- Create preference (POST /preferences)
- Get user preferences (GET /preferences)
- Update preference weight (PUT /preferences/:id)
- Delete preference (DELETE /preferences/:id)
- Validate preference types (TOPIC, SOURCE, KEYWORD)
```

### Phase 2: Content Discovery (Week 2)

#### 2.1 RSS Feed Integration
```javascript
// RSSFetcher service
- Define feed registry (20+ feeds across categories)
- Parse RSS feeds with rss-parser
- Extract: title, link, pubDate, description
- Store articles in MongoDB
- Deduplicate by URL
- Run every 30 minutes (background job)

// Example feeds:
Technology: TechCrunch, The Verge, Ars Technica, Wired
AI: OpenAI Blog, Google AI Blog, MIT Tech Review
Science: Scientific American, Phys.org, Nature
Business: Bloomberg, WSJ RSS, Financial Times
```

#### 2.2 Google News RSS Integration
```javascript
// GoogleNewsFetcher service
- Build Google News RSS URLs from search queries
- Pattern: https://news.google.com/rss/search?q={query}&hl=en&gl=US&ceid=US:en
- Parse RSS response
- Handle special characters in queries
- Support time filters (last 24h, 7d)
```

#### 2.3 Reddit Integration
```javascript
// RedditFetcher service
- Fetch without authentication: https://www.reddit.com/r/{subreddit}/top.json?t=day&limit=25
- Parse JSON response
- Filter for external links only (no text posts)
- Extract: title, url, score (upvotes), comments, created_utc
- Map topics to relevant subreddits

// Example subreddit mapping:
technology: ['technology', 'gadgets', 'tech']
ai: ['MachineLearning', 'artificial', 'singularity']
science: ['science', 'Physics', 'biology']
space: ['space', 'SpaceX', 'nasa']
```

#### 2.4 Intelligent Content Router
```javascript
// ContentRouter service
- Analyze user preference type (category, specific topic, person/company)
- Route to appropriate sources:
  * Broad category → RSS primary, Reddit secondary
  * Specific topic → Google News primary, RSS/Reddit secondary
  * Person/company → Google News only
- Fetch from multiple sources in parallel
- Merge and deduplicate results
- Return unified article list
```

#### 2.5 Background Discovery Job
```javascript
// Article discovery worker (runs every 30 min)
1. Get all active users (logged in within 7 days)
2. Get unique preferences across all users
3. For each preference:
   - Discover articles (RSS + Google + Reddit)
   - Insert new articles (check URL uniqueness)
4. Queue articles for summarization
5. Log metrics (articles discovered, sources checked, errors)
```

### Phase 3: AI Summarization (Week 2)

#### 3.1 Gemini API Integration
```javascript
// SummarizationService using Gemini API

// Setup:
1. Sign up at https://makersuite.google.com/app/apikey
2. Get free API key (1,500 requests/day)
3. Install @google/generative-ai package

// Implementation:
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

async function summarizeArticle(articleText) {
  const prompt = `Summarize this news article in exactly 2-3 concise sentences. 
Focus on the key facts and main takeaway. 
Also provide 3 key bullet points.

Article:
${articleText}

Format your response as:
SUMMARY: [2-3 sentences]
KEY POINTS:
- [Point 1]
- [Point 2]
- [Point 3]`;

  const result = await model.generateContent(prompt);
  const response = result.response.text();
  
  // Parse response into summary and key points
  return parseGeminiResponse(response);
}

// Features:
- Truncate articles to 4000 words (model limit)
- Parse Gemini response into structured data
- Cache summaries (don't regenerate)
- Handle API errors gracefully
- Fallback: use article description if summarization fails
```

#### 3.2 Article Content Extraction
```javascript
// ArticleExtractor service
- Fetch full article HTML with axios
- Extract main content (remove ads, nav, footer)
- Use cheerio for parsing
- Libraries to consider: mozilla/readability, @extractus/article-extractor
- Handle paywalls gracefully (mark as premium)
- Return: clean text, images, author, publish date
```

#### 3.3 Background Summarization Job
```javascript
// Summarization worker
1. Find articles with summaryStatus = 'PENDING'
2. Batch process (10 articles at a time)
3. For each article:
   - Extract content if needed
   - Call Gemini API
   - Store summary in article document
   - Update summaryStatus to 'COMPLETED'
4. Handle failures (retry 3 times, then mark as 'FAILED')
5. Respect API rate limits (1,500/day = ~1/minute)
```

### Phase 4: Ranking & Feed Generation (Week 3)

#### 4.1 Ranking Engine
```javascript
// RankingEngine service

function calculateRelevanceScore(article, user, userPreferences) {
  const score = {
    preferenceMatch: 0,
    recency: 0,
    sourceQuality: 0,
    engagement: 0,
    final: 0
  };
  
  // 1. Preference Match (0-1)
  score.preferenceMatch = calculatePreferenceMatch(
    article.topics,
    userPreferences
  );
  // Match article topics to user preferences
  // Weight by preference importance
  
  // 2. Recency (0-1)
  const hoursOld = (Date.now() - article.publishedAt) / (1000 * 60 * 60);
  if (hoursOld < 6) score.recency = 1.0;
  else if (hoursOld < 24) score.recency = 0.7;
  else if (hoursOld < 72) score.recency = 0.4;
  else score.recency = 0.1;
  
  // 3. Source Quality (0-1)
  switch(article.source.quality) {
    case 'TIER_1': score.sourceQuality = 1.0; break;
    case 'TIER_2': score.sourceQuality = 0.8; break;
    case 'TIER_3': score.sourceQuality = 0.6; break;
  }
  
  // 4. Engagement (0-1, for Reddit)
  if (article.source.type === 'REDDIT') {
    score.engagement = Math.min(article.engagement.upvotes / 1000, 1.0);
  }
  
  // Final weighted score
  score.final = (
    score.preferenceMatch * 0.4 +
    score.recency * 0.3 +
    score.sourceQuality * 0.2 +
    score.engagement * 0.1
  );
  
  return score;
}

// Helper: Match articles to preferences
function calculatePreferenceMatch(articleTopics, userPreferences) {
  let totalMatch = 0;
  let totalWeight = 0;
  
  for (const pref of userPreferences) {
    const match = articleTopics.find(
      t => t.name.toLowerCase().includes(pref.preferenceValue.toLowerCase())
    );
    
    if (match) {
      totalMatch += match.confidence * pref.weight;
      totalWeight += pref.weight;
    }
  }
  
  return totalWeight > 0 ? totalMatch / totalWeight : 0;
}
```

#### 4.2 Feed Generator
```javascript
// FeedGenerator service

async function generateFeedForUser(userId) {
  // 1. Get user preferences
  const preferences = await UserPreference.find({ 
    userId, 
    active: true 
  }).sort({ weight: -1 });
  
  // 2. Get recent articles (last 3 days)
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const articles = await Article.find({
    publishedAt: { $gte: threeDaysAgo },
    summaryStatus: 'COMPLETED'
  });
  
  // 3. Score each article
  const scoredArticles = articles.map(article => ({
    article,
    relevance: calculateRelevanceScore(article, userId, preferences)
  }));
  
  // 4. Sort by score
  scoredArticles.sort((a, b) => b.relevance.final - a.relevance.final);
  
  // 5. Take top 100
  const topArticles = scoredArticles.slice(0, 100);
  
  // 6. Cache in MongoDB (and optionally Redis)
  await UserFeedCache.deleteMany({ userId }); // Clear old cache
  await UserFeedCache.insertMany(
    topArticles.map((item, index) => ({
      userId,
      articleId: item.article._id,
      relevance: item.relevance,
      position: index + 1,
      generatedAt: new Date(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000) // 1 hour
    }))
  );
  
  return topArticles;
}
```

#### 4.3 Feed Generation Job
```javascript
// Background job (runs every 30 minutes)
1. Get all active users
2. For each user:
   - Check if feed cache exists and is fresh (<30 min old)
   - If stale or missing, regenerate feed
   - Store in cache
3. Log metrics (feeds generated, time taken)
```

### Phase 5: User Interactions & Learning (Week 3)

#### 5.1 Interaction Tracking
```javascript
// Track user actions

// POST /interactions/view
- Record when user views article
- Track duration (sent when leaving page)

// POST /interactions/click
- Record when user clicks article
- Track click-through to external site

// POST /interactions/dismiss
- Record when user dismisses article
- Negative signal for learning

// POST /interactions/bookmark
- Record when user saves article
- Strong positive signal
```

#### 5.2 Preference Learning Algorithm
```javascript
// PreferenceLearner service (runs daily)

async function learnFromInteractions(userId) {
  // 1. Get interactions from last 30 days
  const interactions = await UserInteraction.find({
    userId,
    timestamp: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
  });
  
  // 2. Analyze clicks
  const clickedArticles = interactions.filter(i => i.action === 'CLICK');
  const topicCounts = {};
  
  for (const interaction of clickedArticles) {
    const article = await Article.findById(interaction.articleId);
    for (const topic of article.topics) {
      topicCounts[topic.name] = (topicCounts[topic.name] || 0) + 1;
    }
  }
  
  // 3. Create implicit preferences for frequently clicked topics
  for (const [topic, count] of Object.entries(topicCounts)) {
    if (count >= 5) {
      // User clicked 5+ articles about this topic
      await UserPreference.findOneAndUpdate(
        { userId, preferenceValue: topic },
        {
          $set: { weight: Math.min(count / 10, 1.0), source: 'IMPLICIT' },
          $setOnInsert: { 
            preferenceType: 'TOPIC',
            active: true,
            createdAt: new Date()
          }
        },
        { upsert: true }
      );
    }
  }
  
  // 4. Adjust weights based on engagement
  const allPreferences = await UserPreference.find({ userId, active: true });
  
  for (const pref of allPreferences) {
    const clicks = interactions.filter(i => 
      i.action === 'CLICK' && 
      i.context.matchedPreferences.includes(pref.preferenceValue)
    ).length;
    
    const dismisses = interactions.filter(i =>
      i.action === 'DISMISS' &&
      i.context.matchedPreferences.includes(pref.preferenceValue)
    ).length;
    
    // Increase weight for clicked topics, decrease for dismissed
    let newWeight = pref.weight;
    newWeight += clicks * 0.05;
    newWeight -= dismisses * 0.03;
    newWeight = Math.max(0.1, Math.min(1.0, newWeight)); // Clamp 0.1-1.0
    
    await UserPreference.updateOne(
      { _id: pref._id },
      { $set: { weight: newWeight, clickCount: clicks, dismissCount: dismisses } }
    );
  }
  
  // 5. Deactivate stale preferences (no clicks in 60 days)
  await UserPreference.updateMany(
    {
      userId,
      lastInteractionAt: { $lt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) },
      source: 'IMPLICIT'
    },
    { $set: { active: false } }
  );
}
```

### Phase 6: API Endpoints (Week 3)

#### Authentication Routes
```javascript
POST   /api/auth/signup
POST   /api/auth/login
GET    /api/auth/me          // Get current user
POST   /api/auth/logout
```

#### Feed Routes
```javascript
GET    /api/feed             // Get personalized feed
  Query params:
    - limit (default: 20, max: 50)
    - cursor (for pagination)
  Response:
    {
      items: [{ article, relevance, ... }],
      nextCursor: "base64_encoded_cursor",
      hasMore: true
    }

GET    /api/feed/refresh     // Force feed regeneration
```

#### Preferences Routes
```javascript
GET    /api/preferences                    // Get user's preferences
POST   /api/preferences                    // Add new preference
  Body: { preferenceType, preferenceValue }

PUT    /api/preferences/:id                // Update preference
  Body: { weight, active }

DELETE /api/preferences/:id                // Remove preference
```

#### Interactions Routes
```javascript
POST   /api/interactions/view
  Body: { articleId, durationSeconds }

POST   /api/interactions/click
  Body: { articleId }

POST   /api/interactions/dismiss
  Body: { articleId }

POST   /api/interactions/bookmark
  Body: { articleId }
```

#### Articles Routes (optional)
```javascript
GET    /api/articles/:id     // Get single article details
GET    /api/articles/search  // Search articles
```

### Phase 7: Frontend Implementation (Week 4)

#### 7.1 Core Pages

**Login/Signup Page**
```jsx
// Features:
- Email/password form
- Form validation
- Error handling
- JWT storage in localStorage
- Redirect to onboarding (new users) or feed (existing users)
```

**Onboarding Flow**
```jsx
// Step 1: Welcome
- Brief explanation of app
- "Get Started" button

// Step 2: Topic Selection
- Grid of topic cards (Technology, AI, Science, etc.)
- Multi-select (min 3, max 10)
- Visual feedback on selection
- Progress indicator

// Step 3: Confirmation
- Review selections
- Loading animation ("Building your feed...")
- Auto-redirect to feed after 2 seconds
```

**Feed Page (Main)**
```jsx
// Layout:
- Header with logo, search (future), profile menu
- Sidebar with:
  * Topic filters (checkboxes)
  * Source filters
  * "Add preference" button
- Main feed area:
  * Article cards with infinite scroll
  * Loading skeletons
  * Empty states
  * Error states

// Article Card:
- Thumbnail image (if available)
- Source badge with logo
- Article title (clickable)
- AI-generated summary (2-3 sentences)
- Metadata: source name, time ago (e.g. "2 hours ago")
- Tags/topics
- Action buttons:
  * External link icon (opens article in new tab)
  * Bookmark icon
  * Dismiss X button
- Hover effects, smooth animations

// Infinite Scroll:
- Load 20 articles initially
- Load more when user scrolls to bottom (Intersection Observer)
- Show loading spinner
- Cursor-based pagination
```

**Preferences Page**
```jsx
// Sections:
1. Active Topics
   - List of current topics with weights (visual bars)
   - Remove button for each
   - Toggle active/inactive

2. Add New Topic
   - Search input with suggestions
   - Add button

3. Source Preferences
   - List of followed sources
   - Add/remove sources

4. Statistics (optional)
   - Articles read this week
   - Top topics
   - Most engaged sources
```

#### 7.2 State Management

```jsx
// UserContext
- Current user data
- Authentication state
- Login/logout functions

// FeedContext
- Feed articles array
- Loading state
- Pagination cursor
- hasMore flag
- fetchFeed() function
- loadMore() function

// PreferencesContext
- User preferences array
- addPreference() function
- removePreference() function
- updatePreference() function
```

#### 7.3 Key Components

```jsx
// ArticleCard.jsx
<ArticleCard
  article={article}
  onDismiss={handleDismiss}
  onBookmark={handleBookmark}
  onClick={handleClick}
/>

// Features:
- Responsive design (mobile/tablet/desktop)
- Smooth animations on hover
- Loading state when action in progress
- Error handling

// InfiniteScroll.jsx
- Uses Intersection Observer
- Triggers loadMore() when scrolling to bottom
- Shows loading spinner
- Handles end of feed

// LoadingSkeleton.jsx
- Placeholder for loading state
- Matches ArticleCard dimensions
- Animated shimmer effect

// ErrorBoundary.jsx
- Catches React errors
- Shows friendly error message
- Reload button
```

#### 7.4 API Integration

```javascript
// services/api.js
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.VITE_API_URL || 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor (add auth token)
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor (handle errors)
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      // Unauthorized - redirect to login
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
```

```javascript
// services/feedService.js
import api from './api';

export const feedService = {
  async getFeed(cursor = null, limit = 20) {
    const params = { limit };
    if (cursor) params.cursor = cursor;
    
    const response = await api.get('/feed', { params });
    return response.data;
  },
  
  async refreshFeed() {
    const response = await api.get('/feed/refresh');
    return response.data;
  }
};
```

### Phase 8: Background Jobs (Week 3-4)

#### Job Queue Setup with BullMQ

```javascript
// jobs/queue.js
import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';

const connection = new Redis({
  host: 'localhost',
  port: 6379
});

// Define queues
export const articleDiscoveryQueue = new Queue('article-discovery', { connection });
export const summarizationQueue = new Queue('summarization', { connection });
export const feedGenerationQueue = new Queue('feed-generation', { connection });
export const preferenceLearningQueue = new Queue('preference-learning', { connection });
```

#### Job Definitions

```javascript
// jobs/articleDiscovery.job.js
// Runs every 30 minutes
// Discovers new articles from RSS, Google News, Reddit

// jobs/summarization.job.js
// Processes articles needing summarization
// Calls Gemini API

// jobs/feedGeneration.job.js
// Regenerates feeds for active users
// Runs every 30 minutes

// jobs/preferenceLearning.job.js
// Analyzes user interactions
// Updates preference weights
// Runs daily at 2 AM
```

---

## 🚀 Implementation Timeline

### Week 1: Backend Foundation
- **Day 1-2:** Project setup, MongoDB/Redis, models, auth
- **Day 3-4:** User preferences CRUD, basic API structure
- **Day 5-7:** Testing, error handling, middleware

### Week 2: Content Discovery & AI
- **Day 1-2:** RSS + Google News + Reddit integration
- **Day 3-4:** Gemini API summarization, content extraction
- **Day 5-7:** Background jobs, testing discovery pipeline

### Week 3: Ranking & Learning
- **Day 1-2:** Ranking engine, feed generation
- **Day 3-4:** Interaction tracking, preference learning
- **Day 5-7:** API endpoints, testing, optimization

### Week 4: Frontend
- **Day 1-2:** React setup, auth pages, onboarding
- **Day 3-4:** Feed page, article cards, infinite scroll
- **Day 5-7:** Preferences page, polish, responsive design

### Week 5: Polish & Deploy (Optional)
- **Day 1-2:** Testing, bug fixes, optimization
- **Day 3-4:** Documentation, deployment
- **Day 5-7:** Final touches, demo preparation

---

## 🔐 Environment Variables

### Backend (.env)
```bash
# Server
NODE_ENV=development
PORT=5000

# MongoDB
MONGODB_URI=mongodb://localhost:27017/curate_db

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=your_super_secret_key_change_this
JWT_EXPIRES_IN=7d

# Gemini API (FREE)
GEMINI_API_KEY=your_gemini_api_key_from_makersuite

# CORS
FRONTEND_URL=http://localhost:5173

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### Frontend (.env)
```bash
VITE_API_URL=http://localhost:5000/api
```

---

## 📝 API Documentation Example

### GET /api/feed

**Description:** Get personalized feed for authenticated user

**Auth Required:** Yes (JWT token)

**Query Parameters:**
- `limit` (number, optional): Items per page (default: 20, max: 50)
- `cursor` (string, optional): Pagination cursor from previous response

**Response:**
```json
{
  "items": [
    {
      "article": {
        "_id": "507f1f77bcf86cd799439011",
        "title": "OpenAI Releases GPT-5",
        "summary": {
          "text": "OpenAI has announced GPT-5...",
          "keyPoints": ["Point 1", "Point 2", "Point 3"]
        },
        "url": "https://techcrunch.com/...",
        "imageUrl": "https://...",
        "source": {
          "name": "TechCrunch",
          "type": "RSS"
        },
        "publishedAt": "2024-01-13T09:00:00.000Z",
        "topics": [
          { "name": "artificial intelligence", "confidence": 0.95 }
        ]
      },
      "relevance": {
        "score": 0.87,
        "scoreBreakdown": {
          "preferenceMatch": 0.85,
          "recency": 0.90,
          "sourceQuality": 0.88
        }
      },
      "position": 1
    }
  ],
  "nextCursor": "eyJzY29yZSI6MC44NywiYXJ0aWNsZUlkIjoiNTA3ZjFmNzdiY2Y4NmNkNzk5NDM5MDExIn0=",
  "hasMore": true
}
```

---

## 🎨 Design Guidelines

### Color Palette
```css
/* Primary */
--primary: #2563eb;      /* Blue */
--primary-dark: #1e40af;
--primary-light: #3b82f6;

/* Neutral */
--background: #ffffff;
--surface: #f9fafb;
--border: #e5e7eb;
--text-primary: #111827;
--text-secondary: #6b7280;

/* Accent */
--accent: #10b981;       /* Green for positive actions */
--warning: #f59e0b;
--error: #ef4444;
```

### Typography
```css
/* Fonts */
font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;

/* Sizes */
--text-xs: 0.75rem;
--text-sm: 0.875rem;
--text-base: 1rem;
--text-lg: 1.125rem;
--text-xl: 1.25rem;
--text-2xl: 1.5rem;
--text-3xl: 1.875rem;
```

### Spacing
```css
/* Consistent spacing scale */
--space-1: 0.25rem;
--space-2: 0.5rem;
--space-3: 0.75rem;
--space-4: 1rem;
--space-6: 1.5rem;
--space-8: 2rem;
--space-12: 3rem;
```

---

## 🧪 Testing Strategy

### Unit Tests
- Services (RSSFetcher, RankingEngine, etc.)
- Utility functions
- Model validators

### Integration Tests
- API endpoints
- Database operations
- Background jobs

### End-to-End Tests
- User flows (signup → onboarding → feed)
- Feed generation pipeline
- Preference learning

### Testing Tools
- **Backend:** Jest, Supertest
- **Frontend:** Vitest, React Testing Library
- **E2E:** Playwright (optional)

---

## 📦 Deployment

### Option 1: Simple Deployment (Railway)
```bash
# Backend + MongoDB + Redis on Railway
- Deploy backend as Node.js app
- Add MongoDB plugin
- Add Redis plugin
- Set environment variables
- Cost: $5-10/month
```

### Option 2: Separate Services
```bash
# Backend: Railway/Render ($5/month)
# MongoDB: MongoDB Atlas (free tier 512MB)
# Redis: Redis Cloud (free tier 30MB)
# Frontend: Vercel (free)
# Total cost: $5/month
```

### Option 3: VPS (DigitalOcean)
```bash
# Single droplet ($12/month)
- Install MongoDB, Redis, Node.js, Nginx
- PM2 for process management
- Nginx for reverse proxy
- Deploy frontend as static files
- Most control, best for learning
```

---

## 🎤 Interview Talking Points

When presenting this project:

1. **System Design:**
   > "I built a scalable feed engine that uses both push and pull strategies for content distribution. The system ranks content using a weighted algorithm considering recency, user preferences, source quality, and engagement metrics."

2. **Content Discovery:**
   > "I implemented a hybrid content discovery system that intelligently routes queries across RSS feeds, Google News RSS, and Reddit based on the query type. For broad categories, I prioritize RSS for authority. For specific topics, Google News provides comprehensive coverage. Reddit surfaces trending content before mainstream media."

3. **AI Integration:**
   > "I use Google's Gemini API for article summarization, which provides GPT-4 class quality with a generous free tier of 1,500 requests per day. The system batches summarization jobs and caches results to optimize API usage."

4. **Personalization:**
   > "The app learns from user behavior through implicit signals. I track clicks, dismissals, and time spent to adjust preference weights. If a user clicks 5+ articles about quantum computing, the system automatically creates that as a preference. Dismissed topics get downweighted."

5. **Performance:**
   > "I implemented multi-level caching with Redis for hot data and MongoDB for persistence. Feed generation is pre-computed in background jobs, so user requests are served from cache in under 100ms. I use cursor-based pagination to avoid offset performance issues at scale."

6. **Scalability:**
   > "The architecture separates concerns into services that can scale independently. Content discovery runs on a schedule, summarization is queue-based, and feed generation is parallelizable. The system currently handles 1000 articles/day but could scale to 100k+ with horizontal scaling."

---

## 📚 Learning Resources

### MongoDB
- Official docs: https://docs.mongodb.com/
- Mongoose ODM: https://mongoosejs.com/

### Redis
- Official docs: https://redis.io/docs/
- Node Redis: https://github.com/redis/node-redis

### Gemini API
- Get API key: https://makersuite.google.com/app/apikey
- Documentation: https://ai.google.dev/docs

### React & Vite
- React docs: https://react.dev/
- Vite docs: https://vitejs.dev/

### Tailwind CSS
- Documentation: https://tailwindcss.com/docs

---

## 🎯 Success Criteria

### Minimum Viable Product (MVP)
- ✅ User can sign up and log in
- ✅ User can select 5+ topic preferences
- ✅ System discovers 50+ articles per day
- ✅ AI generates summaries for all articles
- ✅ Feed shows personalized, ranked articles
- ✅ User can click through to read articles
- ✅ Infinite scroll works smoothly
- ✅ Mobile responsive design

### Stretch Goals (Impressive!)
- ✅ Implicit preference learning from clicks
- ✅ Multiple source types (RSS, Google News, Reddit)
- ✅ Background jobs with queue system
- ✅ Real-time feed updates (polling)
- ✅ Bookmark functionality
- ✅ Performance optimization (caching, pagination)
- ✅ Error handling and loading states
- ✅ Deployed to production

---

## 🚦 Getting Started

### Prerequisites
```bash
# Install Node.js (v18+)
https://nodejs.org/

# Install MongoDB
https://www.mongodb.com/docs/manual/installation/

# Install Redis
https://redis.io/docs/getting-started/installation/

# Get Gemini API key (FREE)
https://makersuite.google.com/app/apikey
```

### Quick Start
```bash
# 1. Create project directory
mkdir curate
cd curate

# 2. Initialize backend
mkdir backend
cd backend
npm init -y
npm install express mongoose redis ioredis bullmq jsonwebtoken bcrypt dotenv cors express-validator rss-parser axios cheerio @google/generative-ai

# 3. Initialize frontend
cd ..
npm create vite@latest frontend -- --template react
cd frontend
npm install axios react-router-dom tailwindcss postcss autoprefixer react-intersection-observer

# 4. Set up MongoDB
# Start MongoDB service
mongosh
use curate_db

# 5. Set up Redis
# Start Redis service
redis-cli ping

# 6. Create .env files (see Environment Variables section)

# 7. Start development
# Terminal 1: Backend
cd backend && npm run dev

# Terminal 2: Frontend
cd frontend && npm run dev

# 8. Open browser
http://localhost:5173
```

---

## 📖 Documentation Structure

Create these additional docs:

1. **API.md** - Complete API reference with examples
2. **ARCHITECTURE.md** - System design diagrams and explanations
3. **DEPLOYMENT.md** - Step-by-step deployment guide
4. **CONTRIBUTING.md** - Guidelines for adding features (if open source)

---

## 🎉 Final Notes

This is a **production-grade project** that demonstrates:
- Full-stack development
- System design
- AI integration
- Performance optimization
- User experience design
- Scalable architecture

**Perfect for:**
- Portfolio centerpiece
- Technical interviews
- Learning modern web development
- Understanding feed systems at scale

**Estimated total time:** 4-6 weeks (full-time equivalent)

Good luck building **Curate**! 🚀

---

*Generated for Claude Code - Systematic implementation guide*
*Project: Curate - Personalized News Aggregator*
*Date: January 2025*
