import { useState, useEffect, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import * as eventService from '../../services/eventService';
import * as registrationService from '../../services/registrationService';
import StatusBadge from '../../components/ui/StatusBadge';
import CapacityBar from '../../components/ui/CapacityBar';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import useDebounce from '../../hooks/useDebounce';
import usePagination from '../../hooks/usePagination';

const STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending Payment' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'attended', label: 'Attended' },
];

const LIMIT = 10;

const EventAttendeesPage = () => {
  const { id: eventId } = useParams();

  const [event, setEvent] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const debouncedSearch = useDebounce(search, 400);

  const { page, nextPage, prevPage, goToPage, hasNextPage, hasPrevPage } =
    usePagination(totalPages);

  const [checkInModal, setCheckInModal] = useState(null);
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [copiedCode, setCopiedCode] = useState(null);

  useDocumentTitle(event ? `Attendees — ${event.title}` : 'Attendees');

  const fetchRegistrations = useCallback(async () => {
    try {
      const params = { page, limit: LIMIT };
      if (debouncedSearch) params.search = debouncedSearch;
      if (statusFilter !== 'all') params.status = statusFilter;

      const response = await eventService.getEventRegistrations(eventId, params);
      const data = response.data || response;
      setRegistrations(data.registrations || []);
      setTotalPages(data.pagination?.pages || data.totalPages || 1);
    } catch {
      toast.error('Failed to load attendees');
    }
  }, [eventId, page, debouncedSearch, statusFilter]);

  const fetchStats = useCallback(async () => {
    try {
      const response = await eventService.getEventStats(eventId);
      const data = response.data || response;
      setStats(data.stats || data);
      if (data.event) setEvent(data.event);
    } catch {
      toast.error('Failed to load event stats');
    }
  }, [eventId]);

  useEffect(() => {
    const loadInitial = async () => {
      setLoading(true);
      await Promise.all([fetchRegistrations(), fetchStats()]);
      setLoading(false);
    };
    loadInitial();
  }, [fetchRegistrations, fetchStats]);

  useEffect(() => {
    if (!loading) fetchRegistrations();
  }, [page, debouncedSearch, statusFilter]);

  useEffect(() => {
    goToPage(1);
  }, [debouncedSearch, statusFilter]);

  const handleCheckIn = async () => {
    if (!checkInModal) return;
    setCheckInLoading(true);
    try {
      await registrationService.checkInAttendee(checkInModal._id);
      toast.success(`${checkInModal.user?.name || 'Attendee'} checked in successfully!`);
      setCheckInModal(null);
      await Promise.all([fetchRegistrations(), fetchStats()]);
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to check in attendee';
      toast.error(message);
    } finally {
      setCheckInLoading(false);
    }
  };

  const handleCopyCode = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      toast.success('Confirmation code copied!');
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      toast.error('Failed to copy code');
    }
  };

  const handleExportCSV = () => {
    if (!registrations.length) {
      toast.error('No attendees to export');
      return;
    }

    const headers = ['Name', 'Email', 'Confirmation Code', 'Status', 'Registered Date'];
    const rows = registrations.map((reg) => [
      reg.user?.name || 'N/A',
      reg.user?.email || 'N/A',
      reg.confirmationCode || 'N/A',
      reg.status || 'N/A',
      reg.createdAt ? format(new Date(reg.createdAt), 'yyyy-MM-dd HH:mm') : 'N/A',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `attendees-${event?.title?.replace(/\s+/g, '-').toLowerCase() || eventId}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exported successfully!');
  };

  if (loading) return <PageSkeleton />;

  const totalRegistrations = stats?.totalRegistrations || 0;
  const pendingCount = stats?.totalPending || stats?.pendingCount || 0;
  const confirmedCount = stats?.confirmedCount || stats?.confirmed || 0;
  const cancelledCount = stats?.cancelledCount || stats?.cancelled || 0;
  const attendedCount = stats?.attendedCount || stats?.attended || 0;
  const capacity = stats?.event?.capacity || event?.capacity || 0;
  const filledSpots = pendingCount + confirmedCount + attendedCount;
  const fillPercentage = capacity > 0 ? Math.round((filledSpots / capacity) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          to="/organizer/events"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 dark:text-gray-400
                     hover:text-primary-600 dark:hover:text-primary-400 transition-colors mb-4"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Back to My Events
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
              {event?.title || 'Event Attendees'}
            </h1>
            <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-gray-500 dark:text-gray-400">
              {event?.date && (
                <span className="inline-flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                  </svg>
                  {format(new Date(event.date), 'EEE, MMM dd, yyyy')}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                </svg>
                {filledSpots} / {capacity} attendees
              </span>
            </div>
          </div>

          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200
                       bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600
                       hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors shadow-sm self-start"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Export CSV
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          label="Total Registrations"
          value={totalRegistrations}
          color="blue"
          icon={
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
          }
        />
        <StatCard
          label="Pending Payment"
          value={pendingCount}
          color="amber"
          icon={
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
          }
        />
        <StatCard
          label="Confirmed"
          value={confirmedCount}
          color="green"
          icon={
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          }
        />
        <StatCard
          label="Cancelled"
          value={cancelledCount}
          color="red"
          icon={
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          }
        />
        <StatCard
          label="Attended"
          value={attendedCount}
          color="indigo"
          icon={
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4.5 12.75l6 6 9-13.5" />
          }
        />
      </div>

      {/* Capacity Visualization */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Event Capacity</h3>
          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
            {filledSpots} of {capacity} spots filled ({fillPercentage}%)
          </span>
        </div>
        <CapacityBar current={filledSpots} total={capacity} size="lg" showLabel={false} />
      </div>

      {/* Search & Filter */}
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
            placeholder="Search by name or email..."
            className="w-full pl-10 pr-4 py-2.5 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800
                       border border-gray-300 dark:border-gray-600 rounded-lg
                       focus:ring-2 focus:ring-primary-500 focus:border-primary-500
                       placeholder:text-gray-400 dark:placeholder:text-gray-500 transition-colors"
          />
        </div>

        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg shrink-0">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.key}
              onClick={() => setStatusFilter(filter.key)}
              className={`px-3 py-2 text-sm font-medium rounded-md transition-all whitespace-nowrap ${
                statusFilter === filter.key
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Attendees Table */}
      {registrations.length === 0 ? (
        <EmptyState statusFilter={statusFilter} search={debouncedSearch} />
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden lg:block bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                  <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-12">
                    #
                  </th>
                  <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Attendee
                  </th>
                  <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Registered At
                  </th>
                  <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Confirmation Code
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
                {registrations.map((reg, index) => (
                  <tr key={reg._id} className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {(page - 1) * LIMIT + index + 1}
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {reg.user?.name || 'Unknown'}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {reg.user?.email || '—'}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">
                      {reg.createdAt
                        ? format(new Date(reg.createdAt), 'MMM dd, yyyy HH:mm')
                        : '—'}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleCopyCode(reg.confirmationCode)}
                        className="group inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 dark:bg-gray-700/50
                                   rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        title="Click to copy"
                      >
                        <span className="font-mono text-sm font-bold text-gray-900 dark:text-white tracking-wider">
                          {reg.confirmationCode}
                        </span>
                        {copiedCode === reg.confirmationCode ? (
                          <svg className="w-3.5 h-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        ) : (
                          <svg className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                          </svg>
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={reg.status} type="registration" />
                    </td>
                    <td className="px-6 py-4 text-right">
                      {reg.status === 'confirmed' && (
                        <button
                          onClick={() => setCheckInModal(reg)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium
                                     text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20
                                     hover:bg-indigo-100 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                          Check In
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="lg:hidden space-y-3">
            {registrations.map((reg, index) => (
              <MobileAttendeeCard
                key={reg._id}
                registration={reg}
                rowNumber={(page - 1) * LIMIT + index + 1}
                onCheckIn={() => setCheckInModal(reg)}
                onCopyCode={handleCopyCode}
                copiedCode={copiedCode}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-5 py-3.5">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Page <span className="font-semibold text-gray-900 dark:text-white">{page}</span> of{' '}
                <span className="font-semibold text-gray-900 dark:text-white">{totalPages}</span>
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={prevPage}
                  disabled={!hasPrevPage}
                  className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200
                             hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors
                             disabled:opacity-40 disabled:cursor-not-allowed"
                >
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
                      <button
                        key={item}
                        onClick={() => goToPage(item)}
                        className={`w-9 h-9 text-sm font-medium rounded-lg transition-colors ${
                          page === item
                            ? 'bg-primary-600 text-white shadow-sm'
                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                      >
                        {item}
                      </button>
                    )
                  )}

                <button
                  onClick={nextPage}
                  disabled={!hasNextPage}
                  className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200
                             hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors
                             disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Check-in Confirmation Modal */}
      {checkInModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !checkInLoading && setCheckInModal(null)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full p-6 z-10">
            <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center mx-auto">
              <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>

            <h3 className="text-lg font-semibold text-gray-900 dark:text-white text-center mt-4">
              Confirm Check-in
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center mt-2 leading-relaxed">
              Mark <span className="font-semibold text-gray-900 dark:text-white">{checkInModal.user?.name || 'this attendee'}</span> as attended?
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-1 font-mono">
              Code: {checkInModal.confirmationCode}
            </p>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setCheckInModal(null)}
                disabled={checkInLoading}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300
                           bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600
                           rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCheckIn}
                disabled={checkInLoading}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white rounded-lg transition-colors
                           disabled:opacity-50 flex items-center justify-center gap-2
                           bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500"
              >
                {checkInLoading && (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                Check In
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ═══════ Stat Card ═══════ */
const STAT_COLORS = {
  amber: {
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-200 dark:border-amber-800',
    iconBg: 'bg-amber-100 dark:bg-amber-900/40',
    iconText: 'text-amber-600 dark:text-amber-400',
    value: 'text-amber-700 dark:text-amber-300',
    label: 'text-amber-600 dark:text-amber-400',
  },
  blue: {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-800',
    iconBg: 'bg-blue-100 dark:bg-blue-900/40',
    iconText: 'text-blue-600 dark:text-blue-400',
    value: 'text-blue-700 dark:text-blue-300',
    label: 'text-blue-600 dark:text-blue-400',
  },
  green: {
    bg: 'bg-green-50 dark:bg-green-900/20',
    border: 'border-green-200 dark:border-green-800',
    iconBg: 'bg-green-100 dark:bg-green-900/40',
    iconText: 'text-green-600 dark:text-green-400',
    value: 'text-green-700 dark:text-green-300',
    label: 'text-green-600 dark:text-green-400',
  },
  red: {
    bg: 'bg-red-50 dark:bg-red-900/20',
    border: 'border-red-200 dark:border-red-800',
    iconBg: 'bg-red-100 dark:bg-red-900/40',
    iconText: 'text-red-600 dark:text-red-400',
    value: 'text-red-700 dark:text-red-300',
    label: 'text-red-600 dark:text-red-400',
  },
  indigo: {
    bg: 'bg-indigo-50 dark:bg-indigo-900/20',
    border: 'border-indigo-200 dark:border-indigo-800',
    iconBg: 'bg-indigo-100 dark:bg-indigo-900/40',
    iconText: 'text-indigo-600 dark:text-indigo-400',
    value: 'text-indigo-700 dark:text-indigo-300',
    label: 'text-indigo-600 dark:text-indigo-400',
  },
};

const StatCard = ({ label, value, color, icon }) => {
  const c = STAT_COLORS[color];
  return (
    <div className={`flex items-center gap-3 ${c.bg} border ${c.border} rounded-xl px-5 py-4`}>
      <div className={`w-10 h-10 rounded-lg ${c.iconBg} flex items-center justify-center shrink-0`}>
        <svg className={`w-5 h-5 ${c.iconText}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          {icon}
        </svg>
      </div>
      <div>
        <p className={`text-2xl font-bold ${c.value}`}>{value}</p>
        <p className={`text-xs font-medium ${c.label}`}>{label}</p>
      </div>
    </div>
  );
};

/* ═══════ Mobile Attendee Card ═══════ */
const MobileAttendeeCard = ({ registration, rowNumber, onCheckIn, onCopyCode, copiedCode }) => (
  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 w-6 text-center shrink-0">
          {rowNumber}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
            {registration.user?.name || 'Unknown'}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {registration.user?.email || '—'}
          </p>
        </div>
      </div>
      <StatusBadge status={registration.status} type="registration" />
    </div>

    <div className="mt-3 flex items-center justify-between gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={() => onCopyCode(registration.confirmationCode)}
          className="inline-flex items-center gap-1 px-2 py-1 bg-gray-50 dark:bg-gray-700/50 rounded-md
                     hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="Click to copy"
        >
          <span className="font-mono text-xs font-bold text-gray-900 dark:text-white tracking-wider">
            {registration.confirmationCode}
          </span>
          {copiedCode === registration.confirmationCode ? (
            <svg className="w-3 h-3 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          ) : (
            <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
            </svg>
          )}
        </button>
        <span className="text-xs text-gray-400 dark:text-gray-500">
          {registration.createdAt && format(new Date(registration.createdAt), 'MMM dd, HH:mm')}
        </span>
      </div>

      {registration.status === 'confirmed' && (
        <button
          onClick={onCheckIn}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium
                     text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20
                     hover:bg-indigo-100 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.5 12.75l6 6 9-13.5" />
          </svg>
          Check In
        </button>
      )}
    </div>
  </div>
);

/* ═══════ Empty State ═══════ */
const EmptyState = ({ statusFilter, search }) => (
  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
      <svg className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    </div>
    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
      {search ? 'No results found' : 'No attendees yet'}
    </h3>
    <p className="text-gray-500 dark:text-gray-400">
      {search
        ? `No attendees matching "${search}"${statusFilter !== 'all' ? ` with status "${statusFilter}"` : ''}.`
        : statusFilter !== 'all'
          ? `No attendees with "${statusFilter}" status.`
          : 'No one has registered for this event yet.'}
    </p>
  </div>
);

/* ═══════ Page Skeleton ═══════ */
const PageSkeleton = () => (
  <div className="space-y-6 animate-pulse">
    <div>
      <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-4" />
      <div className="h-8 w-64 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
      <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded" />
    </div>

    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded-xl" />
      ))}
    </div>

    <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded-xl" />

    <div className="flex gap-3">
      <div className="flex-1 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg" />
      <div className="w-80 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg" />
    </div>

    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-6 py-3.5">
        <div className="flex gap-8">
          {[30, 120, 100, 120, 80, 80].map((w, i) => (
            <div key={i} className="h-3 bg-gray-200 dark:bg-gray-700 rounded" style={{ width: w }} />
          ))}
        </div>
      </div>
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-8 px-6 py-4 border-b border-gray-100 dark:border-gray-700/50">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-6" />
          <div className="space-y-1.5 w-32">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24" />
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-32" />
          </div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-28" />
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-20" />
          <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded-full w-20" />
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-20 ml-auto" />
        </div>
      ))}
    </div>
  </div>
);

export default EventAttendeesPage;
