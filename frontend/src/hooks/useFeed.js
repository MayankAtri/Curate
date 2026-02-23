import { useState, useEffect, useCallback, useRef } from 'react';
import { feedService } from '../services/api';

/**
 * Custom hook for fetching and managing feed data
 */
export function useFeed(options = {}) {
  const { limit = 30, autoRefresh = false, refreshInterval = 300000 } = options;

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState(null);
  const [stats, setStats] = useState(null);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [strictTopicFilter, setStrictTopicFilter] = useState(false);
  const [liveSearchMode, setLiveSearchMode] = useState(false);

  // Ref to prevent duplicate fetches (React StrictMode calls useEffect twice)
  const fetchingRef = useRef(false);
  const initialFetchDone = useRef(false);

  /**
   * Fetch feed data
   */
  const fetchFeed = useCallback(async (
    append = false,
    topic = undefined,
    strictTopic = undefined,
    liveSearch = undefined
  ) => {
    // Prevent duplicate concurrent fetches
    if (fetchingRef.current) {
      return;
    }

    // Use provided topic or fall back to current selectedTopic
    const topicToUse = topic !== undefined ? topic : selectedTopic;
    const strictTopicToUse = strictTopic !== undefined ? strictTopic : strictTopicFilter;
    const liveSearchToUse = liveSearch !== undefined ? liveSearch : liveSearchMode;

    try {
      fetchingRef.current = true;

      if (!append) {
        setLoading(true);
        setError(null);
      }

      const response = await feedService.getFeed({
        limit,
        cursor: append ? cursor : null,
        topic: topicToUse,
        strictTopic: strictTopicToUse,
        liveSearch: liveSearchToUse && !append,
      });

      const newItems = response.items || [];

      setItems(prev => append ? [...prev, ...newItems] : newItems);
      setHasMore(response.hasMore || false);
      setCursor(response.nextCursor || null);

    } catch (err) {
      console.error('Error fetching feed:', err);
      setError(err.message || 'Failed to load news');
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [limit, cursor, selectedTopic, strictTopicFilter, liveSearchMode]);

  /**
   * Change topic and fetch filtered feed
   */
  const changeTopic = useCallback((topic) => {
    setSelectedTopic(topic);
    setStrictTopicFilter(false);
    setLiveSearchMode(false);
    setCursor(null);
    setItems([]);
    fetchFeed(false, topic, false, false);
  }, [fetchFeed]);

  /**
   * Strict topic search (no fallback to generic feed).
   */
  const searchTopic = useCallback((topic) => {
    setSelectedTopic(topic);
    setStrictTopicFilter(true);
    setLiveSearchMode(true);
    setCursor(null);
    setItems([]);
    fetchFeed(false, topic, true, true);
  }, [fetchFeed]);

  /**
   * Refresh feed (force regeneration)
   */
  const refresh = useCallback(async (
    topic = undefined,
    strictTopic = undefined,
    liveSearch = undefined
  ) => {
    try {
      setLoading(true);
      setError(null);
      setCursor(null);

      await feedService.refreshFeed();
      await fetchFeed(false, topic, strictTopic, liveSearch);

    } catch (err) {
      console.error('Error refreshing feed:', err);
      setError(err.message || 'Failed to refresh');
    } finally {
      setLoading(false);
    }
  }, [fetchFeed]);

  /**
   * Return to regular personalized feed (non-topic, non-search)
   */
  const backToRegularFeed = useCallback(async () => {
    setSelectedTopic(null);
    setStrictTopicFilter(false);
    setLiveSearchMode(false);
    setCursor(null);
    setItems([]);
    await refresh(null, false, false);
  }, [refresh]);

  /**
   * Load more items
   */
  const loadMore = useCallback(() => {
    if (hasMore && !loading) {
      fetchFeed(true);
    }
  }, [hasMore, loading, fetchFeed]);

  /**
   * Fetch stats
   */
  const fetchStats = useCallback(async () => {
    try {
      const response = await feedService.getStats();
      setStats(response);
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  }, []);

  // Initial fetch (with guard against StrictMode double-call)
  useEffect(() => {
    if (initialFetchDone.current) {
      return;
    }
    initialFetchDone.current = true;

    fetchFeed(false);
    fetchStats();
  }, [fetchFeed, fetchStats]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchFeed(false);
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchFeed]);

  return {
    items,
    loading,
    error,
    hasMore,
    stats,
    selectedTopic,
    strictTopicFilter,
    changeTopic,
    searchTopic,
    refresh,
    backToRegularFeed,
    loadMore,
    retry: () => fetchFeed(false, selectedTopic, strictTopicFilter, liveSearchMode),
  };
}

export default useFeed;
