import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import * as eventService from '../../services/eventService';
import EventForm from '../../components/organizer/EventForm';
import useDocumentTitle from '../../hooks/useDocumentTitle';

const CreateEventPage = () => {
  useDocumentTitle('Create Event');
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (payload, publishAfterSave) => {
    try {
      setIsLoading(true);
      const response = await eventService.createEvent(payload);
      const eventId = response.data?.event?._id || response.data?._id || response._id;

      if (publishAfterSave) {
        if (!eventId) {
          throw new Error('The server created the event but did not return its ID, so publishing could not continue.');
        }
        await eventService.publishEvent(eventId);
        toast.success('Event created and published!');
      } else {
        toast.success('Event saved as draft!');
      }

      navigate('/organizer/events');
    } catch (error) {
      const details = error.response?.data?.errors;
      const message = Array.isArray(details) && details.length
        ? details.map(({ field, message: detail }) => `${field}: ${detail}`).join('; ')
        : error.message || 'Failed to create event';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

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
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Create New Event</h1>
        <p className="mt-1 text-gray-500 dark:text-gray-400">
          Fill in the details below to create your event. You can save as draft or publish immediately.
        </p>
      </div>

      {/* Form */}
      <EventForm
        onSubmit={handleSubmit}
        isLoading={isLoading}
      />
    </div>
  );
};

export default CreateEventPage;
