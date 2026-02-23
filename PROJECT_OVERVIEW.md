# Curate Project Overview

## What This Project Does
Curate is an AI-powered personalized news app. It helps users discover and read relevant articles faster by combining:

- Personalized feed ranking
- Live topic search (fetches fresh articles on demand)
- AI-generated summaries
- Reading analytics (read time, completion, engagement)
- Preference management (onboarding + editable interests)

## Core User Experience
- Users sign up / log in.
- Users choose topics during onboarding.
- Curate shows a ranked feed based on preferences and behavior.
- Users can search any topic (for example: `GTA 6`, `formula one`, `new iPhone releases`) and get live results.
- Users open article details in a modal, react/bookmark, and read summaries.
- Curate tracks interactions to improve future recommendations.

## Main Features
- Personalized home feed
- Topic filter pills + global “All” feed
- Live search mode with “Back to Personalized Feed”
- Article detail modal with summary + actions
- Preferences page for updating interests
- Analytics dashboard for reading behavior insights

## Technical Structure
- `backend/`: API, feed generation, discovery jobs, analytics tracking, preferences
- `frontend/`: React UI (feed, search, onboarding, preferences, analytics)
- Worker/jobs: background discovery, summarization, and feed-related processing

## Why It Exists
Curate is built to reduce information overload: less scrolling, faster understanding, and a feed that becomes more relevant over time.
