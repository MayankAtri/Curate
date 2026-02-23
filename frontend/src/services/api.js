import axios from 'axios';

const resolvedApiBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    // When opening frontend from phone on LAN, "localhost" points to phone itself.
    // Use the same host as frontend with backend port.
    return `http://${host}:5001/api`;
  }

  return 'http://localhost:5001/api';
};

const API_BASE_URL = resolvedApiBaseUrl();

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If 401 and we haven't retried yet, try to refresh token
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refreshToken,
          });

          const { accessToken, refreshToken: newRefreshToken } = response.data;
          localStorage.setItem('accessToken', accessToken);
          localStorage.setItem('refreshToken', newRefreshToken);

          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        } catch (refreshError) {
          // Refresh failed, clear tokens and redirect to login
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('user');
          window.location.href = '/login';
          return Promise.reject(refreshError);
        }
      }
    }

    return Promise.reject(error);
  }
);

export const authService = {
  /**
   * Register a new user
   */
  async register({ email, username, password }) {
    const response = await api.post('/auth/register', {
      email,
      username,
      password,
    });

    const { user, accessToken, refreshToken } = response.data;

    // Store tokens and user
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('user', JSON.stringify(user));

    return response.data;
  },

  /**
   * Login user
   */
  async login({ email, password }) {
    const response = await api.post('/auth/login', {
      email,
      password,
    });

    const { user, accessToken, refreshToken } = response.data;

    // Store tokens and user
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('user', JSON.stringify(user));

    return response.data;
  },

  /**
   * Logout user
   */
  async logout() {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore errors on logout
    }

    // Clear local storage
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
  },

  /**
   * Get current user
   */
  async getMe() {
    const response = await api.get('/auth/me');
    return response.data;
  },

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return !!localStorage.getItem('accessToken');
  },

  /**
   * Get stored user
   */
  getUser() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },
};

export const feedService = {
  /**
   * Get personalized feed
   */
  async getFeed(options = {}) {
    const {
      limit = 20,
      cursor = null,
      topic = null,
      strictTopic = false,
      liveSearch = false,
    } = options;
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit);
    if (cursor) params.append('cursor', cursor);
    if (topic) params.append('topic', topic);
    if (strictTopic) params.append('strictTopic', 'true');
    if (liveSearch) params.append('liveSearch', 'true');

    const response = await api.get(`/feed?${params}`);
    return response.data;
  },

  /**
   * Get user's learned topics from insights
   */
  async getTopics() {
    const response = await api.get('/interactions/insights');
    return response.data.topEngagedTopics || [];
  },

  /**
   * Refresh feed
   */
  async refreshFeed() {
    const response = await api.get('/feed/refresh');
    return response.data;
  },

  /**
   * Get trending articles
   */
  async getTrending(limit = 20) {
    const response = await api.get(`/feed/trending?limit=${limit}`);
    return response.data;
  },

  /**
   * Get feed stats
   */
  async getStats() {
    const response = await api.get('/feed/stats');
    return response.data;
  },
};

export const interactionService = {
  /**
   * Track a user interaction
   */
  async trackInteraction(articleId, action, data = {}) {
    const response = await api.post('/interactions/track', {
      articleId,
      action,
      ...data,
    });
    return response.data;
  },

  async trackView(articleId, durationSeconds, scrollDepth = null) {
    return this.trackInteraction(articleId, 'VIEW', {
      durationSeconds,
      scrollDepth,
    });
  },

  async trackClick(articleId, feedPosition = null) {
    return this.trackInteraction(articleId, 'CLICK', { feedPosition });
  },

  async like(articleId) {
    return this.trackInteraction(articleId, 'LIKE');
  },

  async dislike(articleId) {
    return this.trackInteraction(articleId, 'DISLIKE');
  },

  async bookmark(articleId) {
    return this.trackInteraction(articleId, 'BOOKMARK');
  },

  async getInsights(days = 30) {
    const response = await api.get(`/interactions/insights?days=${days}`);
    return response.data;
  },

  async getStats(days = 30) {
    const response = await api.get(`/interactions/stats?days=${days}`);
    return response.data;
  },

  async getHistory(days = 30, limit = 50) {
    const response = await api.get(`/interactions/history?days=${days}&limit=${limit}`);
    return response.data;
  },
};

export const preferencesService = {
  async getTopics() {
    const response = await api.get('/preferences/topics');
    return response.data.topics || [];
  },

  async updateTopics(topics = []) {
    const response = await api.put('/preferences/topics', { topics });
    return response.data.topics || [];
  },
};

export default api;
