# Curate

Curate is an AI-powered personalized news app that combines:

- Personalized feed ranking
- Live topic search
- AI summaries
- Reading analytics
- User preference onboarding

## Project Structure

- `backend/` - Express API, discovery, feed generation, analytics tracking
- `frontend/` - React + Vite app

## Prerequisites

- Node.js 18+
- MongoDB
- Redis

## Setup

1. Install dependencies:
```bash
cd backend && npm install
cd ../frontend && npm install
```

2. Configure backend env:
```bash
cp backend/.env.example backend/.env
```
Then update keys like `MONGODB_URI`, `REDIS_HOST`, `JWT_SECRET`, and `GEMINI_API_KEY`.

## Run Locally

Open 3 terminals:

1. Backend API
```bash
cd backend
npm run dev
```

2. Worker
```bash
cd backend
npm run worker:dev
```

3. Frontend
```bash
cd frontend
npm run dev
```

Frontend: `http://localhost:5173`  
Backend: `http://localhost:5001`

## LAN Testing (Phone)

Run frontend with host binding:
```bash
cd frontend
npm run dev -- --host
```
Then open the shown network URL (example: `http://192.168.x.x:5173`).

## Useful Scripts

Backend:
- `npm run dev` - start API with nodemon
- `npm run worker:dev` - start worker with nodemon
- `npm run seed` - seed data
- `npm run cleanup` - cleanup invalid URLs
- `npm run fix:google-news-urls` - repair Google News redirect URL records

Frontend:
- `npm run dev` - start Vite dev server
- `npm run build` - production build
- `npm run preview` - preview production build

## Notes

- Keep `backend/.env` out of git.
- Commit `backend/.env.example` and update it when env vars change.
