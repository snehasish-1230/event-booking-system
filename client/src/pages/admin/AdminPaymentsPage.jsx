import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import {
  getAllPaymentsAdmin,
  getAllTestPaymentsAdmin,
  reviewPaymentAdmin,
  reviewTestPaymentAdmin,
} from '../../services/paymentService';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import useDebounce from '../../hooks/useDebounce';
import usePagination from '../../hooks/usePagination';
import { formatCurrency } from '../../utils/formatters';
import { resolveImageUrl } from '../../utils/imageUrl';

const STATUS_TABS = [
  { key: 'all', label: 'All Submissions' },
  { key: 'PENDING', label: 'Pending Verification' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'REJECTED', label: 'Rejected' },
];

const LIMIT = 10;
const ADMIN_STATUS_TABS = import.meta.env.DEV
  ? [...STATUS_TABS, { key: 'TEST_ONLY', label: 'Development Test Payments' }]
  : STATUS_TABS;

const AdminPaymentsPage = () => {
  useDocumentTitle('Payment Verification — Admin');

  // State
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 });

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const debouncedSearch = useDebounce(search, 400);

  // Review modal state
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [reviewAction, setReviewAction] = useState(null); // 'APPROVE' | 'REJECT'
  const [rejectionReason, setRejectionReason] = useState('');
  const [reviewLoading, setReviewLoading] = useState(false);

  // Screenshot preview modal
  const [previewImage, setPreviewImage] = useState(null);

  const { page, nextPage, prevPage, goToPage, hasNextPage, hasPrevPage } =
    usePagination(totalPages);

  const fetchPayments = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page, limit: LIMIT };
      const isTestOnlyView = statusFilter === 'TEST_ONLY' && import.meta.env.DEV;
      if (!isTestOnlyView && debouncedSearch) params.search = debouncedSearch;
      if (!isTestOnlyView && statusFilter !== 'all') params.status = statusFilter;
      const response = isTestOnlyView
        ? await getAllTestPaymentsAdmin({ page, limit: LIMIT })
        : await getAllPaymentsAdmin(params);
      const data = response.data || response;
      setPayments(data.payments || []);
      setTotalPages(data.pagination?.pages || 1);
      if (data.stats) {
        setStats(data.stats);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to load payments.');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, statusFilter]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  useEffect(() => {
    goToPage(1);
  }, [debouncedSearch, statusFilter]);

  // Handle Review Submission
  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!selectedPayment || !reviewAction) return;

    if (reviewAction === 'REJECT' && !rejectionReason.trim()) {
      toast.error('Please enter a rejection reason.');
      return;
    }

    setReviewLoading(true);
    try {
      const reviewRequest = selectedPayment.testOnly ? reviewTestPaymentAdmin : reviewPaymentAdmin;
      await reviewRequest(selectedPayment._id, {
        action: reviewAction,
        rejectionReason: rejectionReason.trim(),
      });
      toast.success(
        `Payment successfully ${reviewAction === 'APPROVE' ? 'approved' : 'rejected'}.`
      );
      setSelectedPayment(null);
      setReviewAction(null);
      setRejectionReason('');
      await fetchPayments();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to update payment status.';
      toast.error(msg);
    } finally {
      setReviewLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Approved
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            Rejected
          </span>
        );
      case 'PENDING':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            Pending Review
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
          Payment Verification
        </h1>
        <p className="mt-1 text-gray-500 dark:text-gray-400 text-sm">
          Review genuine manual UPI submissions. Development test records are kept separate and never confirm a ticket.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm">
          <p className="text-xs uppercase font-semibold text-gray-500 dark:text-gray-400">Total Submissions</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stats.total}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-amber-200 dark:border-amber-900/40 shadow-sm">
          <p className="text-xs uppercase font-semibold text-amber-600 dark:text-amber-400">Pending Review</p>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{stats.pending}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-emerald-200 dark:border-emerald-900/40 shadow-sm">
          <p className="text-xs uppercase font-semibold text-emerald-600 dark:text-emerald-400">Approved</p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{stats.approved}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-rose-200 dark:border-rose-900/40 shadow-sm">
          <p className="text-xs uppercase font-semibold text-rose-600 dark:text-rose-400">Rejected</p>
          <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">{stats.rejected}</p>
        </div>
      </div>

      {/* Filters & Search */}
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
            placeholder="Search by Transaction ID / UTR..."
            className="w-full pl-10 pr-4 py-2.5 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
        >
          {ADMIN_STATUS_TABS.map((tab) => (
            <option key={tab.key} value={tab.key}>
              {tab.label}
            </option>
          ))}
        </select>
      </div>

      {/* Payments Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th scope="col" className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Attendee / Booking
                </th>
                <th scope="col" className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Event & Amount
                </th>
                <th scope="col" className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Transaction ID / UTR
                </th>
                <th scope="col" className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Screenshot
                </th>
                <th scope="col" className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" className="px-6 py-3.5 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={6} className="px-6 py-4">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
                    </td>
                  </tr>
                ))
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400 text-sm">
                    No payment submissions found matching your filters.
                  </td>
                </tr>
              ) : (
                payments.map((p) => {
                  const screenshotSrc = resolveImageUrl(p.paymentScreenshot);

                  return (
                    <tr key={p._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      {/* Attendee / Booking */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {p.user?.name || 'Unknown User'}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {p.user?.email || 'N/A'}
                        </div>
                        <div className="text-xs font-mono text-purple-600 dark:text-purple-400 mt-0.5">
                          Code: {p.booking?.confirmationCode || p.booking?._id || 'N/A'}
                        </div>
                        {p.testOnly && (
                          <span className="mt-1 inline-flex rounded bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase text-violet-800 dark:bg-violet-900/40 dark:text-violet-300">
                            TEST ONLY — no ticket effect
                          </span>
                        )}
                      </td>

                      {/* Event & Amount */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-gray-900 dark:text-white max-w-[200px] truncate">
                          {p.booking?.event?.title || 'Event'}
                        </div>
                        <div className="text-sm font-bold text-primary-600 dark:text-primary-400 mt-0.5">
                          {formatCurrency(p.amount)}
                        </div>
                        <div className="text-xs text-gray-400">
                          {format(new Date(p.createdAt), 'MMM dd, yyyy HH:mm')}
                        </div>
                      </td>

                      {/* Transaction ID */}
                      <td className="min-w-[240px] px-6 py-4 align-top">
                        <div className="font-mono text-xs font-bold text-gray-900 dark:text-white tracking-wider">
                          {p.transactionId}
                        </div>
                        {p.booking?.players?.length > 0 && (
                          <div className="mt-2 space-y-1">
                            <div className="text-xs font-semibold text-primary-700 dark:text-primary-300">
                              {p.booking.teamMode || p.booking.gameMode || p.booking.event?.teamMode || p.booking.event?.gameMode || 'Team'} · {p.booking.players.length} player{p.booking.players.length === 1 ? '' : 's'}
                            </div>
                            {p.booking.players.map((player, index) => (
                              <div
                                key={`${p.booking._id}-${player.freeFireUid}`}
                                className="text-xs text-gray-600 dark:text-gray-300"
                              >
                                {index === 0 ? 'Team Leader' : `Player ${index + 1}`}: {player.playerName} · UID {player.freeFireUid}
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                          Free Fire: {p.freeFireAccountName || 'Not provided'}
                        </div>
                        <div className="font-mono text-xs text-gray-500 dark:text-gray-400">
                          UID: {p.freeFireUid || 'Not provided'}
                        </div>
                        {p.note && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 italic max-w-xs truncate mt-0.5">
                            Note: {p.note}
                          </div>
                        )}
                      </td>

                      {/* Screenshot */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {screenshotSrc ? <button
                          type="button"
                          onClick={() => setPreviewImage(screenshotSrc)}
                          className="group relative inline-block rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 hover:ring-2 hover:ring-primary-500 transition-all"
                        >
                          <img
                            src={screenshotSrc}
                            alt="Receipt"
                            className="w-12 h-12 object-cover"
                          />
                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                            </svg>
                          </div>
                        </button> : (
                          <span className="inline-flex rounded-lg border border-violet-300 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-800 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300">
                            TEST ONLY
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>{getStatusBadge(p.status)}</div>
                        {p.reviewedBy && (
                          <div className="text-[11px] text-gray-400 mt-1">
                            by {p.reviewedBy.name || 'Admin'}
                          </div>
                        )}
                        {p.rejectionReason && (
                          <div className="text-[11px] text-red-500 max-w-[150px] truncate mt-0.5" title={p.rejectionReason}>
                            Reason: {p.rejectionReason}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {p.status === 'PENDING' ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedPayment(p);
                                setReviewAction('APPROVE');
                              }}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedPayment(p);
                                setReviewAction('REJECT');
                                setRejectionReason('');
                              }}
                              className="px-3 py-1.5 border border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-semibold rounded-lg transition-colors"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">Reviewed</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!hasPrevPage}
                onClick={prevPage}
                className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs font-medium transition-colors"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={!hasNextPage}
                onClick={nextPage}
                className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs font-medium transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Review Confirmation Modal */}
      {selectedPayment && reviewAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            onClick={() => !reviewLoading && setSelectedPayment(null)}
          />
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-4">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                  reviewAction === 'APPROVE'
                    ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                    : 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400'
                }`}
              >
                {reviewAction === 'APPROVE' ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  {reviewAction === 'APPROVE' ? 'Approve Payment' : 'Reject Payment'}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {selectedPayment.booking?.event?.title || 'Event Booking'}
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-gray-50 dark:bg-gray-900/50 rounded-xl space-y-1.5 text-xs text-gray-600 dark:text-gray-300 mb-4 border border-gray-100 dark:border-gray-700">
              <p><span className="font-semibold text-gray-900 dark:text-white">Attendee:</span> {selectedPayment.user?.name} ({selectedPayment.user?.email})</p>
              <p><span className="font-semibold text-gray-900 dark:text-white">Payable Amount:</span> {formatCurrency(selectedPayment.amount)}</p>
              <p><span className="font-semibold text-gray-900 dark:text-white">Transaction UTR:</span> <span className="font-mono font-bold text-purple-600 dark:text-purple-400">{selectedPayment.transactionId}</span></p>
              <p><span className="font-semibold text-gray-900 dark:text-white">Free Fire Account Name:</span> {selectedPayment.freeFireAccountName || 'Not provided'}</p>
              <p><span className="font-semibold text-gray-900 dark:text-white">Free Fire UID:</span> <span className="font-mono">{selectedPayment.freeFireUid || 'Not provided'}</span></p>
              <p><span className="font-semibold text-gray-900 dark:text-white">Phone Number:</span> {selectedPayment.phoneNumber || 'Not provided'}</p>
              {selectedPayment.testOnly && (
                <p className="font-bold text-violet-700 dark:text-violet-300">TEST ONLY — approval does not confirm a ticket or send a genuine payment email.</p>
              )}
            </div>

            {reviewAction === 'APPROVE' ? (
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
                {selectedPayment.testOnly
                  ? 'This updates only the development test record. No real payment or ticket status will be changed.'
                  : 'Please make sure you have verified the transaction reference against your merchant UPI app / bank statement. Approving will confirm the attendee’s ticket.'}
              </p>
            ) : (
              <div className="mb-6">
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1.5">
                  Rejection Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. UTR not matching records, incorrect amount paid, or screenshot blurry..."
                  className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-500 focus:border-transparent outline-none resize-none transition-colors"
                />
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSelectedPayment(null)}
                disabled={reviewLoading}
                className="flex-1 py-2.5 px-4 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium rounded-lg text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReviewSubmit}
                disabled={reviewLoading}
                className={`flex-1 py-2.5 px-4 text-white font-medium rounded-lg text-sm transition-colors flex items-center justify-center gap-2 ${
                  reviewAction === 'APPROVE'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {reviewLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Processing...
                  </>
                ) : reviewAction === 'APPROVE' ? (
                  'Confirm Approval'
                ) : (
                  'Confirm Rejection'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Screenshot Full Preview Modal */}
      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative max-w-2xl w-full bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-2xl p-4">
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-sm font-bold text-gray-900 dark:text-white">Payment Screenshot Preview</h4>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg transition-colors"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="max-h-[75vh] overflow-auto flex items-center justify-center bg-gray-100 dark:bg-gray-950 rounded-xl p-2">
              <img
                src={previewImage}
                alt="Payment proof screenshot"
                className="max-h-[70vh] object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPaymentsPage;
