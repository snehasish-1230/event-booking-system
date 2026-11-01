import { useState, useEffect, useCallback, useRef } from 'react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import * as adminService from '../../services/adminService';
import StatusBadge from '../../components/ui/StatusBadge';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import useDebounce from '../../hooks/useDebounce';
import usePagination from '../../hooks/usePagination';

const STATUS_OPTIONS = [
  { key: 'all', label: 'All Status' },
  { key: 'draft', label: 'Draft' },
  { key: 'published', label: 'Published' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'completed', label: 'Completed' },
];

const CATEGORY_OPTIONS = [
  { key: 'all', label: 'All Categories' },
  { key: 'conference', label: 'Conference' },
  { key: 'workshop', label: 'Workshop' },
  { key: 'seminar', label: 'Seminar' },
  { key: 'meetup', label: 'Meetup' },
  { key: 'concert', label: 'Concert' },
  { key: 'sports', label: 'Sports' },
  { key: 'networking', label: 'Networking' },
  { key: 'webinar', label: 'Webinar' },
];

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

const STATUS_TRANSITIONS = {
  draft: ['published', 'cancelled'],
  published: ['cancelled', 'completed'],
  cancelled: [],
  completed: [],
};

const getValidTransitions = (currentStatus) => {
  const transitions = STATUS_TRANSITIONS[currentStatus] || [];
  return transitions.length > 0 ? [currentStatus, ...transitions] : [currentStatus];
};

const LIMIT = 10;

