# Curate AI Agent Guide

## What This Project Is
Curate is an AI-powered personalized news application. It collects articles from external sources, ranks them for each user based on explicit interests and reading behavior, and presents them in an editorial-style feed. The product includes topic onboarding, personalized feed generation, live topic search, article detail views, AI-generated summaries, analytics, and preference management.

## What The Project Needs To Run

### System Requirements
- Node.js 18+ recommended
- npm
- MongoDB running locally or reachable remotely
- Redis running locally or reachable remotely
- A Gemini API key for AI summaries

### Environment Variables
Create `backend/.env` from `backend/.env.example`.

Minimum backend variables:
- `PORT=5001`
- `MONGODB_URI=mongodb://localhost:27017/curate_db`
- `REDIS_HOST=localhost`
- `REDIS_PORT=6379`
- `JWT_SECRET=...`
- `JWT_REFRESH_SECRET=...`
- `JWT_EXPIRES_IN=15m`
- `JWT_REFRESH_EXPIRES_IN=7d`
- `GEMINI_API_KEY=...`
- `GEMINI_MODEL=gemini-2.5-flash-lite`

Optional frontend variable:
- `VITE_API_URL=http://localhost:5001/api`

Notes:
- If `VITE_API_URL` is not set, the frontend derives the API host from the current browser hostname and uses port `5001`.
- The worker depends on Redis. If Redis is unavailable, the API and frontend can still run, but background jobs will fail.
- Gemini summary generation is quota-sensitive. If summaries fail with `429`, the issue is API quota, not app wiring.

## Install

### Backend
```bash
cd backend
npm install
```

### Frontend
```bash
cd frontend
npm install
```

## Run The Project

### 1. Start MongoDB
Use your local MongoDB service or a remote connection string in `MONGODB_URI`.

### 2. Start Redis
Use your local Redis service or update `REDIS_HOST` / `REDIS_PORT`.

### 3. Start the backend API
```bash
cd backend
npm run dev
```

Backend default URL:
- `http://localhost:5001`

### 4. Start the frontend
```bash
cd frontend
npm run dev
```

Frontend default URL:
- `http://localhost:5173`

### 5. Start the worker
```bash
cd backend
npm run worker:dev
```

The worker handles summarization and other background processing. It is recommended for full product behavior, but not required just to render the UI.

## Useful Commands

### Frontend
```bash
cd frontend
npm run build
```

### Backend scripts
```bash
cd backend
npm run seed
npm run cleanup
npm run summarize:all
npm run fix:google-news-urls
```

Notes:
- `summarize:all` attempts to summarize all pending articles and can be blocked by Gemini quota.
- `fix:google-news-urls` is useful because Google News wrapper URLs often hurt extraction quality.

## High-Level Project Structure
- `backend/`
  - Express API
  - authentication
  - feed generation and ranking
  - article discovery and extraction
  - summarization services
  - worker jobs and maintenance scripts
- `frontend/`
  - React + Vite app
  - feed UI
  - article modal
  - onboarding
  - preferences
  - analytics

## Main Product Flow
1. User signs up or logs in
2. User selects topics during onboarding
3. Backend generates a personalized feed
4. User reads, likes, bookmarks, and searches topics
5. Interactions improve ranking over time
6. AI summaries are generated for eligible articles when content extraction succeeds

## Known Operational Constraints
- Some Google News articles still extract poorly if the source URL cannot be resolved or scraped cleanly
- Redis is required for worker-driven background processing
- Gemini rate limits can block summarization
- Feed quality depends on both ranking logic and successful article ingestion/extraction

## What An AI Agent Should Check First
If the app is not working, check these in order:
1. `backend/.env` exists and has valid values
2. MongoDB is reachable
3. Redis is reachable
4. backend API is running on port `5001`
5. frontend is running on port `5173`
6. worker is running if summaries or background jobs are expected
7. Gemini key is valid and not quota-limited

## Current Goal Of The Project
Curate is being shaped into a premium editorial news experience with:
- strong personalized ranking
- reliable topic filtering
- better AI summaries
- cleaner article detail pages
- a structured editorial feed layout instead of a generic card grid
