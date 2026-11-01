import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import * as adminService from '../../services/adminService';
import StatusBadge from '../../components/ui/StatusBadge';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import useDebounce from '../../hooks/useDebounce';
import usePagination from '../../hooks/usePagination';

const STATUS_OPTIONS = [
  { key: 'all', label: 'All Status' },
  { key: 'pending', label: 'Pending Payment' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'attended', label: 'Attended' },
];

const LIMIT = 10;

const AdminRegistrationsPage = () => {
  useDocumentTitle('Manage Registrations');

  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const debouncedSearch = useDebounce(search, 400);

  const { page, nextPage, prevPage, goToPage, hasNextPage, hasPrevPage } =
    usePagination(totalPages);

  const fetchRegistrations = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page, limit: LIMIT };
      if (debouncedSearch) params.search = debouncedSearch;
      if (statusFilter !== 'all') params.status = statusFilter;

      const response = await adminService.getRegistrations(params);
      const data = response.data || response;
      setRegistrations(data.registrations || (Array.isArray(data) ? data : []));
      setTotalPages(data.pagination?.pages || data.totalPages || 1);
    } catch {
      toast.error('Failed to load registrations');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, statusFilter]);

  useEffect(() => {
    fetchRegistrations();
  }, [fetchRegistrations]);

  useEffect(() => {
    goToPage(1);
  }, [debouncedSearch, statusFilter]);

  return (
    <div className="space-y-6">
      {/* ═══════ Header ═══════ */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Manage Registrations</h1>
        <p className="mt-1 text-gray-500 dark:text-gray-400">
          Monitor all event registrations across the platform (read-only)
        </p>
      </div>

      {/* ═══════ Search & Filter ═══════ */}
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
            placeholder="Search by confirmation code, user name, or event title..."
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
      </div>

      {/* ═══════ Content ═══════ */}
      {loading ? (
        <TableSkeleton />
      ) : registrations.length === 0 ? (
        <EmptyState search={debouncedSearch} />
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden lg:block bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                  <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Confirmation Code
                  </th>
                  <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Attendee
                  </th>
                  <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Event
                  </th>
                  <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {registrations.map((reg) => (
                  <tr key={reg._id} className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-1 bg-gray-50 dark:bg-gray-700/50 rounded-md">
                        <span className="font-mono text-sm font-bold text-gray-900 dark:text-white tracking-wider">
                          {reg.confirmationCode || '—'}
                        </span>
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {reg.user?.name || reg.attendeeName || 'Unknown'}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {reg.user?.email || reg.attendeeEmail || '—'}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-900 dark:text-white truncate block max-w-[200px]">
                        {reg.event?.title || reg.eventTitle || '—'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">
                      {reg.createdAt ? format(new Date(reg.createdAt), 'MMM dd, yyyy HH:mm') : '—'}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={reg.status} type="registration" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="lg:hidden space-y-3">
            {registrations.map((reg) => (
              <MobileRegistrationCard key={reg._id} registration={reg} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <PaginationBar page={page} totalPages={totalPages} prevPage={prevPage} nextPage={nextPage}
              goToPage={goToPage} hasPrevPage={hasPrevPage} hasNextPage={hasNextPage} />
          )}
        </>
      )}
    </div>
  );
};

/* ═══════ Mobile Registration Card ═══════ */
const MobileRegistrationCard = ({ registration }) => (
  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
          {registration.user?.name || registration.attendeeName || 'Unknown'}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
          {registration.event?.title || registration.eventTitle || '—'}
        </p>
      </div>
      <StatusBadge status={registration.status} type="registration" />
    </div>
    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
      <span className="inline-flex items-center px-2 py-1 bg-gray-50 dark:bg-gray-700/50 rounded-md">
        <span className="font-mono text-xs font-bold text-gray-900 dark:text-white tracking-wider">
          {registration.confirmationCode || '—'}
        </span>
      </span>
      <span className="text-xs text-gray-400 dark:text-gray-500">
        {registration.createdAt && format(new Date(registration.createdAt), 'MMM dd, HH:mm')}
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

/* ═══════ Empty State ═══════ */
const EmptyState = ({ search }) => (
  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
      <svg className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" />
      </svg>
    </div>
    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
      {search ? 'No results found' : 'No registrations yet'}
    </h3>
    <p className="text-gray-500 dark:text-gray-400">
      {search
        ? `No registrations matching "${search}".`
        : 'No event registrations have been made on the platform yet.'}
    </p>
  </div>
);

/* ═══════ Table Skeleton ═══════ */
const TableSkeleton = () => (
  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-pulse">
    <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-6 py-3.5">
      <div className="flex gap-6">
        {[120, 140, 160, 100, 80].map((w, i) => (
          <div key={i} className="h-3 bg-gray-200 dark:bg-gray-700 rounded" style={{ width: w }} />
        ))}
      </div>
    </div>
    {[...Array(5)].map((_, i) => (
      <div key={i} className="flex items-center gap-6 px-6 py-4 border-b border-gray-100 dark:border-gray-700/50">
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-24" />
        <div className="space-y-1.5 w-32">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24" />
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-32" />
        </div>
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-40" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-28" />
        <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded-full w-20" />
      </div>
    ))}
  </div>
);

export default AdminRegistrationsPage;