const AdminEventsPage = () => {
  const navigate = useNavigate();
  useDocumentTitle('Manage Events');

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const debouncedSearch = useDebounce(search, 400);

  const { page, nextPage, prevPage, goToPage, hasNextPage, hasPrevPage } =
    usePagination(totalPages);

  const [actionLoading, setActionLoading] = useState(null);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [statusModal, setStatusModal] = useState(null);
  const [deleteModal, setDeleteModal] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState('');
  const dropdownRef = useRef(null);

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page, limit: LIMIT };
      if (debouncedSearch) params.search = debouncedSearch;
      if (statusFilter !== 'all') params.status = statusFilter;
      if (categoryFilter !== 'all') params.category = categoryFilter;

      const response = await adminService.getEvents(params);
      const data = response.data || response;
      setEvents(data.events || (Array.isArray(data) ? data : []));
      setTotalPages(data.pagination?.pages || data.totalPages || 1);
    } catch {
      toast.error('Failed to load events');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, statusFilter, categoryFilter]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  useEffect(() => {
    goToPage(1);
  }, [debouncedSearch, statusFilter, categoryFilter]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleChangeStatus = async () => {
    if (!statusModal || !selectedStatus) return;
    setActionLoading(statusModal._id);
    try {
      await adminService.updateEventStatus(statusModal._id, { status: selectedStatus });
      toast.success(`Event status updated to ${selectedStatus}`);
      setStatusModal(null);
      setSelectedStatus('');
      await fetchEvents();
    } catch {
      toast.error('Failed to update event status');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteEvent = async () => {
    if (!deleteModal) return;
    setActionLoading(deleteModal._id);
    try {
      await adminService.deleteEvent(deleteModal._id);
      toast.success('Event deleted successfully');
      setDeleteModal(null);
      await fetchEvents();
    } catch {
      toast.error('Failed to delete event');
    } finally {
      setActionLoading(null);
    }
  };

  const openStatusModal = (event) => {
    setOpenDropdown(null);
    setSelectedStatus(event.status?.toLowerCase() || 'draft');
    setStatusModal(event);
  };

  const openDeleteConfirm = (event) => {
    setOpenDropdown(null);
    setDeleteModal(event);
  };

  const getCategoryColor = (category) => {
    const key = category?.toLowerCase();
    return CATEGORY_COLORS[key] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
  };

  return (
    <div className="space-y-6">
      {/* ═══════ Header ═══════ */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Manage Events</h1>
        <p className="mt-1 text-gray-500 dark:text-gray-400">View and moderate all platform events</p>
      </div>

      {/* ═══════ Search & Filters ═══════ */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500 pointer-events-none"
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by event title..."
            className="w-full pl-10 pr-4 py-2.5 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800
                       border border-gray-300 dark:border-gray-600 rounded-lg
                       focus:ring-2 focus:ring-primary-500 focus:border-primary-500
                       placeholder:text-gray-400 dark:placeholder:text-gray-500 transition-colors"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800
                     border border-gray-300 dark:border-gray-600 rounded-lg
                     focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.key} value={opt.key}>{opt.label}</option>
          ))}
        </select>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800
                     border border-gray-300 dark:border-gray-600 rounded-lg
                     focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
        >
          {CATEGORY_OPTIONS.map((opt) => (
            <option key={opt.key} value={opt.key}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* ═══════ Content ═══════ */}
      {loading ? (
        <TableSkeleton />
      ) : events.length === 0 ? (
        <EmptyState search={debouncedSearch} />
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden lg:block bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-visible">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                  <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Event
                  </th>
                  <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Organizer
                  </th>
                  <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="text-center px-6 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
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
                {events.map((event) => (
                  <tr key={event._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-4">
                      <span
                        className="text-sm font-medium text-gray-900 dark:text-white truncate block max-w-[220px]"
                        title={event.title}
                      >
                        {event.title}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">
                      {event.organizer?.name || event.organizerName || '—'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">
                      {event.date ? format(new Date(event.date), 'MMM dd, yyyy') : '—'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-block px-2.5 py-1 text-xs font-semibold rounded-full ${getCategoryColor(event.category)}`}>
                        {event.category || '—'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300 text-center">
                      {event.registeredCount ?? 0} / {event.capacity ?? 0}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={event.status?.toLowerCase()} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <EventActionsDropdown
                        event={event}
                        isOpen={openDropdown === event._id}
                        onToggle={() => setOpenDropdown(openDropdown === event._id ? null : event._id)}
                        onChangeStatus={() => openStatusModal(event)}
                        onRoomManagement={() => navigate(`/admin/events/${event._id}/room`)}
                        onDelete={() => openDeleteConfirm(event)}
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
          <div className="lg:hidden space-y-3">
            {events.map((event) => (
              <MobileEventCard
                key={event._id}
                event={event}
                isOpen={openDropdown === event._id}
                onToggle={() => setOpenDropdown(openDropdown === event._id ? null : event._id)}
                onChangeStatus={() => openStatusModal(event)}
                onRoomManagement={() => navigate(`/admin/events/${event._id}/room`)}
                onDelete={() => openDeleteConfirm(event)}
                isLoading={actionLoading === event._id}
                dropdownRef={openDropdown === event._id ? dropdownRef : null}
                getCategoryColor={getCategoryColor}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <PaginationBar page={page} totalPages={totalPages} prevPage={prevPage} nextPage={nextPage}
              goToPage={goToPage} hasPrevPage={hasPrevPage} hasNextPage={hasNextPage} />
          )}
        </>
      )}

      {/* ═══════ Change Status Modal ═══════ */}
      {statusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !actionLoading && setStatusModal(null)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full p-6 z-10">
            <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center mx-auto">
              <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white text-center mt-4">Change Event Status</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center mt-2">
              Update status for <span className="font-semibold text-gray-900 dark:text-white">&quot;{statusModal.title}&quot;</span>
            </p>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full mt-4 px-4 py-2.5 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700
                         border border-gray-300 dark:border-gray-600 rounded-lg
                         focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              {getValidTransitions(statusModal.status?.toLowerCase()).map((s) => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setStatusModal(null)}
                disabled={actionLoading === statusModal._id}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300
                           bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600
                           rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleChangeStatus}
                disabled={actionLoading === statusModal._id || selectedStatus === statusModal.status?.toLowerCase()}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white rounded-lg transition-colors
                           disabled:opacity-50 flex items-center justify-center gap-2
                           bg-primary-600 hover:bg-primary-700"
              >
                {actionLoading === statusModal._id && <LoadingSpinner />}
                Update Status
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ Delete Event Modal ═══════ */}
      {deleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !actionLoading && setDeleteModal(null)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full p-6 z-10">
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center mx-auto">
              <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white text-center mt-4">Delete Event</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center mt-2 leading-relaxed">
              Are you sure you want to permanently delete this event?
              All registrations and data will be lost.
            </p>
            <p className="text-sm font-medium text-gray-900 dark:text-white text-center mt-3 px-4 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              &quot;{deleteModal.title}&quot;
            </p>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setDeleteModal(null)}
                disabled={actionLoading === deleteModal._id}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300
                           bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600
                           rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteEvent}
                disabled={actionLoading === deleteModal._id}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white rounded-lg transition-colors
                           disabled:opacity-50 flex items-center justify-center gap-2
                           bg-red-600 hover:bg-red-700"
              >
                {actionLoading === deleteModal._id && <LoadingSpinner />}
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ═══════ Event Actions Dropdown ═══════ */
const EventActionsDropdown = ({ event, isOpen, onToggle, onChangeStatus, onRoomManagement, onDelete, isLoading, dropdownRef }) => (
  <div className="relative inline-block" ref={dropdownRef}>
    <button
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      disabled={isLoading}
      className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200
                 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
      aria-label="Event actions"
    >
      {isLoading ? <LoadingSpinner /> : (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
        </svg>
      )}
    </button>

    {isOpen && (
      <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg
                      border border-gray-200 dark:border-gray-700 py-1 z-50">
        {event.teamMode && (
          <button
            onClick={onRoomManagement}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium
                       text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            Manage Free Fire Room
          </button>
        )}
        <button
          onClick={onChangeStatus}
          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium
                     text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
          </svg>
          Change Status
        </button>
        <button
          onClick={onDelete}
          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium
                     text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
          </svg>
          Delete Event
        </button>
      </div>
    )}
  </div>
);

/* ═══════ Mobile Event Card ═══════ */
const MobileEventCard = ({ event, isOpen, onToggle, onChangeStatus, onRoomManagement, onDelete, isLoading, dropdownRef, getCategoryColor }) => (
  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate" title={event.title}>{event.title}</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          {event.organizer?.name || event.organizerName || '—'} · {event.date ? format(new Date(event.date), 'MMM dd, yyyy') : '—'}
        </p>
      </div>
      <EventActionsDropdown
        event={event} isOpen={isOpen} onToggle={onToggle}
        onChangeStatus={onChangeStatus} onRoomManagement={onRoomManagement} onDelete={onDelete}
        isLoading={isLoading} dropdownRef={dropdownRef}
      />
    </div>
    <div className="mt-3 flex items-center gap-2 flex-wrap">
      <StatusBadge status={event.status?.toLowerCase()} />
      <span className={`inline-block px-2.5 py-1 text-xs font-semibold rounded-full ${getCategoryColor(event.category)}`}>
        {event.category || '—'}
      </span>
      <span className="text-xs text-gray-500 dark:text-gray-400">
        {event.registeredCount ?? 0} / {event.capacity ?? 0}
      </span>
    </div>
  </div>
);

/* ═══════ Pagination ═══════ */
const PaginationBar = ({ page, totalPages, prevPage, nextPage, goToPage, hasPrevPage, hasNextPage }) => (
  <div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-5 py-3.5">
    <p className="text-sm text-gray-500 dark:text-gray-400">
      Page <span className="font-semibold text-gray-900 dark:text-white">{page}</span> of{' '}
      <span className="font-semibold text-gray-900 dark:text-white">{totalPages}</span>
    </p>
    <div className="flex items-center gap-2">
      <button onClick={prevPage} disabled={!hasPrevPage}
        className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200
                   hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors
                   disabled:opacity-40 disabled:cursor-not-allowed">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
      </button>

      {Array.from({ length: totalPages }, (_, i) => i + 1)
        .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
        .reduce((acc, p, i, arr) => {
          if (i > 0 && p - arr[i - 1] > 1) acc.push('...');
          acc.push(p);
          return acc;
        }, [])
        .map((item, i) =>
          item === '...' ? (
            <span key={`dots-${i}`} className="px-1 text-gray-400 dark:text-gray-500">...</span>
          ) : (
            <button key={item} onClick={() => goToPage(item)}
              className={`w-9 h-9 text-sm font-medium rounded-lg transition-colors ${
                page === item
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}>
              {item}
            </button>
          )
        )}

      <button onClick={nextPage} disabled={!hasNextPage}
        className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200
                   hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors
                   disabled:opacity-40 disabled:cursor-not-allowed">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </button>
    </div>
  </div>
);

/* ═══════ Loading Spinner ═══════ */
const LoadingSpinner = () => (
  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

/* ═══════ Empty State ═══════ */
const EmptyState = ({ search }) => (
  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
      <svg className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      </svg>
    </div>
    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
      {search ? 'No results found' : 'No events yet'}
    </h3>
    <p className="text-gray-500 dark:text-gray-400">
      {search ? `No events matching "${search}".` : 'No events have been created on the platform yet.'}
    </p>
  </div>
);

/* ═══════ Table Skeleton ═══════ */
const TableSkeleton = () => (
  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-pulse">
    <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-6 py-3.5">
      <div className="flex gap-6">
        {[180, 100, 100, 80, 60, 80, 40].map((w, i) => (
          <div key={i} className="h-3 bg-gray-200 dark:bg-gray-700 rounded" style={{ width: w }} />
        ))}
      </div>
    </div>
    {[...Array(5)].map((_, i) => (
      <div key={i} className="flex items-center gap-6 px-6 py-4 border-b border-gray-100 dark:border-gray-700/50">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-44" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24" />
        <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded-full w-20" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16" />
        <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded-full w-20" />
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-8 ml-auto" />
      </div>
    ))}
  </div>
);

export default AdminEventsPage;
