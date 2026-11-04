import axios from 'axios';

const BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: BASE_URL
});

// Request Interceptor: Attach Auth Token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Global Error and 401 handler
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error Response:', error?.response || error);
    // No response at all (server down, offline, CORS): give every page's
    // `err.response?.data?.message` fallback a message people can act on.
    if (!error.response) {
      error.response = { data: { message: "Can't reach the Fulmile server. Check your connection and try again." } };
      return Promise.reject(error);
    }
    // A failed sign-in is also a 401; let the login form show its error instead of reloading the page.
    if (error.response?.status === 401 && !error.config?.url?.endsWith('/auth/login')) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
