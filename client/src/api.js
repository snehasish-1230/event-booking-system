const productionApiUrl = 'https://event-booking-system-yn5h.onrender.com/api';
const localApiUrl = 'http://localhost:5002/api';
const configuredProductionApiUrl = import.meta.env.VITE_API_URL?.trim();

const configuredApiUrl = import.meta.env.DEV
  ? import.meta.env.VITE_API_URL_LOCAL || localApiUrl
  : /^https?:\/\//i.test(configuredProductionApiUrl || '')
    ? configuredProductionApiUrl
    : productionApiUrl;

const normalizedApiUrl = configuredApiUrl.trim().replace(/\/+$/, '');

export const API_BASE_URL = normalizedApiUrl.endsWith('/api')
  ? normalizedApiUrl
  : `${normalizedApiUrl}/api`;

export const API_ORIGIN = new URL(API_BASE_URL).origin;
