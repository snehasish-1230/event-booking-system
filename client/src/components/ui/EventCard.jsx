import { useNavigate } from 'react-router-dom';
import { format, isPast } from 'date-fns';
import { formatCurrency } from '../../utils/formatters';
import { isPaidEvent } from '../../utils/eventPricing';
import EventImage from './EventImage';

const CATEGORY_COLORS = {
  conference: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  workshop: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  seminar: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  meetup: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  concert: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
  sports: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  networking: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
  webinar: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
};

const CATEGORY_GRADIENTS = [
  'from-primary-500 to-primary-700',
  'from-pink-500 to-rose-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-cyan-500 to-blue-600',
  'from-violet-500 to-purple-600',
];

const getCapacityColor = (percentage) => {
  if (percentage >= 90) return 'bg-danger-500';
  if (percentage >= 70) return 'bg-warning-500';
  return 'bg-success-500';
};

const EventCard = ({ event }) => {
  const navigate = useNavigate();

  if (!event) return null;

  const {
    title,
    slug,
    category,
    date,
    location,
    venue: topVenue,
    city: topCity,
    price,
    capacity = 0,
    registeredCount = 0,
    image,
  } = event;

  const venue = location?.venue || topVenue;
  const city = location?.city || topCity;

  const eventDate = date ? new Date(date) : null;
  const isEventPast = eventDate ? isPast(eventDate) : false;
  const isFull = capacity > 0 && registeredCount >= capacity;
  const spotsLeft = capacity - registeredCount;
  const capacityPercentage = capacity > 0 ? (registeredCount / capacity) * 100 : 0;

  const gradientIndex = title ? title.charCodeAt(0) % CATEGORY_GRADIENTS.length : 0;
  const categoryKey = category?.toLowerCase();
  const categoryColor = CATEGORY_COLORS[categoryKey] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';

  const handleClick = () => {
    if (slug) navigate(`/events/${slug}`);
  };

  return (
    <div
      onClick={handleClick}
      className="group cursor-pointer bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-lg
                 border border-gray-200 dark:border-gray-700 overflow-hidden
                 transition-all duration-300 hover:-translate-y-1 flex flex-col"
    >
      {/* Image */}
      <div className="relative h-48 overflow-hidden">
        <EventImage
          src={image}
          alt={title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          fallback={
            <div
              className={`w-full h-full bg-linear-to-br ${CATEGORY_GRADIENTS[gradientIndex]}
                          flex items-center justify-center transition-transform duration-300 group-hover:scale-105`}
            >
              <svg className="w-16 h-16 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
            </div>
          }
        />

        {/* Category Badge */}
        <span className={`absolute top-3 left-3 px-2.5 py-1 text-xs font-semibold rounded-full ${categoryColor}`}>
          {category}
        </span>

        {/* Price Badge */}
        <span className="absolute top-3 right-3 px-2.5 py-1 text-xs font-bold rounded-full bg-white/90 dark:bg-gray-900/90 text-gray-900 dark:text-white shadow-sm">
          {isPaidEvent(event) ? formatCurrency(price) : 'FREE'}
        </span>

        {/* Sold Out Overlay */}
        {isFull && !isEventPast && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="px-4 py-2 bg-danger-500 text-white text-sm font-bold rounded-full uppercase tracking-wider">
              Sold Out
            </span>
          </div>
        )}

        {/* Past Event Overlay */}
        {isEventPast && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="px-4 py-2 bg-gray-700 text-white text-sm font-bold rounded-full uppercase tracking-wider">
              Past Event
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className={`p-4 flex flex-col flex-1 ${isEventPast ? 'opacity-60' : ''}`}>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white line-clamp-2 mb-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
          {title}
        </h3>

        {/* Date */}
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1.5">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
          </svg>
          <span>{eventDate ? format(eventDate, 'EEE, MMM dd, yyyy') : 'Date TBD'}</span>
        </div>

        {/* Location */}
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-4">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
          </svg>
          <span className="truncate">{[venue, city].filter(Boolean).join(', ')}</span>
        </div>

        {/* Capacity Bar */}
        <div className="mt-auto">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1.5">
            <span>{registeredCount} / {capacity} registered</span>
            <span className={`font-medium ${isFull ? 'text-danger-500' : spotsLeft <= 10 ? 'text-warning-500' : 'text-success-500'}`}>
              {isFull ? 'No spots left' : `${spotsLeft} spots left`}
            </span>
          </div>
          <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${getCapacityColor(capacityPercentage)}`}
              style={{ width: `${Math.min(capacityPercentage, 100)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventCard;
