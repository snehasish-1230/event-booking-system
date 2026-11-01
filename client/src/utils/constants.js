export const EVENT_CATEGORIES = [
  { value: 'conference', label: 'Conference', icon: '🎤' },
  { value: 'workshop', label: 'Workshop', icon: '🔧' },
  { value: 'seminar', label: 'Seminar', icon: '📚' },
  { value: 'meetup', label: 'Meetup', icon: '🤝' },
  { value: 'concert', label: 'Concert', icon: '🎵' },
  { value: 'sports', label: 'Sports', icon: '⚽' },
  { value: 'networking', label: 'Networking', icon: '🌐' },
  { value: 'webinar', label: 'Webinar', icon: '💻' },
  { value: 'other', label: 'Other', icon: '📌' },
];

export const EVENT_STATUSES = [
  { value: 'draft', label: 'Draft', color: 'gray' },
  { value: 'published', label: 'Published', color: 'green' },
  { value: 'cancelled', label: 'Cancelled', color: 'red' },
  { value: 'completed', label: 'Completed', color: 'blue' },
];

export const REGISTRATION_STATUSES = [
  { value: 'confirmed', label: 'Confirmed', color: 'green' },
  { value: 'cancelled', label: 'Cancelled', color: 'red' },
  { value: 'attended', label: 'Attended', color: 'blue' },
];

export const USER_ROLES = [
  { value: 'attendee', label: 'Attendee', color: 'blue' },
  { value: 'organizer', label: 'Organizer', color: 'purple' },
  { value: 'admin', label: 'Admin', color: 'red' },
];

export const CURRENCIES = [
  { value: 'INR', label: 'Indian Rupee', symbol: '₹' },
];

export const SORT_OPTIONS = [
  { value: 'date', label: 'Date (Nearest)' },
  { value: '-date', label: 'Date (Farthest)' },
  { value: '-createdAt', label: 'Newest First' },
  { value: 'createdAt', label: 'Oldest First' },
  { value: 'price', label: 'Price (Low to High)' },
  { value: '-price', label: 'Price (High to Low)' },
  { value: 'title', label: 'Title (A-Z)' },
  { value: '-title', label: 'Title (Z-A)' },
];

export const ITEMS_PER_PAGE = 12;
