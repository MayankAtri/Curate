import { useState, useEffect, useCallback, useRef } from 'react';
import { interactionService } from '../services/api';

/**
 * Custom hook for fetching user analytics and insights
 */
export function useAnalytics(days = 30) {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const fetchedRef = useRef(false);

  const fetchInsights = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await interactionService.getInsights(days);
      setInsights(data);
    } catch (err) {
      console.error('Error fetching insights:', err);
      setError(err.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    fetchInsights();
  }, [fetchInsights]);

  return { insights, loading, error, refetch: fetchInsights };
}

export default useAnalytics;
