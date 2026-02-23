import { useRef, useEffect, useState } from 'react';

/**
 * TopicFilterBar Component
 * Horizontal scrollable topic filter pills
 */
function TopicFilterBar({ topics, selectedTopic, onTopicChange, loading }) {
  const scrollRef = useRef(null);
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(false);

  // Check scroll position for fade indicators
  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setShowLeftFade(scrollLeft > 0);
      setShowRightFade(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [topics]);

  // Handle both string topics and object topics {id, name, icon}
  const normalizeTopics = (topicList) => {
    return topicList.map(t => {
      if (typeof t === 'string') {
        return { id: t.toLowerCase(), name: t };
      }
      return t;
    });
  };

  const normalizedTopics = normalizeTopics(topics);
  const allTopics = [{ id: 'all', name: 'All' }, ...normalizedTopics];

  const handleTopicClick = (topic) => {
    if (loading) return;
    onTopicChange(topic.id === 'all' ? null : topic.id);
  };

  return (
    <div className="topic-filter-container">
      {showLeftFade && <div className="topic-fade topic-fade-left" />}

      <div
        ref={scrollRef}
        className="topic-filter-bar"
        onScroll={checkScroll}
      >
        {allTopics.map((topic) => {
          const isSelected =
            topic.id === 'all'
              ? selectedTopic === null
              : selectedTopic === topic.id;

          return (
            <button
              key={topic.id}
              className={`topic-pill ${isSelected ? 'active' : ''}`}
              onClick={() => handleTopicClick(topic)}
              disabled={loading}
            >
              <span className="topic-pill-text">{topic.name}</span>
            </button>
          );
        })}
      </div>

      {showRightFade && <div className="topic-fade topic-fade-right" />}
    </div>
  );
}

export default TopicFilterBar;
