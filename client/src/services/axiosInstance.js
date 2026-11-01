import axios from 'axios';

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  timeout: 15000,
  withCredentials: false,
});

// Attach token to every request if available
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle 401 responses and normalize error messages
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    const requestUrl = error.config?.url || '';
    const isAuthEndpoint = requestUrl.includes('/api/auth/');

    if (error.response?.status === 401) {
      if (!isAuthEndpoint) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.dispatchEvent(new CustomEvent('auth:session-expired'));
      }
      return Promise.reject(error);
    }

    if (isAuthEndpoint) {
      return Promise.reject(error);
    }

    const validationErrors = Array.isArray(error.response?.data?.errors)
      ? error.response.data.errors
          .map(({ field, message: validationMessage }) =>
            field ? `${field}: ${validationMessage}` : validationMessage
          )
          .filter(Boolean)
      : [];
    const message =
      (validationErrors.length && validationErrors.join('; ')) ||
      error.response?.data?.message ||
      'An unexpected error occurred';

    const enhancedError = new Error(message);
    if (error.response) {
      enhancedError.response = error.response;
      enhancedError.validationErrors = error.response.data?.errors || [];
    }
    return Promise.reject(enhancedError);
  }
);

export default axiosInstance;
