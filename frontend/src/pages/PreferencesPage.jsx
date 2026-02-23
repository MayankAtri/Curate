import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import TopicSelector from '../components/TopicSelector';
import { useTopics } from '../hooks/useTopics';
import { useAnalytics } from '../hooks/useAnalytics';
import { authService, preferencesService } from '../services/api';

function PreferencesPage() {
  const navigate = useNavigate();
  const { topics } = useTopics();
  const { insights, loading: analyticsLoading } = useAnalytics(30);
  const [selectedTopics, setSelectedTopics] = useState([]);
  const [user] = useState(() => authService.getUser());
  const [isEditing, setIsEditing] = useState(false);
  const [savingTopics, setSavingTopics] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    if (!authService.isAuthenticated()) {
      navigate('/login');
      return;
    }

    let mounted = true;
    preferencesService.getTopics()
      .then((topicIds) => {
        if (mounted) {
          setSelectedTopics(topicIds);
        }
      })
      .catch(() => {
        // Keep default empty selection if request fails.
      });

    return () => {
      mounted = false;
    };
  }, [navigate]);

  const handleLogout = async () => {
    await authService.logout();
    navigate('/login');
  };

  const toggleTopic = (id) => {
    if (selectedTopics.includes(id)) {
      setSelectedTopics(selectedTopics.filter((tid) => tid !== id));
    } else {
      setSelectedTopics([...selectedTopics, id]);
    }
  };

  const handleSaveTopics = async () => {
    setSavingTopics(true);
    setStatusMessage('');
    try {
      await preferencesService.updateTopics(selectedTopics);
      setIsEditing(false);
      setStatusMessage('Preferences saved.');
    } catch (error) {
      setStatusMessage(
        error?.response?.data?.message || 'Could not save preferences. Please try again.'
      );
    } finally {
      setSavingTopics(false);
    }
  };

  if (!user) return null;

  const summary = insights?.summary || {};
  const preferences = insights?.preferences || {};

  return (
    <main className="main profile-container preferences-shell">
      <header className="preferences-hero">
        <p className="preferences-kicker">Account & Personalization</p>
        <h1>Preferences</h1>
        <p>Manage your profile, reading stats, and topic interests.</p>
      </header>

      {/* Profile Header */}
      <div className="profile-header-card preferences-card">
        <div className="profile-avatar-lg">
          {user.username?.charAt(0).toUpperCase() ||
            user.email?.charAt(0).toUpperCase()}
        </div>
        <div className="profile-info">
          <h2>{user.username}</h2>
          <p>{user.email}</p>
        </div>
        <button className="logout-btn" onClick={handleLogout}>
          Sign Out
        </button>
      </div>

      {/* Quick Stats */}
      <section className="profile-section prefs-stats-section preferences-card">
        <div className="section-header">
          <h3>Your Stats</h3>
          <Link to="/analytics" className="text-btn">
            View All
          </Link>
        </div>
        {!analyticsLoading ? (
          <div className="prefs-stats-grid">
            <div className="prefs-stat-card">
              <div className="prefs-stat-value">{summary.totalViews || 0}</div>
              <div className="prefs-stat-label">Articles Read</div>
            </div>
            <div className="prefs-stat-card">
              <div className="prefs-stat-value">
                {summary.avgDuration
                  ? `${Math.round(summary.avgDuration / 60)}m`
                  : '0m'}
              </div>
              <div className="prefs-stat-label">Avg. Read Time</div>
            </div>
            <div className="prefs-stat-card">
              <div className="prefs-stat-value">
                {summary.avgReadRatio
                  ? `${Math.round(summary.avgReadRatio * 100)}%`
                  : '0%'}
              </div>
              <div className="prefs-stat-label">Completion Rate</div>
            </div>
            <div className="prefs-stat-card">
              <div className="prefs-stat-value">
                {(preferences.explicit || 0) + (preferences.implicit || 0)}
              </div>
              <div className="prefs-stat-label">Preferences</div>
            </div>
          </div>
        ) : (
          <p className="preferences-muted">Loading stats...</p>
        )}
      </section>

      {/* Interests Section */}
      <section className="profile-section preferences-card">
        <div className="section-header">
          <h3>Your Interests</h3>
          <button
            className="text-btn"
            onClick={() => (isEditing ? handleSaveTopics() : setIsEditing(true))}
            disabled={savingTopics}
          >
            {isEditing ? (savingTopics ? 'Saving...' : 'Save') : 'Edit'}
          </button>
        </div>

        {isEditing ? (
          <TopicSelector
            topics={topics}
            selectedTopics={selectedTopics}
            onToggle={toggleTopic}
          />
        ) : (
          <div className="read-only-topics">
            {selectedTopics.length > 0 ? (
              selectedTopics.map((id) => {
                const t = topics.find((topic) => topic.id === id);
                return t ? (
                  <span key={id} className="topic-pill static">
                    {t.icon} {t.name}
                  </span>
                ) : null;
              })
            ) : (
              <p className="placeholder-text">No topics selected yet.</p>
            )}
          </div>
        )}

        {statusMessage && <p className="preferences-status">{statusMessage}</p>}
      </section>
    </main>
  );
}

export default PreferencesPage;
