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
    if (!authService.isAuthenticated()) { navigate('/login'); return; }
    let mounted = true;
    preferencesService.getTopics().then((topicIds) => {
      if (mounted) setSelectedTopics(topicIds);
    }).catch(() => {});
    return () => { mounted = false; };
  }, [navigate]);

  const handleLogout = async () => {
    await authService.logout();
    navigate('/login');
  };

  const handleSaveTopics = async () => {
    setSavingTopics(true);
    setStatusMessage('');
    try {
      await preferencesService.updateTopics(selectedTopics);
      setIsEditing(false);
      setStatusMessage('Preferences updated');
    } catch (error) {
      setStatusMessage('Could not update preferences');
    } finally {
      setSavingTopics(false);
    }
  };

  if (!user) return null;
  const summary = insights?.summary || {};
  const explicitCount = insights?.preferences?.explicit || 0;
  const implicitCount = insights?.preferences?.implicit || 0;
  const learnedTopics = insights?.topEngagedTopics?.length || 0;
  const completionRate = Math.round((summary.avgReadRatio || 0) * 100);
  const profileStatus = selectedTopics.length > 0 ? 'CALIBRATED' : 'UNSET';

  return (
    <main className="preferences-v2-container">
      <header className="prefs-masthead">
        <div className="masthead-left">
          <span className="edition-tag">Your account</span>
          <h1>Preferences</h1>
        </div>
        <div className="masthead-right">
          <button className="logout-btn-v2" onClick={handleLogout}>Log out</button>
        </div>
      </header>

      <div className="control-grid">
        <section className="control-col span-1">
          <div className="schematic-box">
            <h2 className="schematic-label">Profile</h2>
            <div className="profile-block">
              <div className="v2-avatar">{user.username?.charAt(0).toUpperCase()}</div>
              <div className="profile-details">
                <div className="detail-item">
                  <label>Name</label>
                  <span>{user.username}</span>
                </div>
                <div className="detail-item">
                  <label>Email</label>
                  <span>{user.email}</span>
                </div>
                <div className="detail-item">
                  <label>Account</label>
                  <span className="level-tag">Active</span>
                </div>
                <div className="detail-item">
                  <label>Topic setup</label>
                  <span>{profileStatus === 'CALIBRATED' ? 'Ready' : 'Not set'}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="schematic-box mt-4">
            <h2 className="schematic-label">Reading stats</h2>
            <div className="telemetry-list">
              <div className="tel-row">
                <span>Total reads</span>
                <strong>{summary.totalViews || 0}</strong>
              </div>
              <div className="tel-row">
                <span>Completion rate</span>
                <strong>{completionRate}%</strong>
              </div>
              <div className="tel-row">
                <span>Learned topics</span>
                <strong>{learnedTopics}</strong>
              </div>
              <div className="tel-row">
                <span>Saved preferences</span>
                <strong>{explicitCount + implicitCount}</strong>
              </div>
            </div>
            <Link to="/analytics" className="schematic-link">Open analytics</Link>
          </div>
        </section>

        <section className="control-col span-2">
          <div className="schematic-box h-full">
            <header className="schematic-header">
              <h2 className="schematic-label">Topics</h2>
              <button 
                className={`schematic-btn ${isEditing ? 'active' : ''}`}
                onClick={() => isEditing ? handleSaveTopics() : setIsEditing(true)}
                disabled={savingTopics}
              >
                {isEditing ? (savingTopics ? 'Saving...' : 'Save changes') : 'Edit topics'}
              </button>
            </header>

            <div className="calibration-body">
              {isEditing ? (
                <div className="editor-wrap">
                  <TopicSelector
                    topics={topics}
                    selectedTopics={selectedTopics}
                    onToggle={(id) => {
                      if (selectedTopics.includes(id)) {
                        setSelectedTopics(selectedTopics.filter(t => t !== id));
                      } else {
                        setSelectedTopics([...selectedTopics, id]);
                      }
                    }}
                  />
                </div>
              ) : (
                <div className="read-only-matrix">
                  {selectedTopics.length > 0 ? (
                    <div className="topic-ledgers">
                      {selectedTopics.map(id => {
                        const t = topics.find(topic => topic.id === id);
                        return t && (
                          <div key={id} className="topic-static-card">
                            <span className="topic-id">TPC_{id.slice(0,3).toUpperCase()}</span>
                            <span className="topic-name">{t.name}</span>
                            <span className="topic-status">
                              {insights?.topEngagedTopics?.some((topic) => topic._id === id) ? 'Recommended' : 'Selected'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="empty-warning">Choose some topics to personalize your feed.</div>
                  )}
                </div>
              )}
            </div>
            {statusMessage && <div className="system-status-msg">{statusMessage}</div>}
            {!analyticsLoading && (
              <div className="prefs-footer-ledger">
                <span>Learned automatically: {implicitCount}</span>
                <span>Chosen by you: {explicitCount}</span>
                <span>Completion rate: {completionRate}%</span>
              </div>
            )}
          </div>
        </section>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .preferences-v2-container {
          max-width: 1600px;
          margin: 0 auto;
          padding: 4rem;
          background: var(--bg-primary);
          font-family: var(--font-body);
        }
        .prefs-masthead {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          border-bottom: var(--border-thick) solid var(--separator);
          padding-bottom: 2rem;
          margin-bottom: 4rem;
        }
        .prefs-masthead h1 {
          font-family: var(--font-display);
          font-size: 4.5rem;
          line-height: 0.9;
          margin: 0;
        }
        .logout-btn-v2 {
          background: transparent;
          border: var(--border-solid);
          padding: 0.75rem 1.5rem;
          font-weight: 900;
          font-size: 0.8rem;
          cursor: pointer;
        }
        .logout-btn-v2:hover {
          background: var(--accent-raw);
          color: var(--bg-primary);
          border-color: var(--accent-raw);
        }
        .control-grid {
          display: grid;
          grid-template-columns: 1fr 2fr;
          gap: 4rem;
        }
        .schematic-box {
          border: var(--border-thick) solid var(--separator);
          padding: 3rem;
          background: var(--bg-primary);
          position: relative;
        }
        .schematic-label {
          font-size: 0.75rem;
          font-weight: 900;
          letter-spacing: 0.2em;
          opacity: 0.5;
          margin-bottom: 2.5rem;
          display: block;
          border-bottom: var(--border-solid);
          padding-bottom: 1rem;
        }
        .profile-block {
          display: flex;
          gap: 2rem;
          align-items: center;
        }
        .v2-avatar {
          width: 80px;
          height: 80px;
          border: var(--border-thick) solid var(--separator);
          background: var(--text-primary);
          color: var(--bg-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 3rem;
          font-weight: 900;
          font-family: var(--font-display);
        }
        .detail-item {
          margin-bottom: 1.5rem;
        }
        .detail-item label {
          display: block;
          font-size: 0.65rem;
          font-weight: 900;
          opacity: 0.4;
          margin-bottom: 0.3rem;
        }
        .detail-item span {
          font-weight: 900;
          font-size: 1.1rem;
        }
        .level-tag {
          color: var(--accent-primary);
        }
        .telemetry-list {
          margin-bottom: 2rem;
        }
        .tel-row {
          display: flex;
          justify-content: space-between;
          padding: 1rem 0;
          border-bottom: 1px solid var(--separator);
          font-size: 0.9rem;
        }
        .tel-row span { opacity: 0.6; font-weight: 700; }
        .schematic-link {
          display: block;
          text-align: center;
          padding: 1rem;
          border: var(--border-solid);
          text-decoration: none;
          color: var(--text-primary);
          font-weight: 900;
          font-size: 0.8rem;
        }
        .schematic-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }
        .schematic-btn {
          background: var(--text-primary);
          color: var(--bg-primary);
          border: none;
          padding: 0.75rem 1.5rem;
          font-weight: 900;
          font-size: 0.8rem;
          cursor: pointer;
        }
        .topic-ledgers {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.5rem;
        }
        .topic-static-card {
          border: var(--border-solid);
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          background: var(--bg-secondary);
        }
        .topic-id { font-size: 0.65rem; opacity: 0.5; font-weight: 900; }
        .topic-name { font-weight: 900; font-size: 1.2rem; font-family: var(--font-display); }
        .topic-status { font-size: 0.7rem; color: var(--accent-primary); font-weight: 900; letter-spacing: 0.1em; }
        .system-status-msg {
          margin-top: 2rem;
          font-weight: 900;
          color: var(--accent-primary);
          text-align: center;
          letter-spacing: 0.1em;
        }
        .prefs-footer-ledger {
          margin-top: 2rem;
          padding-top: 1.25rem;
          border-top: var(--border-solid);
          display: flex;
          flex-wrap: wrap;
          gap: 1.5rem;
          font-size: 0.72rem;
          font-weight: 900;
          letter-spacing: 0.14em;
          opacity: 0.7;
        }
        .mt-4 { margin-top: 2rem; }
        .h-full { height: 100%; }
      `}} />
    </main>
  );
}

export default PreferencesPage;
