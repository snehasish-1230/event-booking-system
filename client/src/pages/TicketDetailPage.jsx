import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { QRCodeSVG } from 'qrcode.react';
import toast from 'react-hot-toast';
import { getRegistrationById, cancelRegistration } from '../services/registrationService';
import { useAuth } from '../contexts/AuthContext';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { isPaidEvent } from '../utils/eventPricing';

const STATUS_STYLES = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  confirmed: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  cancelled: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  attended: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
};

const STATUS_LABELS = {
  pending: 'Awaiting Payment',
  confirmed: 'Confirmed',
  cancelled: 'Cancelled',
  attended: 'Attended',
};

const TicketDetailPage = () => {
  const { id } = useParams();
  const { user } = useAuth();

  const [registration, setRegistration] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedRoomValue, setCopiedRoomValue] = useState('');

  useDocumentTitle(
    registration ? `Ticket — ${registration.event?.title || 'Detail'}` : 'Ticket Detail'
  );

  const fetchRegistration = useCallback(async () => {
    try {
      setLoading(true);
      const response = await getRegistrationById(id);
      const data = response.data?.registration || response.registration || response.data;
      setRegistration(data);
    } catch (err) {
      if (err.response?.status === 404) {
        setNotFound(true);
      } else {
        setFetchError(true);
        toast.error('Failed to load ticket details.');
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchRegistration();
  }, [fetchRegistration]);

  const handleCancel = async () => {
    setCancelLoading(true);
    try {
      await cancelRegistration(registration._id);
      toast.success('Registration cancelled successfully.');
      setShowCancelModal(false);
      await fetchRegistration();
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to cancel registration.';
      toast.error(message);
    } finally {
      setCancelLoading(false);
    }
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(registration.confirmationCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      toast.error('Failed to copy confirmation code.');
    }
  };

  const handleCopyRoomValue = async (value) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedRoomValue(value);
      setTimeout(() => setCopiedRoomValue(''), 2000);
    } catch {
      toast.error('Failed to copy room details.');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-pulse">
          <div className="h-4 bg-primary-500 dark:bg-primary-600" />
          <div className="p-8 space-y-6">
            <div className="text-center space-y-3">
              <div className="h-7 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mx-auto" />
              <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mx-auto" />
            </div>
            <div className="w-44 h-44 bg-gray-200 dark:bg-gray-700 rounded-xl mx-auto" />
            <div className="space-y-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex justify-between">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24" />
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-40" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Something went wrong
          </h2>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Failed to load ticket details. Please try again.
          </p>
          <button
            onClick={() => { setFetchError(false); fetchRegistration(); }}
            className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (notFound || !registration) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-6xl font-bold text-primary-600 dark:text-primary-400">404</h1>
          <h2 className="mt-4 text-2xl font-semibold text-gray-900 dark:text-white">
            Ticket Not Found
          </h2>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            The ticket you are looking for does not exist or you don&apos;t have permission to view it.
          </p>
          <Link
            to="/tickets"
            className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Back to My Tickets
          </Link>
        </div>
      </div>
    );
  }

  const event = registration.event || {};
  const paidEvent = isPaidEvent(event);
  const attendee = registration.user || user || {};
  const eventDate = event.date ? new Date(event.date) : null;
  const venue = event.location?.venue;
  const city = event.location?.city;
  const locationStr = [venue, city].filter(Boolean).join(', ');
  const isCancelled = registration.status === 'cancelled';
  const isConfirmed = registration.status === 'confirmed';
  const canCancel = (isConfirmed || registration.status === 'pending') && eventDate && eventDate > new Date();
  const canIssueTicket =
    (isConfirmed || registration.status === 'attended') &&
    (!paidEvent || registration.paymentStatus === 'APPROVED');

  return (
    <>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12 print:px-0 print:py-0">
        {/* Back Link — hidden in print */}
        <Link
          to="/tickets"
          className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors mb-6 print:hidden"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Back to My Tickets
        </Link>

        {/* Ticket Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm print:shadow-none print:border print:rounded-none">
          {/* Top accent bar */}
          <div className={`h-2 ${isCancelled ? 'bg-gray-400 dark:bg-gray-600' : 'bg-primary-500 dark:bg-primary-600'}`} />

          <div className="p-6 sm:p-8">
            {/* Event Title & Status */}
            <div className="text-center mb-8">
              <h1 className={`text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-3 ${
                isCancelled ? 'line-through opacity-60' : ''
              }`}>
                {event.title || 'Untitled Event'}
              </h1>

              {/* Date & Time */}
              {eventDate && (
                <p className="text-gray-600 dark:text-gray-400 mb-3">
                  {format(eventDate, 'EEEE, MMMM dd, yyyy')}
                  {event.time && ` at ${event.time}`}
                </p>
              )}

              {/* Location */}
              {locationStr && (
                <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
                  {locationStr}
                </p>
              )}

              {/* Status Badge */}
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-sm font-semibold rounded-full ${STATUS_STYLES[registration.status]}`}>
                {registration.status === 'confirmed' && (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                {registration.status === 'attended' && (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                )}
                {STATUS_LABELS[registration.status]}
              </span>
            </div>

            {/* Dashed Divider */}
            <div className="border-t-2 border-dashed border-gray-200 dark:border-gray-700 my-6 relative">
              <div className="absolute -left-10 -top-4 w-8 h-8 bg-gray-50 dark:bg-gray-950 rounded-full print:bg-white" />
              <div className="absolute -right-10 -top-4 w-8 h-8 bg-gray-50 dark:bg-gray-950 rounded-full print:bg-white" />
            </div>

            {/* QR Code & Confirmation Code */}
            <div className="text-center mb-8">
              {canIssueTicket ? (
                <div className="inline-block p-4 bg-white rounded-xl border border-gray-100 dark:border-gray-600 dark:bg-gray-700/30">
                  <QRCodeSVG
                    value={registration.confirmationCode}
                    size={180}
                    level="H"
                    includeMargin={true}
                    className="dark:opacity-90 print:opacity-100"
                  />
                </div>
              ) : (
                <p className="mx-auto max-w-md rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                  Your ticket QR code will be available after payment is verified.
                </p>
              )}

              {/* Confirmation Code */}
              <div className="mt-4">
                <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1 font-medium">
                  Confirmation Code
                </p>
                <button
                  onClick={handleCopyCode}
                  className="group inline-flex items-center gap-2 print:pointer-events-none"
                  title="Click to copy"
                >
                  <span className="font-mono text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white tracking-[0.2em]">
                    {registration.confirmationCode}
                  </span>
                  <span className="print:hidden">
                    {copiedCode ? (
                      <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                      </svg>
                    )}
                  </span>
                </button>
              </div>
            </div>

            {/* Ticket Details */}
            <div className="space-y-4 text-sm">
              {/* Attendee */}
              <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700">
                <span className="text-gray-500 dark:text-gray-400">Attendee</span>
                <span className="font-medium text-gray-900 dark:text-white text-right">
                  {attendee.name || `${attendee.firstName || ''} ${attendee.lastName || ''}`.trim() || 'N/A'}
                </span>
              </div>

              {/* Email */}
              <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700">
                <span className="text-gray-500 dark:text-gray-400">Email</span>
                <span className="font-medium text-gray-900 dark:text-white text-right">
                  {attendee.email || 'N/A'}
                </span>
              </div>

              {/* Event Date */}
              {eventDate && (
                <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700">
                  <span className="text-gray-500 dark:text-gray-400">Event Date</span>
                  <span className="font-medium text-gray-900 dark:text-white text-right">
                    {format(eventDate, 'EEEE, MMMM dd, yyyy')}
                    {event.time && ` at ${event.time}`}
                  </span>
                </div>
              )}

              {/* Location */}
              {locationStr && (
                <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700">
                  <span className="text-gray-500 dark:text-gray-400">Location</span>
                  <span className="font-medium text-gray-900 dark:text-white text-right">
                    {locationStr}
                  </span>
                </div>
              )}

              {registration.teamMode && registration.players?.length > 0 && (
                <div className="border-b border-gray-100 py-3 dark:border-gray-700">
                  <p className="text-gray-500 dark:text-gray-400">
                    {registration.gameMode || registration.teamMode || event.gameMode || event.teamMode} · {registration.teamSize || event.teamSize || registration.players.length} player(s)
                  </p>
                  <ul className="mt-2 space-y-1 text-right font-medium text-gray-900 dark:text-white">
                    {registration.players.map((player, index) => (
                      <li key={`${registration._id}-${player.freeFireUid}`}>
                        Player {index + 1}: {player.playerName} · UID {player.freeFireUid}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {registration.room && (
                <div className="rounded-xl border border-primary-200 bg-primary-50 p-4 dark:border-primary-800 dark:bg-primary-950/30">
                  <h2 className="font-semibold text-primary-900 dark:text-primary-200">
                    Room Details Available
                  </h2>
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-primary-900 dark:text-primary-100">
                    <dt>Room ID</dt><dd className="break-all font-mono font-semibold">{registration.room.roomId} <button type="button" onClick={() => handleCopyRoomValue(registration.room.roomId)} className="ml-1 underline">{copiedRoomValue === registration.room.roomId ? 'Copied' : 'Copy'}</button></dd>
                    <dt>Password</dt><dd className="break-all font-mono font-semibold">{registration.room.roomPassword} <button type="button" onClick={() => handleCopyRoomValue(registration.room.roomPassword)} className="ml-1 underline">{copiedRoomValue === registration.room.roomPassword ? 'Copied' : 'Copy'}</button></dd>
                    <dt>Team slot</dt><dd className="font-semibold">{registration.room.slotNumber}</dd>
                    <dt>Match time</dt><dd className="font-semibold">{format(new Date(registration.room.matchAt), 'MMM dd, yyyy · h:mm a')}</dd>
                  </dl>
                  {registration.room.instructions && (
                    <p className="mt-3 border-t border-primary-200 pt-3 text-sm text-primary-900 dark:border-primary-800 dark:text-primary-100">
                      Instructions: {registration.room.instructions}
                    </p>
                  )}
                </div>
              )}
              {event.teamMode && isConfirmed && !registration.room && (
                <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-600 dark:bg-gray-700/40 dark:text-gray-300">
                  Room Details Not Published Yet
                </p>
              )}

              {/* Ticket Type */}
              {registration.ticketType && (
                <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700">
                  <span className="text-gray-500 dark:text-gray-400">Ticket Type</span>
                  <span className="font-medium text-gray-900 dark:text-white capitalize text-right">
                    {registration.ticketType}
                  </span>
                </div>
              )}

              {/* Registration Date */}
              <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700">
                <span className="text-gray-500 dark:text-gray-400">Registered On</span>
                <span className="font-medium text-gray-900 dark:text-white text-right">
                  {format(new Date(registration.registeredAt || registration.createdAt), 'MMM dd, yyyy')}
                </span>
              </div>

              {/* Status */}
              <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700">
                <span className="text-gray-500 dark:text-gray-400">Attendance Status</span>
                <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${STATUS_STYLES[registration.status]}`}>
                  {STATUS_LABELS[registration.status]}
                </span>
              </div>

              {/* Payment Status for Paid Events */}
              {paidEvent && (
                <div className="flex items-center justify-between py-3">
                  <span className="text-gray-500 dark:text-gray-400">Payment Status</span>
                  <div className="flex items-center gap-2">
                    {registration.paymentStatus === 'APPROVED' ? (
                      <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                        Paid (Verified)
                      </span>
                    ) : registration.paymentStatus === 'REJECTED' ? (
                      <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300">
                        Payment Rejected
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 animate-pulse">
                        Payment Pending
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Payment Callout for Paid Events when not yet approved */}
            {paidEvent && registration.paymentStatus !== 'APPROVED' && !isCancelled && (
              <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl print:hidden flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-amber-900 dark:text-amber-200">
                    {registration.paymentStatus === 'PENDING'
                      ? 'Payment verification in progress'
                      : 'Payment required for this booking'}
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                    {registration.paymentStatus === 'PENDING'
                      ? 'View your submission or check verification status.'
                      : 'Please scan the UPI QR code to complete your booking.'}
                  </p>
                </div>
                <Link
                  to={`/payments?bookingId=${registration._id}`}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg transition-colors shrink-0 shadow-sm"
                >
                  {registration.paymentStatus === 'PENDING' ? 'View Payment Details' : 'Pay via QR Code'}
                </Link>
              </div>
            )}

            {/* Action Buttons — hidden in print */}
            <div className="mt-8 flex flex-col sm:flex-row gap-3 print:hidden">
              <button
                onClick={handlePrint}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
                </svg>
                Print Ticket
              </button>

              {canCancel && (
                <button
                  onClick={() => setShowCancelModal(true)}
                  className="flex-1 py-3 px-4 border border-danger-300 dark:border-danger-700 text-danger-600 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-900/20 font-medium rounded-lg transition-colors"
                >
                  Cancel Registration
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:hidden">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => !cancelLoading && setShowCancelModal(false)}
          />
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-danger-100 dark:bg-danger-900/30 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-danger-600 dark:text-danger-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Cancel Registration</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">This action cannot be undone</p>
              </div>
            </div>

            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to cancel your registration for{' '}
              <span className="font-semibold text-gray-900 dark:text-white">{event.title}</span>?
            </p>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                disabled={cancelLoading}
                className="flex-1 py-2.5 px-4 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium rounded-lg transition-colors"
              >
                Keep Registration
              </button>
              <button
                onClick={handleCancel}
                disabled={cancelLoading}
                className="flex-1 py-2.5 px-4 bg-danger-500 hover:bg-danger-600 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {cancelLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Cancelling...
                  </>
                ) : (
                  'Yes, Cancel'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print-friendly styles */}
      <style>{`
        @media print {
          body { background: white !important; }
          nav, footer, header { display: none !important; }
          .print\\:hidden { display: none !important; }
          .print\\:px-0 { padding-left: 0 !important; padding-right: 0 !important; }
          .print\\:py-0 { padding-top: 0 !important; padding-bottom: 0 !important; }
          .print\\:shadow-none { box-shadow: none !important; }
          .print\\:border { border: 1px solid #e5e7eb !important; }
          .print\\:rounded-none { border-radius: 0 !important; }
          .print\\:bg-white { background-color: white !important; }
          .print\\:opacity-100 { opacity: 1 !important; }
          .print\\:pointer-events-none { pointer-events: none !important; }
        }
      `}</style>
    </>
  );
};

export default TicketDetailPage;
