import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import * as eventService from '../../services/eventService';
import StatusBadge from '../../components/ui/StatusBadge';
import CapacityBar from '../../components/ui/CapacityBar';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import EventImage from '../../components/ui/EventImage';

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

const STATUS_TABS = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Draft' },
  { key: 'published', label: 'Published' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'completed', label: 'Completed' },
];

const ACTIONS_BY_STATUS = {
  draft: ['edit', 'publish', 'delete'],
  published: ['edit', 'attendees', 'cancel'],
  cancelled: ['delete'],
  completed: ['attendees'],
};

const OrganizerEventsPage = () => {
  useDocumentTitle('My Events');

  const navigate = useNavigate();

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [actionLoading, setActionLoading] = useState(null);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const dropdownRef = useRef(null);

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (activeTab !== 'all') params.status = activeTab;
      const response = await eventService.getMyOrganizedEvents(params);
      const responseData = response.data || response;
      setEvents(responseData.events || (Array.isArray(responseData) ? responseData : []));
    } catch {
      toast.error('Failed to load events');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const statusCounts = events.reduce(
    (acc, event) => {
      acc.all++;
      const status = event.status?.toLowerCase();
      if (acc[status] !== undefined) acc[status]++;
      return acc;
    },
    { all: 0, draft: 0, published: 0, cancelled: 0, completed: 0 }
  );

  const filteredEvents =
    activeTab === 'all'
      ? events
      : events.filter((e) => e.status?.toLowerCase() === activeTab);

  const handlePublish = async (eventId) => {
    setActionLoading(eventId);
    try {
      await eventService.publishEvent(eventId);
      toast.success('Event published successfully!');
      await fetchEvents();
    } catch {
      toast.error('Failed to publish event');
    } finally {
      setActionLoading(null);
      setConfirmModal(null);
    }
  };

  const handleCancel = async (eventId) => {
    setActionLoading(eventId);
    try {
      await eventService.cancelEvent(eventId);
      toast.success('Event cancelled successfully');
      await fetchEvents();
    } catch {
      toast.error('Failed to cancel event');
    } finally {
      setActionLoading(null);
      setConfirmModal(null);
    }
  };

  const handleDelete = async (eventId) => {
    setActionLoading(eventId);
    try {
      await eventService.deleteEvent(eventId);
      toast.success('Event deleted successfully');
      await fetchEvents();
    } catch {
      toast.error('Failed to delete event');
    } finally {
      setActionLoading(null);
      setConfirmModal(null);
    }
  };

  const openConfirm = (type, event) => {
    setOpenDropdown(null);
    setConfirmModal({ type, event });
  };

  const handleAction = (action, event) => {
    setOpenDropdown(null);
    switch (action) {
      case 'edit':
        navigate(`/organizer/events/${event._id}/edit`);
        break;
      case 'attendees':
        navigate(`/organizer/events/${event._id}/attendees`);
        break;
      case 'publish':
        openConfirm('publish', event);
        break;
      case 'cancel':
        openConfirm('cancel', event);
        break;
      case 'delete':
        openConfirm('delete', event);
        break;
    }
  };

  const getCategoryColor = (category) => {
    const key = category?.toLowerCase();
    return CATEGORY_COLORS[key] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">My Events</h1>
          <p className="mt-1 text-gray-500 dark:text-gray-400">Manage and organize your events</p>
        </div>
        <Link
          to="/organizer/events/create"
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white
                     bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors shadow-sm
                     hover:shadow-md self-start sm:self-auto"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Create New Event
        </Link>
      </div>

      {/* Status Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex gap-1 overflow-x-auto" aria-label="Event status tabs">
          {STATUS_TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            const count = activeTab === 'all' && tab.key !== 'all'
              ? statusCounts[tab.key]
              : tab.key === 'all'
                ? statusCounts.all
                : statusCounts[tab.key];

            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? 'border-primary-600 text-primary-600 dark:text-primary-400 dark:border-primary-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                {tab.label}
                <span
                  className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                    isActive
                      ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-400'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Content */}
      {loading ? (
        <EventsTableSkeleton />
      ) : filteredEvents.length === 0 ? (
        <EmptyState activeTab={activeTab} />
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden lg:block bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                  <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Event
                  </th>
                  <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Capacity
                  </th>
                  <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-right px-6 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredEvents.map((event) => (
                  <tr key={event._id} className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                    {/* Event */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-gray-100 dark:bg-gray-700">
                          {event.image ? (
                            <EventImage src={event.image} alt={event.title} className="h-full w-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <svg className="w-6 h-6 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                  d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                              </svg>
                            </div>
                          )}
                        </div>
                        <span className="font-medium text-gray-900 dark:text-white truncate max-w-[200px]">
                          {event.title}
                        </span>
                      </div>
                    </td>
                    {/* Date */}
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">
                      {format(new Date(event.date), 'MMM dd, yyyy')}
                    </td>
                    {/* Category */}
                    <td className="px-6 py-4">
                      <span className={`inline-block px-2.5 py-1 text-xs font-semibold rounded-full ${getCategoryColor(event.category)}`}>
                        {event.category}
                      </span>
                    </td>
                    {/* Capacity */}
                    <td className="px-6 py-4">
                      <div className="w-32">
                        <CapacityBar
                          current={event.registeredCount || 0}
                          total={event.capacity || 0}
                          size="sm"
                        />
                      </div>
                    </td>
                    {/* Status */}
                    <td className="px-6 py-4">
                      <StatusBadge status={event.status?.toLowerCase()} />
                    </td>
                    {/* Actions */}
                    <td className="px-6 py-4 text-right">
                      <ActionsDropdown
                        event={event}
                        isOpen={openDropdown === event._id}
                        onToggle={() => setOpenDropdown(openDropdown === event._id ? null : event._id)}
                        onAction={handleAction}
                        isLoading={actionLoading === event._id}
                        dropdownRef={openDropdown === event._id ? dropdownRef : null}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="lg:hidden space-y-4">
            {filteredEvents.map((event) => (
              <MobileEventCard
                key={event._id}
                event={event}
                isOpen={openDropdown === event._id}
                onToggle={() => setOpenDropdown(openDropdown === event._id ? null : event._id)}
                onAction={handleAction}
                isLoading={actionLoading === event._id}
                dropdownRef={openDropdown === event._id ? dropdownRef : null}
                getCategoryColor={getCategoryColor}
              />
            ))}
          </div>
        </>
      )}

      {/* Confirmation Modal */}
      {confirmModal && (
        <ConfirmationModal
          type={confirmModal.type}
          event={confirmModal.event}
          isLoading={actionLoading === confirmModal.event._id}
          onConfirm={() => {
            const { type, event } = confirmModal;
            if (type === 'publish') handlePublish(event._id);
            else if (type === 'cancel') handleCancel(event._id);
            else if (type === 'delete') handleDelete(event._id);
          }}
          onClose={() => setConfirmModal(null)}
        />
      )}
    </div>
  );
};

/* ═══════ Actions Dropdown ═══════ */
const ACTION_LABELS = {
  edit: {
    label: 'Edit',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
      </svg>
    ),
    classes: 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700',
  },
  publish: {
    label: 'Publish',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 8.25H7.5a2.25 2.25 0 00-2.25 2.25v9a2.25 2.25 0 002.25 2.25h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25H15m0-3l-3-3m0 0l-3 3m3-3v11.25" />
      </svg>
    ),
    classes: 'text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20',
  },
  attendees: {
    label: 'View Attendees',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
    classes: 'text-primary-700 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20',
  },
  cancel: {
    label: 'Cancel Event',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
      </svg>
    ),
    classes: 'text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20',
  },
  delete: {
    label: 'Delete',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
      </svg>
    ),
    classes: 'text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20',
  },
};

