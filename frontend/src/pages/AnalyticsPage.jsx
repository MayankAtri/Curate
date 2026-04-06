import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAnalytics } from '../hooks/useAnalytics';
import { authService } from '../services/api';

function IntelligenceMetric({ label, value, subtext, trend }) {
  return (
    <div className="intelligence-metric-card">
      <div className="metric-header">
        <span className="metric-label">{label}</span>
        {trend && <span className={`metric-trend ${trend.type}`}>{trend.value}</span>}
      </div>
      <div className="metric-value">{value}</div>
      {subtext && <div className="metric-subtext">{subtext}</div>}
    </div>
  );
}

function TopicLedger({ topic, maxEngagement }) {
  const percentage = maxEngagement > 0 ? (topic.totalEngagement / maxEngagement) * 100 : 0;
  return (
    <div className="ledger-item">
      <div className="ledger-row">
        <span className="ledger-name">{topic._id?.toUpperCase()}</span>
        <span className="ledger-count">{topic.totalEngagement}</span>
      </div>
      <div className="ledger-track">
        <div className="ledger-fill" style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

function SourceSignal({ source }) {
  const sentiment = source.likes - source.dislikes;
  return (
    <div className="source-signal-card">
      <div className="source-signal-header">
        <span className="source-id">{source._id}</span>
        <span className={`sentiment-tag ${sentiment >= 0 ? 'pos' : 'neg'}`}>
          {sentiment >= 0 ? 'Well received' : 'Mixed response'}
        </span>
      </div>
      <div className="source-signal-metrics">
        <div className="sig-stat"><span>Clicks</span>{source.clicks}</div>
        <div className="sig-stat"><span>Saves</span>{source.bookmarks}</div>
        <div className="sig-stat"><span>Score</span>{sentiment}</div>
      </div>
    </div>
  );
}

function AnalyticsPage() {
  const navigate = useNavigate();
  const [days, setDays] = useState(30);
  const { insights, loading, error, refetch } = useAnalytics(days);

  useEffect(() => {
    if (!authService.isAuthenticated()) { navigate('/login'); }
  }, [navigate]);

  if (loading) return <div className="analytics-v2-loading">Loading analytics...</div>;
  if (error) {
    return (
      <main className="analytics-v2-container">
        <div className="border-4 border-black bg-[#ffe8e1] p-8">
          <p className="font-['Space_Grotesk'] text-xs font-bold uppercase tracking-widest text-[#b32100] mb-3">Could not load analytics</p>
          <p className="font-['Newsreader'] text-3xl font-bold italic mb-6">{error}</p>
          <button className="time-btn-v2 active" onClick={refetch}>Try again</button>
        </div>
      </main>
    );
  }

  const summary = insights?.summary || {};
  const topTopics = insights?.topEngagedTopics || [];
  const topSources = insights?.topEngagedSources || [];
  const lengthPref = insights?.lengthPreference || [];
  const maxTopic = topTopics[0]?.totalEngagement || 1;
  const totalDispatches = summary.totalViews || 0;
  const avgMinutes = summary.avgDuration ? `${Math.round(summary.avgDuration / 60)}m` : '0m';
  const completionRatio = summary.avgReadRatio ? `${Math.round(summary.avgReadRatio * 100)}%` : '0%';
  const preferenceCount = (insights?.preferences?.explicit || 0) + (insights?.preferences?.implicit || 0);
  const trend = totalDispatches > 0
    ? { type: 'pos', value: `${Math.round((summary.avgReadRatio || 0) * 100)}% READ` }
    : null;
  const sourceCount = topSources.length;

  return (
    <main className="analytics-v2-container">
      <header className="analytics-masthead">
        <div className="masthead-left">
          <span className="edition-tag">Your reading activity</span>
          <h1>Analytics</h1>
        </div>
        <div className="time-filter-v2">
          {['07', '30', '90'].map(d => (
            <button 
              key={d}
              className={`time-btn-v2 ${days === parseInt(d) ? 'active' : ''}`}
              onClick={() => setDays(parseInt(d))}
            >
              {d}_DAYS
            </button>
          ))}
        </div>
      </header>

      <div className="intelligence-grid">
        <section className="intel-section full-width">
          <h2 className="intel-label">Overview</h2>
          <div className="metrics-row">
            <IntelligenceMetric label="Total reads" value={totalDispatches} trend={trend} />
            <IntelligenceMetric label="Average reading time" value={avgMinutes} subtext={`${sourceCount} active sources`} />
            <IntelligenceMetric label="Completion rate" value={completionRatio} subtext={`${summary.completedReads || 0} completed reads`} />
            <IntelligenceMetric label="Preferences" value={preferenceCount} subtext={`${insights?.preferences?.implicit || 0} learned automatically`} />
          </div>
        </section>

        <section className="intel-section span-2">
          <h2 className="intel-label">Top topics</h2>
          <div className="ledger-box">
            {topTopics.length > 0 ? topTopics.map(t => <TopicLedger key={t._id} topic={t} maxEngagement={maxTopic} />) : (
              <div className="empty-telemetry">No topic history yet</div>
            )}
          </div>
        </section>

        <section className="intel-section span-2">
          <h2 className="intel-label">Top sources</h2>
          <div className="source-grid-v2">
            {topSources.length > 0 ? topSources.slice(0, 6).map(s => <SourceSignal key={s._id} source={s} />) : (
              <div className="empty-telemetry">No source history yet</div>
            )}
          </div>
        </section>

        <section className="intel-section full-width">
          <h2 className="intel-label">Reading depth</h2>
          <div className="depth-grid">
            {lengthPref.length > 0 ? lengthPref.map(p => (
              <div key={p._id} className="depth-card">
                <span className="depth-type">{p._id?.toUpperCase()}</span>
                <div className="depth-value">{p.totalInteractions} <span>reads</span></div>
                <div className="depth-stat">Completion: {p.totalInteractions ? Math.round((p.completedReads / p.totalInteractions) * 100) : 0}%</div>
              </div>
            )) : (
              <div className="empty-telemetry depth-empty">No reading depth data yet</div>
            )}
          </div>
        </section>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .analytics-v2-container {
          max-width: 1600px;
          margin: 0 auto;
          padding: 4rem;
          background: var(--bg-primary);
          font-family: var(--font-body);
        }
        .analytics-masthead {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          border-bottom: var(--border-thick) solid var(--separator);
          padding-bottom: 2rem;
          margin-bottom: 4rem;
        }
        .analytics-masthead h1 {
          font-family: var(--font-display);
          font-size: 4.5rem;
          line-height: 0.9;
          margin: 0;
        }
        .time-filter-v2 {
          display: flex;
          border: var(--border-solid);
        }
        .time-btn-v2 {
          padding: 0.75rem 1.5rem;
          background: transparent;
          border: none;
          border-right: var(--border-solid);
          font-weight: 900;
          font-size: 0.8rem;
          cursor: pointer;
        }
        .time-btn-v2:last-child { border-right: none; }
        .time-btn-v2.active {
          background: var(--text-primary);
          color: var(--bg-primary);
        }
        .intelligence-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 4rem;
        }
        .intel-section {
          display: flex;
          flex-direction: column;
        }
        .full-width { grid-column: span 4; }
        .span-2 { grid-column: span 2; }
        .intel-label {
          font-size: 0.8rem;
          font-weight: 900;
          letter-spacing: 0.2em;
          margin-bottom: 2rem;
          padding-bottom: 1rem;
          border-bottom: var(--border-solid);
          opacity: 0.6;
        }
        .metrics-row {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          border: var(--border-solid);
        }
        .intelligence-metric-card {
          padding: 2rem;
          border-right: var(--border-solid);
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .intelligence-metric-card:last-child { border-right: none; }
        .metric-label {
          font-size: 0.65rem;
          font-weight: 900;
          opacity: 0.5;
        }
        .metric-value {
          font-family: var(--font-display);
          font-size: 3.5rem;
          font-weight: 900;
          line-height: 1;
        }
        .ledger-box {
          border: var(--border-solid);
          padding: 2rem;
          background: var(--bg-secondary);
        }
        .ledger-item { margin-bottom: 1.5rem; }
        .ledger-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 0.5rem;
          font-weight: 900;
          font-size: 0.85rem;
        }
        .ledger-track {
          height: 12px;
          background: var(--bg-primary);
          border: 1px solid var(--separator);
        }
        .ledger-fill {
          height: 100%;
          background: var(--accent-primary);
        }
        .source-grid-v2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.5rem;
        }
        .source-signal-card {
          border: var(--border-solid);
          padding: 1.5rem;
          background: var(--bg-primary);
        }
        .source-id {
          font-weight: 900;
          display: block;
          margin-bottom: 1rem;
        }
        .sig-stat {
          display: flex;
          justify-content: space-between;
          font-size: 0.75rem;
          font-weight: 700;
          margin-bottom: 0.4rem;
        }
        .sig-stat span { opacity: 0.5; }
        .depth-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 2rem;
        }
        .depth-card {
          border: var(--border-thick) solid var(--separator);
          padding: 3rem;
          background: var(--bg-secondary);
          text-align: center;
        }
        .empty-telemetry {
          border: var(--border-solid);
          padding: 2rem;
          background: var(--bg-secondary);
          font-weight: 900;
          letter-spacing: 0.12em;
          font-size: 0.78rem;
          opacity: 0.65;
        }
        .depth-empty {
          grid-column: 1 / -1;
        }
        .depth-type {
          font-weight: 900;
          font-size: 0.8rem;
          letter-spacing: 0.3em;
          display: block;
          margin-bottom: 1.5rem;
        }
        .depth-value {
          font-family: var(--font-display);
          font-size: 4rem;
          font-weight: 900;
          margin-bottom: 1rem;
        }
        .depth-value span { font-size: 1rem; opacity: 0.4; }
      `}} />
    </main>
  );
}

export default AnalyticsPage;
