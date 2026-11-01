import { API_ORIGIN } from '../api';

export const resolveImageUrl = (value) => {
  if (typeof value !== 'string' || !value.trim()) return '';

  const imagePath = value.trim();
  if (/^https?:\/\//i.test(imagePath)) return imagePath;
  if (typeof window === 'undefined') return imagePath;

  const normalizedPath = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;

  return new URL(normalizedPath, API_ORIGIN).toString();
};