const ActionsDropdown = ({ event, isOpen, onToggle, onAction, isLoading, dropdownRef }) => {
  const actions = ACTIONS_BY_STATUS[event.status?.toLowerCase()] || [];

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <button
        onClick={onToggle}
        disabled={isLoading}
        className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200
                   hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
        aria-label="Event actions"
      >
        {isLoading ? (
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
          </svg>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg
                        border border-gray-200 dark:border-gray-700 py-1 z-50">
          {actions.map((action) => {
            const config = ACTION_LABELS[action];
            return (
              <button
                key={action}
                onClick={() => onAction(action, event)}
                className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium transition-colors ${config.classes}`}
              >
                {config.icon}
                {config.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* ═══════ Mobile Event Card ═══════ */
const MobileEventCard = ({ event, isOpen, onToggle, onAction, isLoading, dropdownRef, getCategoryColor }) => (
  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
    <div className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 bg-gray-100 dark:bg-gray-700">
            {event.image ? (
              <EventImage src={event.image} alt={event.title} className="h-full w-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <svg className="w-7 h-7 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                </svg>
              </div>
            )}
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-gray-900 dark:text-white truncate">{event.title}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {format(new Date(event.date), 'MMM dd, yyyy')}
            </p>
          </div>
        </div>
        <ActionsDropdown
          event={event}
          isOpen={isOpen}
          onToggle={onToggle}
          onAction={onAction}
          isLoading={isLoading}
          dropdownRef={dropdownRef}
        />
      </div>

      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <StatusBadge status={event.status?.toLowerCase()} />
        <span className={`inline-block px-2.5 py-1 text-xs font-semibold rounded-full ${getCategoryColor(event.category)}`}>
          {event.category}
        </span>
      </div>

      <div className="mt-3">
        <CapacityBar current={event.registeredCount || 0} total={event.capacity || 0} size="sm" />
      </div>
    </div>
  </div>
);

/* ═══════ Confirmation Modal ═══════ */
const MODAL_CONFIG = {
  publish: {
    title: 'Publish Event',
    message: 'Are you sure you want to publish this event? It will be visible to the public and open for registrations.',
    confirmText: 'Publish',
    confirmClass: 'bg-green-600 hover:bg-green-700 focus:ring-green-500',
    icon: (
      <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center mx-auto">
        <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 8.25H7.5a2.25 2.25 0 00-2.25 2.25v9a2.25 2.25 0 002.25 2.25h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25H15m0-3l-3-3m0 0l-3 3m3-3v11.25" />
        </svg>
      </div>
    ),
  },
  cancel: {
    title: 'Cancel Event',
    message: 'Are you sure you want to cancel this event? All registered attendees will be notified about the cancellation. This action cannot be undone.',
    confirmText: 'Cancel Event',
    confirmClass: 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500',
    icon: (
      <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center mx-auto">
        <svg className="w-6 h-6 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
      </div>
    ),
  },
  delete: {
    title: 'Delete Event',
    message: 'Are you sure you want to permanently delete this event? This action is irreversible and all associated data will be lost.',
    confirmText: 'Delete Permanently',
    confirmClass: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
    icon: (
      <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center mx-auto">
        <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
        </svg>
      </div>
    ),
  },
};

const ConfirmationModal = ({ type, event, isLoading, onConfirm, onClose }) => {
  const config = MODAL_CONFIG[type];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full p-6 z-10">
        {config.icon}
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white text-center mt-4">
          {config.title}
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center mt-2 leading-relaxed">
          {config.message}
        </p>
        <p className="text-sm font-medium text-gray-900 dark:text-white text-center mt-3 px-4 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          &quot;{event.title}&quot;
        </p>
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300
                       bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600
                       rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`flex-1 px-4 py-2.5 text-sm font-medium text-white rounded-lg
                        transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${config.confirmClass}`}
          >
            {isLoading && (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {config.confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ═══════ Empty State ═══════ */
const EmptyState = ({ activeTab }) => (
  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
    <svg className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
      {activeTab === 'all' ? 'No events yet' : `No ${activeTab} events`}
    </h3>
    <p className="text-gray-500 dark:text-gray-400 mb-6">
      {activeTab === 'all'
        ? 'Create your first event and start managing registrations.'
        : `You don't have any events with "${activeTab}" status.`}
    </p>
    {activeTab === 'all' && (
      <Link
        to="/organizer/events/create"
        className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white
                   bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Create New Event
      </Link>
    )}
  </div>
);

/* ═══════ Table Skeleton ═══════ */
const EventsTableSkeleton = () => (
  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-pulse">
    <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-6 py-3.5">
      <div className="flex gap-6">
        {[160, 80, 80, 100, 80, 60].map((w, i) => (
          <div key={i} className="h-3 bg-gray-200 dark:bg-gray-700 rounded" style={{ width: w }} />
        ))}
      </div>
    </div>
    {[...Array(5)].map((_, i) => (
      <div key={i} className="flex items-center gap-6 px-6 py-4 border-b border-gray-100 dark:border-gray-700/50">
        <div className="flex items-center gap-3 w-[200px]">
          <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-lg shrink-0" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-28" />
        </div>
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20" />
        <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded-full w-16" />
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full w-24" />
        <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded-full w-20" />
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-8 ml-auto" />
      </div>
    ))}
  </div>
);

export default OrganizerEventsPage;
