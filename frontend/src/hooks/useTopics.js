import { useState, useEffect, useRef } from 'react';

// Default topics for onboarding/selection
const DEFAULT_TOPICS = [
  // Tech & AI
  { id: 'technology', name: 'Technology', icon: '💻' },
  { id: 'ai', name: 'AI & ML', icon: '🤖' },
  { id: 'programming', name: 'Programming', icon: '👨‍💻' },
  { id: 'gadgets', name: 'Gadgets', icon: '📱' },
  { id: 'cybersecurity', name: 'Cybersecurity', icon: '🔐' },

  // Gaming
  { id: 'gaming', name: 'Gaming', icon: '🎮' },
  { id: 'esports', name: 'Esports', icon: '🏆' },

  // Science
  { id: 'science', name: 'Science', icon: '🔬' },
  { id: 'space', name: 'Space', icon: '🚀' },
  { id: 'health', name: 'Health', icon: '❤️' },

  // Business
  { id: 'business', name: 'Business', icon: '💼' },
  { id: 'startups', name: 'Startups', icon: '🚀' },
  { id: 'finance', name: 'Finance', icon: '💰' },
  { id: 'crypto', name: 'Crypto', icon: '₿' },

  // Entertainment
  { id: 'entertainment', name: 'Entertainment', icon: '🎬' },
  { id: 'movies', name: 'Movies', icon: '🎥' },
  { id: 'music', name: 'Music', icon: '🎵' },
  { id: 'anime', name: 'Anime', icon: '🎌' },

  // Sports & Lifestyle
  { id: 'sports', name: 'Sports', icon: '⚽' },
  { id: 'fitness', name: 'Fitness', icon: '💪' },
  { id: 'travel', name: 'Travel', icon: '✈️' },
  { id: 'food', name: 'Food', icon: '🍕' },

  // News & World
  { id: 'news', name: 'World News', icon: '📰' },
  { id: 'politics', name: 'Politics', icon: '🏛️' },
  { id: 'environment', name: 'Environment', icon: '🌱' },
];

/**
 * Custom hook for getting available topics
 */
export function useTopics() {
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTopics(DEFAULT_TOPICS);
    setLoading(false);
  }, []);

  return { topics, loading, error: null };
}

export default useTopics;
