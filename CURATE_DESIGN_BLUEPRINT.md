# Curate Design Blueprint

## Design Direction
Curate should feel like a focused research cockpit, not an endless social feed. The UI should optimize for fast signal extraction: users scan, decide, and deepen only when needed.

## Product Principles
1. Relevance first: personalized picks should dominate the first viewport.
2. Time-aware reading: show effort estimates (read time and summary length) before click.
3. Frictionless context-switching: personalized feed and live search should feel like two modes of the same surface.
4. Explainability over magic: expose why an article was recommended.

## Information Architecture
1. Home (default)
2. Search Mode
3. Article Detail Modal
4. Preferences
5. Analytics

## Home Screen Layout
1. Top bar
- Brand + mode label ("Personalized")
- Global search input
- Profile/settings menu

2. Secondary rail
- Topic pills: All + user interests
- Feed mode toggle: Ranked / Latest

3. Main content
- Stacked article cards with clear hierarchy:
  - Headline
  - 1-line summary snippet
  - Metadata row: source, time, read time
  - "Why this" tag (e.g., "Because you read AI + startups")
  - Actions: Save, Like, Dismiss

4. Right rail (desktop)
- Daily reading target progress
- Trending in your interests
- Quick filter chips

## Search Mode UX
1. Entering search morphs Home into "Search Mode" state.
2. Sticky banner: query + result count + "Back to Personalized Feed".
3. Result grouping:
- Top relevance
- Most recent
- Explainers/long reads
4. Empty state suggests adjacent queries and tracked topics.

## Article Detail Modal
1. Header
- Title, source, publish time, estimated read time
2. AI summary block
- 3 bullet key points
- "One sentence TL;DR"
3. Why recommended
- Explicit reason(s) tied to user interests/behavior
4. Actions
- Open original, Save, Mark helpful, Not relevant
5. Side panel (desktop)
- Related articles from same topic cluster

## Preferences Screen
1. Interest management
- Add/remove topics
- Priority slider per topic (Low/Medium/High)
2. Source trust controls
- Preferred sources
- Mute source
3. Reading goals
- Daily minutes target
- Summary depth preference (short/medium/detailed)

## Analytics Screen
1. Weekly reading time and completion trend
2. Top engaged topics
3. Source diversity score
4. Recommendation quality feedback loop
- Helpful vs not relevant ratio

## Visual System
1. Typography
- Headline: "Sora" (or "IBM Plex Serif")
- UI/body: "IBM Plex Sans"
2. Color tokens
- `--bg`: #F6F7F9
- `--surface`: #FFFFFF
- `--ink`: #0E1623
- `--accent`: #0D9488 (teal)
- `--warning`: #D97706
- `--muted`: #6B7280
3. Density
- Comfortable card rhythm with strong whitespace
- Compact metadata rows
4. Motion
- Soft mode transitions between Home and Search (180-220ms)
- Staggered card reveal on first load

## Component List (MVP)
1. `FeedModeSwitch`
2. `TopicPillBar`
3. `ArticleCard`
4. `WhyRecommendedTag`
5. `SearchStateBanner`
6. `ArticleDetailModal`
7. `SummaryBlock`
8. `ReadingProgressWidget`
9. `InterestPriorityControl`
10. `SourceTrustControl`

## Implementation Sequence
1. Build design tokens + typography foundation.
2. Refactor `ArticleCard` to support "why recommended" and consistent actions.
3. Implement Search Mode state banner and transition.
4. Redesign Article modal with summary-first layout.
5. Add analytics widgets and preferences controls.

## Success Metrics
1. +20% article open-to-completion rate.
2. +15% weekly active return rate.
3. Reduced dismiss rate in top 10 ranked items.
4. Increased save/bookmark rate on personalized feed.
