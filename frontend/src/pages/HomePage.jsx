import { Link } from 'react-router-dom';
import NewsFeed from '../components/NewsFeed';
import TopicFilterBar from '../components/TopicFilterBar';
import ArticleModal from '../components/ArticleModal';
import { useFeed } from '../hooks/useFeed';
import { useTopics } from '../hooks/useTopics';
import { useAnalytics } from '../hooks/useAnalytics';
import { useState } from 'react';

function FeedSkeleton() {
  return (
    <div className="bento-grid skeleton-grid" aria-hidden="true">
      <div className="news-card card-variant-hero skeleton-card">
        <div className="skeleton-shimmer" />
      </div>
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="news-card skeleton-card">
          <div className="skeleton-shimmer" />
        </div>
      ))}
    </div>
  );
}

function QuickStatsBar({ insights, loading }) {
  if (loading || !insights) return null;

  const summary = insights.summary || {};
  const topTopics = insights.topEngagedTopics || [];

  // Only show if user has some activity
  if (!summary.totalViews || summary.totalViews === 0) return null;

  return (
    <div className="quick-stats-bar">
      <div className="quick-stat">
        <span className="quick-stat-icon">👁️</span>
        <span className="quick-stat-value">{summary.totalViews}</span>
        <span className="quick-stat-label">read</span>
      </div>
      {summary.avgReadRatio > 0 && (
        <div className="quick-stat">
          <span className="quick-stat-icon">📊</span>
          <span className="quick-stat-value">
            {Math.round(summary.avgReadRatio * 100)}%
          </span>
          <span className="quick-stat-label">completion</span>
        </div>
      )}
      {topTopics.length > 0 && (
        <div className="quick-stat">
          <span className="quick-stat-icon">🔥</span>
          <span className="quick-stat-value">{topTopics[0]._id}</span>
          <span className="quick-stat-label">top topic</span>
        </div>
      )}
      <Link to="/analytics" className="quick-stat" style={{ textDecoration: 'none' }}>
        <span className="quick-stat-icon">📈</span>
        <span className="quick-stat-label">View all stats</span>
      </Link>
    </div>
  );
}

function HomePage() {
  const [activeArticle, setActiveArticle] = useState(null);

  const {
    items,
    loading,
    error,
    selectedTopic,
    strictTopicFilter,
    changeTopic,
    searchTopic,
    refresh,
    backToRegularFeed,
    retry,
  } = useFeed({ limit: 40 });
  const [searchInput, setSearchInput] = useState('');

  const { topics, loading: topicsLoading } = useTopics();
  const { insights, loading: analyticsLoading } = useAnalytics(30);

  const handleArticleClick = (article) => {
    setActiveArticle(article);
  };

  const closeModal = () => {
    setActiveArticle(null);
  };

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    const query = searchInput.trim();
    if (!query) {
      changeTopic(null);
      return;
    }
    searchTopic(query);
  };

  const handleBackToFeed = async () => {
    setSearchInput('');
    await backToRegularFeed();
  };

  const heroItem = items.length > 0 ? items[0] : null;
  const feedItems = items.length > 0 ? items.slice(1) : [];
  const isSearchMode = strictTopicFilter && !!selectedTopic;
  const emptyTitle = isSearchMode ? `No results for "${selectedTopic}"` : 'No news yet';
  const emptyDescription = isSearchMode
    ? 'Try a broader keyword or go back to your personalized feed.'
    : 'Check back later for the latest updates';

  return (
    <main className="main">
      {/* Header Actions */}
      <div className="feed-header">
        <h2 className="section-title">
          {selectedTopic
            ? strictTopicFilter
              ? `Search: "${selectedTopic}"`
              : `#${selectedTopic}`
            : 'Top Stories'}
        </h2>
        <button className="refresh-button" onClick={refresh} disabled={loading}>
          <svg
            className="refresh-icon"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
        </button>
      </div>

      <form className="topic-search-bar" onSubmit={handleSearchSubmit}>
        <input
          type="text"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="Search topics like GTA 6 or new iPhone releases"
          className="topic-search-input"
        />
        <button type="submit" className="topic-search-button" disabled={loading}>
          Search Live
        </button>
      </form>

      {strictTopicFilter && selectedTopic && (
        <div className="search-state-bar">
          <div className="search-state-text">
            Showing live search for <span className="search-state-query">"{selectedTopic}"</span>
          </div>
          <button
            type="button"
            className="topic-search-button secondary"
            onClick={handleBackToFeed}
            disabled={loading}
          >
            Back to Personalized Feed
          </button>
        </div>
      )}

      {/* Quick Stats */}
      <QuickStatsBar insights={insights} loading={analyticsLoading} />

      {/* Topic Filter */}
      {!topicsLoading && topics.length > 0 && (
        <TopicFilterBar
          topics={topics}
          selectedTopic={selectedTopic}
          onTopicChange={changeTopic}
          loading={loading}
        />
      )}

      {/* Loading State */}
      {loading && items.length === 0 && <FeedSkeleton />}

      {/* Error State */}
      {error && (
        <div className="error">
          <p>
            {isSearchMode
              ? `Could not load search results for "${selectedTopic}".`
              : 'Could not load your feed.'}
          </p>
          <button onClick={retry}>Try Again</button>
        </div>
      )}

      {/* Bento Grid Feed */}
      <div className={`news-grid-wrapper ${loading ? 'loading-pulse' : ''}`}>
        <NewsFeed
          items={feedItems}
          heroItem={heroItem}
          onArticleClick={handleArticleClick}
          emptyTitle={emptyTitle}
          emptyDescription={emptyDescription}
        />
      </div>

      {activeArticle && (
        <ArticleModal article={activeArticle} onClose={closeModal} />
      )}
    </main>
  );
}

export default HomePage;
