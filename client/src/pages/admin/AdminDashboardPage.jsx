import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { formatDistanceToNow } from 'date-fns';
import * as adminService from '../../services/adminService';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { formatCurrency } from '../../utils/formatters';

const STAT_CARDS = [
  {
    key: 'totalUsers',
    label: 'Total Users',
    breakdownKeys: ['attendees', 'organizers', 'admins'],
    breakdownLabels: ['Attendees', 'Organizers', 'Admins'],
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
    colorClasses: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  },
  {
    key: 'totalEvents',
    label: 'Total Events',
    breakdownKeys: ['draft', 'published', 'cancelled', 'completed'],
    breakdownLabels: ['Draft', 'Published', 'Cancelled', 'Completed'],
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      </svg>
    ),
    colorClasses: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
  },
  {
    key: 'totalRegistrations',
    label: 'Total Registrations',
    breakdownKeys: ['confirmed', 'cancelledReg', 'attended'],
    breakdownLabels: ['Confirmed', 'Cancelled', 'Attended'],
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" />
      </svg>
    ),
    colorClasses: 'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
  },
  {
    key: 'newUsersThisMonth',
    label: 'New Users This Month',
    comparisonKey: 'newUsersLastMonth',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
      </svg>
    ),
    colorClasses: 'bg-cyan-50 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400',
  },
  {
    key: 'newEventsThisMonth',
    label: 'New Events This Month',
    comparisonKey: 'newEventsLastMonth',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    colorClasses: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
  },
  {
    key: 'revenueEstimate',
    label: 'Revenue Estimate',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    colorClasses: 'bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400',
    format: (val) => formatCurrency(val ?? 0),
  },
];

const ACTIVITY_ICONS = {
  user: (
    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
      <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
      </svg>
    </div>
  ),
  event: (
    <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
      <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      </svg>
    </div>
  ),
  registration: (
    <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
      <svg className="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" />
      </svg>
    </div>
  ),
};

