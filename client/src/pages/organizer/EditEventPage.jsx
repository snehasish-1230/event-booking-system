import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import * as eventService from '../../services/eventService';
import EventForm from '../../components/organizer/EventForm';
import StatusBadge from '../../components/ui/StatusBadge';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { formatCurrency } from '../../utils/formatters';
import EventImage from '../../components/ui/EventImage';

const EditEventPage = () => {
  useDocumentTitle('Edit Event');
  const { id } = useParams();
  const navigate = useNavigate();

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchEvent = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await eventService.getEventById(id);
      const loadedEvent = response.data?.event || response.data || response;
      setEvent({
        ...loadedEvent,
        ...(response.data?.activeRegistrationCount !== undefined && {
          activeRegistrationCount: response.data.activeRegistrationCount,
        }),
      });
    } catch (err) {
      setError(err.message || 'Failed to load event');
      toast.error('Failed to load event');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  const handleSubmit = async (payload) => {
    try {
      setIsSubmitting(true);
      await eventService.updateEvent(id, payload);
      toast.success('Event updated successfully!');
      navigate('/organizer/events');
    } catch (error) {
      toast.error(error.message || 'Failed to update event');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePublish = async () => {
    try {
      setStatusLoading(true);
      await eventService.publishEvent(id);
      toast.success('Event published!');
      await fetchEvent();
    } catch {
      toast.error('Failed to publish event');
    } finally {
      setStatusLoading(false);
    }
  };

  const handleCancel = async () => {
    try {
      setStatusLoading(true);
      await eventService.cancelEvent(id);
      toast.success('Event cancelled');
      await fetchEvent();
    } catch {
      toast.error('Failed to cancel event');
    } finally {
      setStatusLoading(false);
    }
  };

  if (loading) return <EditPageSkeleton />;

  if (error) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
          <svg className="w-16 h-16 mx-auto text-red-300 dark:text-red-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Failed to load event</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6">{error}</p>
          <Link
            to="/organizer/events"
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white
                       bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
          >
            Back to Events
          </Link>
        </div>
      </div>
    );
  }

  const isCancelled = event?.status?.toLowerCase() === 'cancelled';
  const isDraft = event?.status?.toLowerCase() === 'draft';
  const isPublished = event?.status?.toLowerCase() === 'published';
  const registrationCount =
    event?.activeRegistrationCount ?? event?.registeredCount ?? 0;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <Link
          to="/organizer/events"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400
                     hover:text-primary-600 dark:hover:text-primary-400 transition-colors mb-4"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back to Events
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Edit Event</h1>
            <p className="mt-1 text-gray-500 dark:text-gray-400">
              Update your event details and settings.
            </p>
          </div>
          <StatusBadge status={event?.status?.toLowerCase()} />
        </div>
      </div>

      {/* Cancelled Banner */}
      {isCancelled && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-start gap-3">
          <svg className="w-5 h-5 text-red-500 dark:text-red-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-red-800 dark:text-red-300">This event is cancelled</p>
            <p className="text-sm text-red-600 dark:text-red-400 mt-0.5">
              Cancelled events cannot be edited. You can view the details below in read-only mode.
            </p>
          </div>
        </div>
      )}

      {/* Registration Warning */}
      {registrationCount > 0 && !isCancelled && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-start gap-3">
          <svg className="w-5 h-5 text-amber-500 dark:text-amber-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              This event has {registrationCount} registration{registrationCount !== 1 ? 's' : ''}
            </p>
            <p className="text-sm text-amber-600 dark:text-amber-400 mt-0.5">
              Be cautious when reducing capacity — existing registrations may be affected.
            </p>
          </div>
        </div>
      )}

      {/* Status Actions */}
      {!isCancelled && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Event Status</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {isDraft && 'This event is in draft mode. Publish to make it visible.'}
                {isPublished && 'This event is live and accepting registrations.'}
              </p>
            </div>
            <div className="flex gap-2">
              {isDraft && (
                <button
                  type="button"
                  onClick={handlePublish}
                  disabled={statusLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white
                             bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  {statusLoading && <StatusSpinner />}
                  Publish
                </button>
              )}
              {isPublished && (
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={statusLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white
                             bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  {statusLoading && <StatusSpinner />}
                  Cancel Event
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Form */}
      {isCancelled ? (
        <ReadOnlyView event={event} />
      ) : (
        <EventForm
          initialData={event}
          onSubmit={handleSubmit}
          isEditing
          isLoading={isSubmitting}
        />
      )}
    </div>
  );
};

/* ═══════ Read-Only View (Cancelled Events) ═══════ */
const ReadOnlyView = ({ event }) => {
  const fieldClass = 'text-sm text-gray-900 dark:text-white';
  const labelClass = 'text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-6 opacity-75">
      <div>
        <p className={labelClass}>Title</p>
        <p className={fieldClass}>{event.title}</p>
      </div>
      <div>
        <p className={labelClass}>Description</p>
        <p className={`${fieldClass} whitespace-pre-wrap`}>{event.description}</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div>
          <p className={labelClass}>Category</p>
          <p className={fieldClass}>{event.category}</p>
        </div>
        <div>
          <p className={labelClass}>Date</p>
          <p className={fieldClass}>{new Date(event.date).toLocaleDateString()}</p>
        </div>
        <div>
          <p className={labelClass}>Capacity</p>
          <p className={fieldClass}>{event.capacity}</p>
        </div>
        <div>
          <p className={labelClass}>Venue</p>
          <p className={fieldClass}>{event.location?.venue || event.venue || '—'}</p>
        </div>
        <div>
          <p className={labelClass}>City</p>
          <p className={fieldClass}>{event.location?.city || event.city || '—'}</p>
        </div>
        <div>
          <p className={labelClass}>Price</p>
          <p className={fieldClass}>{formatCurrency(event.price || 0)}</p>
        </div>
      </div>
      {event.image && (
        <div>
          <p className={labelClass}>Image</p>
          <EventImage
            src={event.image}
            alt={event.title}
            className="mt-1 h-48 w-full rounded-lg object-cover"
          />
        </div>
      )}
    </div>
  );
};

/* ═══════ Status Spinner ═══════ */
const StatusSpinner = () => (
  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

/* ═══════ Skeleton ═══════ */
const EditPageSkeleton = () => (
  <div className="max-w-3xl mx-auto space-y-6 animate-pulse">
    <div>
      <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded mb-4" />
      <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
      <div className="h-4 w-72 bg-gray-200 dark:bg-gray-700 rounded" />
    </div>
    {[...Array(4)].map((_, i) => (
      <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="h-5 w-36 bg-gray-200 dark:bg-gray-700 rounded mb-5" />
        <div className="space-y-4">
          <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    ))}
  </div>
);

export default EditEventPage;
