import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
/* eslint-disable-next-line no-unused-vars */
import { motion } from 'framer-motion';
import { useAnalytics } from '../hooks/useAnalytics';
import { authService } from '../services/api';

function StatCard({ icon, label, value, subtext }) {
  return (
    <motion.div
      className="stat-card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="stat-icon">{icon}</div>
      <div className="stat-content">
        <span className="stat-value">{value}</span>
        <span className="stat-label">{label}</span>
        {subtext && <span className="stat-subtext">{subtext}</span>}
      </div>
    </motion.div>
  );
}

function TopicBar({ topic, maxEngagement }) {
  const percentage = maxEngagement > 0 ? (topic.totalEngagement / maxEngagement) * 100 : 0;

  return (
    <div className="topic-bar-item">
      <div className="topic-bar-header">
        <span className="topic-bar-name">{topic._id}</span>
        <span className="topic-bar-count">{topic.totalEngagement}</span>
      </div>
      <div className="topic-bar-track">
        <motion.div
          className="topic-bar-fill"
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.5, delay: 0.1 }}
        />
      </div>
    </div>
  );
}

function SourceCard({ source }) {
  const sentimentScore = source.likes - source.dislikes;
  const sentimentClass = sentimentScore > 0 ? 'positive' : sentimentScore < 0 ? 'negative' : 'neutral';

  return (
    <div className="source-card">
      <div className="source-name">{source._id}</div>
      <div className="source-stats">
        <span className="source-stat">
          <span className="stat-icon-sm">👆</span> {source.clicks}
        </span>
        <span className="source-stat">
          <span className="stat-icon-sm">🔖</span> {source.bookmarks}
        </span>
        <span className={`source-stat sentiment-${sentimentClass}`}>
          {sentimentScore > 0 ? '+' : ''}{sentimentScore}
        </span>
      </div>
    </div>
  );
}

function AnalyticsPage() {
  const navigate = useNavigate();
  const [days, setDays] = useState(30);
  const { insights, loading, error, refetch } = useAnalytics(days);

  useEffect(() => {
    if (!authService.isAuthenticated()) {
      navigate('/login');
    }
  }, [navigate]);

  useEffect(() => {
    refetch();
  }, [days, refetch]);

  if (loading) {
    return (
      <main className="main analytics-container">
        <div className="loading">
          <div className="loading-spinner" />
          <p>Loading your analytics...</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="main analytics-container">
        <div className="error">
          <p>{error}</p>
          <button onClick={refetch}>Try Again</button>
        </div>
      </main>
    );
  }

  const summary = insights?.summary || {};
  const topTopics = insights?.topEngagedTopics || [];
  const topSources = insights?.topEngagedSources || [];
  const lengthPref = insights?.lengthPreference || [];
  const preferences = insights?.preferences || {};

  const maxTopicEngagement = topTopics.length > 0 ? topTopics[0].totalEngagement : 1;

  return (
    <main className="main analytics-container">
      <div className="analytics-header">
        <h1>Your Reading Analytics</h1>
        <div className="time-filter">
          <button
            className={`time-btn ${days === 7 ? 'active' : ''}`}
            onClick={() => setDays(7)}
          >
            7 Days
          </button>
          <button
            className={`time-btn ${days === 30 ? 'active' : ''}`}
            onClick={() => setDays(30)}
          >
            30 Days
          </button>
          <button
            className={`time-btn ${days === 90 ? 'active' : ''}`}
            onClick={() => setDays(90)}
          >
            90 Days
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <section className="analytics-section">
        <h2>Overview</h2>
        <div className="stats-grid">
          <StatCard
            icon="👁️"
            label="Articles Read"
            value={summary.totalViews || 0}
          />
          <StatCard
            icon="⏱️"
            label="Avg. Read Time"
            value={summary.avgDuration ? `${Math.round(summary.avgDuration / 60)}m` : '0m'}
          />
          <StatCard
            icon="📊"
            label="Avg. Completion"
            value={summary.avgReadRatio ? `${Math.round(summary.avgReadRatio * 100)}%` : '0%'}
          />
          <StatCard
            icon="🎯"
            label="Preferences Learned"
            value={(preferences.explicit || 0) + (preferences.implicit || 0)}
            subtext={`${preferences.implicit || 0} auto-detected`}
          />
        </div>
      </section>

      {/* Top Topics */}
      <section className="analytics-section">
        <h2>Top Topics</h2>
        {topTopics.length > 0 ? (
          <div className="topics-chart">
            {topTopics.slice(0, 8).map((topic) => (
              <TopicBar key={topic._id} topic={topic} maxEngagement={maxTopicEngagement} />
            ))}
          </div>
        ) : (
          <p className="empty-text">No topic data yet. Start reading to see insights!</p>
        )}
      </section>

      {/* Top Sources */}
      <section className="analytics-section">
        <h2>Favorite Sources</h2>
        {topSources.length > 0 ? (
          <div className="sources-grid">
            {topSources.slice(0, 6).map((source) => (
              <SourceCard key={source._id} source={source} />
            ))}
          </div>
        ) : (
          <p className="empty-text">No source data yet.</p>
        )}
      </section>

      {/* Reading Length Preference */}
      <section className="analytics-section">
        <h2>Article Length Preference</h2>
        {lengthPref.length > 0 ? (
          <div className="length-pref-grid">
            {lengthPref.map((pref) => (
              <div key={pref._id} className="length-card">
                <span className="length-icon">
                  {pref._id === 'short' ? '📄' : pref._id === 'medium' ? '📑' : '📚'}
                </span>
                <span className="length-name">{pref._id}</span>
                <span className="length-count">{pref.totalInteractions} reads</span>
                <span className="length-completion">
                  {pref.completedReads}/{pref.totalInteractions} completed
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-text">No reading length data yet.</p>
        )}
      </section>
    </main>
  );
}

export default AnalyticsPage;