const AdminDashboardPage = () => {
  useDocumentTitle('Admin Dashboard');

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const response = await adminService.getDashboard();
        const raw = response.data || response;

        const stats = {
          totalUsers: raw.users?.total || 0,
          attendees: raw.users?.byRole?.attendee || 0,
          organizers: raw.users?.byRole?.organizer || 0,
          admins: raw.users?.byRole?.admin || 0,
          totalEvents: raw.events?.total || 0,
          draft: raw.events?.byStatus?.draft || 0,
          published: raw.events?.byStatus?.published || 0,
          cancelled: raw.events?.byStatus?.cancelled || 0,
          completed: raw.events?.byStatus?.completed || 0,
          totalRegistrations: raw.registrations?.total || 0,
          confirmed: raw.registrations?.byStatus?.confirmed || 0,
          cancelledReg: raw.registrations?.byStatus?.cancelled || 0,
          attended: raw.registrations?.byStatus?.attended || 0,
          newUsersThisMonth: raw.users?.newThisMonth || 0,
          newEventsThisMonth: raw.events?.newThisMonth || 0,
          revenueEstimate: (raw.topEvents || []).reduce(
            (sum, e) => sum + ((e.price || 0) * (e.registeredCount || 0)),
            0
          ),
        };

        setData({
          stats,
          topEvents: raw.topEvents || [],
          recentActivity: raw.recentActivity || [],
        });
      } catch {
        // Dashboard should render with defaults
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, []);

  if (loading) return <DashboardSkeleton />;

  const stats = data?.stats || {};
  const topEvents = data?.topEvents || [];
  const recentActivity = data?.recentActivity || [];

  const getComparisonIndicator = (current, previous) => {
    if (previous === undefined || previous === null) return null;
    if (current > previous) return { direction: 'up', color: 'text-green-600 dark:text-green-400' };
    if (current < previous) return { direction: 'down', color: 'text-red-600 dark:text-red-400' };
    return { direction: 'same', color: 'text-gray-500 dark:text-gray-400' };
  };

  return (
    <div className="space-y-8">
      {/* ═══════ Header ═══════ */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
          Admin Dashboard
        </h1>
        <p className="mt-1 text-gray-500 dark:text-gray-400">
          {format(new Date(), 'EEEE, MMMM dd, yyyy')} — System overview
        </p>
      </div>

      {/* ═══════ Stats Cards (2 rows x 3) ═══════ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {STAT_CARDS.map((card) => {
          const value = card.format
            ? card.format(stats[card.key])
            : (stats[card.key] ?? 0);

          const comparison = card.comparisonKey
            ? getComparisonIndicator(stats[card.key] ?? 0, stats[card.comparisonKey])
            : null;

          return (
            <div
              key={card.key}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700
                         p-5 transition-shadow hover:shadow-md"
            >
              <div className="flex items-center gap-4">
                <div className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${card.colorClasses}`}>
                  {card.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-2xl font-bold text-gray-900 dark:text-white truncate">
                      {value}
                    </p>
                    {comparison && (
                      <span className={`inline-flex items-center text-xs font-medium ${comparison.color}`}>
                        {comparison.direction === 'up' && '↑'}
                        {comparison.direction === 'down' && '↓'}
                        {comparison.direction === 'same' && '→'}
                        <span className="ml-0.5">
                          {stats[card.comparisonKey] ?? 0} last mo.
                        </span>
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{card.label}</p>
                </div>
              </div>

              {/* Breakdown */}
              {card.breakdownKeys && (
                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex flex-wrap gap-x-4 gap-y-1">
                  {card.breakdownKeys.map((bKey, i) => (
                    <span key={bKey} className="text-xs text-gray-500 dark:text-gray-400">
                      {card.breakdownLabels[i]}:{' '}
                      <span className="font-semibold text-gray-700 dark:text-gray-300">
                        {stats[bKey] ?? 0}
                      </span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ═══════ Main Content Grid ═══════ */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Top Events — ~60% */}
        <div className="lg:col-span-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Top Events</h2>
            <span className="text-xs text-gray-400 dark:text-gray-500">By registrations</span>
          </div>

          {topEvents.length === 0 || topEvents.every((e) => (e.registrations || e.registeredCount || 0) === 0) ? (
            <div className="p-8 text-center">
              <svg className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
              <p className="text-gray-500 dark:text-gray-400">No registrations recorded yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Event
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Organizer
                    </th>
                    <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Regs
                    </th>
                    <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Cap
                    </th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Fill %
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {topEvents.slice(0, 5).map((event) => {
                    const fillPct = event.capacity > 0
                      ? Math.round(((event.registrations || event.registeredCount || 0) / event.capacity) * 100)
                      : 0;
                    const fillColor = fillPct >= 90
                      ? 'text-red-600 dark:text-red-400'
                      : fillPct >= 70
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-green-600 dark:text-green-400';

                    return (
                      <tr key={event._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <td className="px-5 py-3.5">
                          <span className="text-sm font-medium text-gray-900 dark:text-white truncate block max-w-[200px]">
                            {event.title}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">
                          {event.organizer?.name || event.organizerName || '—'}
                        </td>
                        <td className="px-5 py-3.5 text-sm font-semibold text-gray-900 dark:text-white text-center">
                          {event.registrations || event.registeredCount || 0}
                        </td>
                        <td className="px-5 py-3.5 text-sm text-gray-600 dark:text-gray-300 text-center">
                          {event.capacity || 0}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <span className={`text-sm font-bold ${fillColor}`}>
                            {fillPct}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Activity — ~40% */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Activity</h2>
            <span className="text-xs text-gray-400 dark:text-gray-500">Latest actions</span>
          </div>

          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {recentActivity.length === 0 ? (
              <div className="p-8 text-center">
                <svg className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-gray-500 dark:text-gray-400">No recent activity.</p>
              </div>
            ) : (
              recentActivity.slice(0, 10).map((item, index) => (
                <div key={item._id || index} className="flex items-start gap-3 p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  {ACTIVITY_ICONS[item.type] || ACTIVITY_ICONS.user}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-900 dark:text-white leading-snug">
                      {item.description || item.message}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      {item.createdAt
                        ? formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })
                        : '—'}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ═══════ Dashboard Skeleton ═══════ */
const DashboardSkeleton = () => (
  <div className="space-y-8 animate-pulse">
    <div>
      <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded-lg w-64" />
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-48 mt-2" />
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-xl" />
            <div className="flex-1 space-y-2">
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-16" />
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-28" />
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex gap-4">
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-20" />
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-20" />
          </div>
        </div>
      ))}
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      <div className="lg:col-span-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
        <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-32" />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex justify-between items-center">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-40" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-12" />
          </div>
        ))}
      </div>
      <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
        <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-36" />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full" />
            <div className="flex-1 space-y-1">
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full" />
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default AdminDashboardPage;
