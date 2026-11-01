const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export const resolveImageUrl = (value) => {
  if (typeof value !== 'string' || !value.trim()) return '';

  const imagePath = value.trim();
  if (/^https?:\/\//i.test(imagePath)) return imagePath;
  if (typeof window === 'undefined') return imagePath;

  const backendOrigin = API_BASE_URL
    ? new URL(API_BASE_URL, window.location.origin).origin
    : window.location.origin;
  const normalizedPath = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;

  return new URL(normalizedPath, backendOrigin).toString();
};
