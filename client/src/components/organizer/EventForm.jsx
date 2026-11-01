import { useState, useEffect, useRef } from 'react';
import ImageUpload from '../ui/ImageUpload';

const CATEGORIES = [
  { value: '', label: 'Select a category' },
  { value: 'conference', label: 'Conference' },
  { value: 'workshop', label: 'Workshop' },
  { value: 'seminar', label: 'Seminar' },
  { value: 'meetup', label: 'Meetup' },
  { value: 'concert', label: 'Concert' },
  { value: 'sports', label: 'Sports' },
  { value: 'networking', label: 'Networking' },
  { value: 'webinar', label: 'Webinar' },
];

const TEAM_MODES = [
  { value: 'SOLO', label: 'Solo — 1 player' },
  { value: 'DUO', label: 'Duo — 2 players' },
  { value: 'TRIO', label: 'Trio — 3 players' },
  { value: 'SQUAD', label: 'Squad — 4 players' },
];

const INITIAL_FORM = {
  title: '',
  description: '',
  category: '',
  date: '',
  endDate: '',
  time: '',
  venue: '',
  address: '',
  city: '',
  country: '',
  minParticipants: 1,
  capacity: '',
  teamMode: 'SOLO',
  pricingType: 'FREE',
  price: 0,
  tags: [],
  image: '',
};

const toLocalDateInputValue = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getTodayString = () => toLocalDateInputValue(new Date());

const getMinimumEventDate = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return toLocalDateInputValue(date);
};

const EventForm = ({ initialData = null, onSubmit, isEditing = false, isLoading = false }) => {
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [tagInput, setTagInput] = useState('');
  const [imageUploading, setImageUploading] = useState(false);
  const firstErrorRef = useRef(null);
  const submitLockRef = useRef(false);

  useEffect(() => {
    if (initialData) {
      setFormData({
        title: initialData.title || '',
        description: initialData.description || '',
        category: initialData.category || '',
        date: initialData.date ? new Date(initialData.date).toISOString().split('T')[0] : '',
        endDate: initialData.endDate ? new Date(initialData.endDate).toISOString().split('T')[0] : '',
        time: initialData.time || '',
        venue: initialData.location?.venue || initialData.venue || '',
        address: initialData.location?.address || initialData.address || '',
        city: initialData.location?.city || initialData.city || '',
        country: initialData.location?.country || initialData.country || '',
        minParticipants: initialData.minParticipants ?? 1,
        capacity: initialData.capacity || '',
        teamMode: initialData.teamMode || '',
        pricingType:
          initialData.pricingType || (Number(initialData.price) > 0 ? 'PAID' : 'FREE'),
        price: initialData.price ?? 0,
        tags: initialData.tags || [],
        image: initialData.image || '',
      });
    }
  }, [initialData]);

  useEffect(() => {
    if (firstErrorRef.current) {
      firstErrorRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      firstErrorRef.current = null;
    }
  }, [errors]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleNumberChange = (e) => {
    const { name, value } = e.target;
    const numValue = value === '' ? '' : Number(value);
    if ((name === 'price' || name === 'capacity') && numValue !== '' && numValue < 0) return;
    setFormData((prev) => ({ ...prev, [name]: numValue }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handlePricingTypeChange = (pricingType) => {
    setFormData((previous) => ({
      ...previous,
      pricingType,
      price: pricingType === 'FREE'
        ? 0
        : Number(previous.price) > 0
          ? previous.price
          : '',
    }));
    setErrors((previous) => ({ ...previous, pricingType: '', price: '' }));
  };

  const handleTagKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTags(tagInput);
    }
  };

  const addTags = (rawTags) => {
    const parsedTags = rawTags
      .split(',')
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean);
    if (!parsedTags.length) return;

    setFormData((previous) => ({
      ...previous,
      tags: [...new Set([...previous.tags, ...parsedTags])].slice(0, 10),
    }));
    setTagInput((previous) => {
      const lastComma = previous.lastIndexOf(',');
      return lastComma >= 0 && !previous.endsWith(',')
        ? previous.slice(lastComma + 1).trimStart()
        : '';
    });
  };

  const handleTagInputChange = (value) => {
    if (value.includes(',')) {
      const lastComma = value.lastIndexOf(',');
      const completeTags = value.slice(0, lastComma + 1);
      setTagInput(value.slice(lastComma + 1).trimStart());
      addTags(completeTags);
      return;
    }
    setTagInput(value);
  };

  const removeTag = (tagToRemove) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.filter((t) => t !== tagToRemove),
    }));
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.title.trim() || formData.title.trim().length < 3) {
      newErrors.title = 'Title must be at least 3 characters';
    } else if (formData.title.trim().length > 100) {
      newErrors.title = 'Title must be at most 100 characters';
    }

    if (!formData.description.trim() || formData.description.trim().length < 10) {
      newErrors.description = 'Description must be at least 10 characters';
    } else if (formData.description.trim().length > 5000) {
      newErrors.description = 'Description must be at most 5000 characters';
    }

    if (!formData.category) {
      newErrors.category = 'Please select a category';
    }

    if (!isEditing && !formData.teamMode) {
      newErrors.teamMode = 'Please select a team format';
    }

    if (!formData.date) {
      newErrors.date = 'Event date is required';
    } else if (!isEditing && formData.date < getMinimumEventDate()) {
      newErrors.date = 'Choose a date after today. Events dated today are not accepted.';
    }

    if (formData.endDate && formData.date && new Date(formData.endDate) < new Date(formData.date)) {
      newErrors.endDate = 'End date must be after start date';
    }

    if (!formData.venue.trim()) {
      newErrors.venue = 'Venue name is required';
    }

    if (!formData.city.trim()) {
      newErrors.city = 'City is required';
    }

    if (!formData.capacity || Number(formData.capacity) < 1) {
      newErrors.capacity = 'Capacity must be at least 1';
    } else if (Number(formData.capacity) > 100000) {
      newErrors.capacity = 'Capacity cannot exceed 100,000';
    }

    if (
      !Number.isInteger(Number(formData.minParticipants)) ||
      Number(formData.minParticipants) < 1
    ) {
      newErrors.minParticipants = 'Minimum members must be at least 1';
    } else if (Number(formData.minParticipants) > Number(formData.capacity)) {
      newErrors.minParticipants = 'Minimum members cannot exceed capacity';
    }

    const price = Number(formData.price);
    if (formData.pricingType === 'PAID' && (!Number.isFinite(price) || price <= 0)) {
      newErrors.price = 'Enter a price greater than 0 for paid events';
    } else if (formData.pricingType === 'FREE' && price !== 0) {
      newErrors.price = 'Free events must have a price of 0';
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      const firstField = Object.keys(newErrors)[0];
      const el = document.querySelector(`[name="${firstField}"]`);
      if (el) firstErrorRef.current = el;
    }

    return Object.keys(newErrors).length === 0;
  };

  const buildPayload = () => ({
    title: formData.title.trim(),
    description: formData.description.trim(),
    category: formData.category,
    date: formData.date ? new Date(`${formData.date}T12:00:00`).toISOString() : '',
    endDate: formData.endDate || undefined,
    time: formData.time || undefined,
    location: {
      venue: formData.venue.trim(),
      address: formData.address.trim() || undefined,
      city: formData.city.trim(),
      country: formData.country.trim() || undefined,
    },
    capacity: Number(formData.capacity),
    minParticipants: Number(formData.minParticipants),
    teamMode: formData.teamMode || undefined,
    gameMode: formData.teamMode || undefined,
    teamSize: formData.teamMode
      ? { SOLO: 1, DUO: 2, TRIO: 3, SQUAD: 4 }[formData.teamMode]
      : undefined,
    pricingType: formData.pricingType,
    price: formData.pricingType === 'FREE' ? 0 : Number(formData.price),
    currency: 'INR',
    tags: formData.tags.length > 0 ? formData.tags : undefined,
    image: formData.image,
  });

  const handleSubmit = async (e, publishAfterSave = false) => {
    e.preventDefault();
    if (submitLockRef.current || isLoading || imageUploading) return;
    if (!validate()) return;
    submitLockRef.current = true;
    try {
      await onSubmit(buildPayload(), publishAfterSave);
    } catch (error) {
      const serverErrors = error.validationErrors || error.response?.data?.errors;
      if (Array.isArray(serverErrors) && serverErrors.length) {
        const fieldErrors = {};
        serverErrors.forEach(({ field, message }) => {
          const fieldName = field?.startsWith('location.')
            ? field.slice('location.'.length)
            : field;
          if (fieldName && !fieldErrors[fieldName]) fieldErrors[fieldName] = message;
        });
        setErrors((previous) => ({ ...previous, ...fieldErrors }));
        const firstField = Object.keys(fieldErrors)[0];
        const firstErrorElement = firstField
          ? document.querySelector(`[name="${firstField}"]`)
          : null;
        if (firstErrorElement) firstErrorRef.current = firstErrorElement;
      }
      throw error;
    } finally {
      submitLockRef.current = false;
    }
  };

  const inputClass = (field) =>
    `w-full px-4 py-2.5 rounded-lg border text-sm transition-colors bg-white dark:bg-gray-800
     text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500
     focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500
     ${errors[field]
      ? 'border-red-400 dark:border-red-500'
      : 'border-gray-300 dark:border-gray-600'
    }`;

  const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5';
  const errorClass = 'mt-1 text-xs text-red-500 dark:text-red-400';

  return (
    <form onSubmit={(e) => handleSubmit(e, false)} noValidate className="space-y-8">
      {/* Section 1 — Basic Information */}
      <FormSection title="Basic Information" icon={InfoIcon}>
        {/* Title */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="title" className={labelClass}>Title <span className="text-red-500">*</span></label>
            <span className="text-xs text-gray-400 dark:text-gray-500">{formData.title.length}/100</span>
          </div>
          <input
            id="title"
            name="title"
            type="text"
            value={formData.title}
            onChange={handleChange}
            placeholder="Enter event title"
            maxLength={100}
            className={inputClass('title')}
          />
          {errors.title && <p className={errorClass}>{errors.title}</p>}
        </div>

        {/* Description */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="description" className={labelClass}>Description <span className="text-red-500">*</span></label>
            <span className="text-xs text-gray-400 dark:text-gray-500">{formData.description.length}/5000</span>
          </div>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Describe your event in detail..."
            rows={5}
            maxLength={5000}
            className={`${inputClass('description')} resize-y min-h-[120px]`}
          />
          {errors.description && <p className={errorClass}>{errors.description}</p>}
        </div>

        {/* Category */}
        <div>
          <label htmlFor="category" className={labelClass}>Category <span className="text-red-500">*</span></label>
          <select
            id="category"
            name="category"
            value={formData.category}
            onChange={handleChange}
            className={inputClass('category')}
          >
            {CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>{cat.label}</option>
            ))}
          </select>
          {errors.category && <p className={errorClass}>{errors.category}</p>}
        </div>
      </FormSection>

      {/* Section 2 — Date & Time */}
      <FormSection title="Date & Time" icon={CalendarIcon}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="date" className={labelClass}>Event Date <span className="text-red-500">*</span></label>
            <input
              id="date"
              name="date"
              type="date"
              min={!isEditing ? getMinimumEventDate() : undefined}
              value={formData.date}
              onChange={handleChange}
              className={inputClass('date')}
            />
            {errors.date && <p className={errorClass}>{errors.date}</p>}
          </div>
          <div>
            <label htmlFor="endDate" className={labelClass}>End Date</label>
            <input
              id="endDate"
              name="endDate"
              type="date"
              value={formData.endDate}
              onChange={handleChange}
              min={formData.date || getTodayString()}
              className={inputClass('endDate')}
            />
            {errors.endDate && <p className={errorClass}>{errors.endDate}</p>}
          </div>
          <div>
            <label htmlFor="time" className={labelClass}>Time</label>
            <input
              id="time"
              name="time"
              type="time"
              value={formData.time}
              onChange={handleChange}
              className={inputClass('time')}
            />
          </div>
        </div>
      </FormSection>

      {/* Section 3 — Location */}
      <FormSection title="Location" icon={LocationIcon}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="venue" className={labelClass}>Venue Name <span className="text-red-500">*</span></label>
            <input
              id="venue"
              name="venue"
              type="text"
              value={formData.venue}
              onChange={handleChange}
              placeholder="e.g. Convention Center"
              className={inputClass('venue')}
            />
            {errors.venue && <p className={errorClass}>{errors.venue}</p>}
          </div>
          <div>
            <label htmlFor="address" className={labelClass}>Address</label>
            <input
              id="address"
              name="address"
              type="text"
              value={formData.address}
              onChange={handleChange}
              placeholder="Street address"
              className={inputClass('address')}
            />
          </div>
          <div>
            <label htmlFor="city" className={labelClass}>City <span className="text-red-500">*</span></label>
            <input
              id="city"
              name="city"
              type="text"
              value={formData.city}
              onChange={handleChange}
              placeholder="e.g. Istanbul"
              className={inputClass('city')}
            />
            {errors.city && <p className={errorClass}>{errors.city}</p>}
          </div>
          <div>
            <label htmlFor="country" className={labelClass}>Country</label>
            <input
              id="country"
              name="country"
              type="text"
              value={formData.country}
              onChange={handleChange}
              placeholder="e.g. Turkey"
              className={inputClass('country')}
            />
          </div>
        </div>
      </FormSection>

      {/* Section 4 — Capacity & Pricing */}
      <FormSection title="Capacity & Pricing" icon={TicketIcon}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="minParticipants" className={labelClass}>Minimum Members <span className="text-red-500">*</span></label>
            <input
              id="minParticipants"
              name="minParticipants"
              type="number"
              min={1}
              max={formData.capacity || 100000}
              value={formData.minParticipants}
              onChange={handleNumberChange}
              className={inputClass('minParticipants')}
            />
            {errors.minParticipants && <p className={errorClass}>{errors.minParticipants}</p>}
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              This target does not prevent publishing.
            </p>
          </div>
          <div>
            <label htmlFor="capacity" className={labelClass}>Capacity <span className="text-red-500">*</span></label>
            <input
              id="capacity"
              name="capacity"
              type="number"
              min={1}
              value={formData.capacity}
              onChange={handleNumberChange}
              placeholder="e.g. 100"
              className={inputClass('capacity')}
            />
            {errors.capacity && <p className={errorClass}>{errors.capacity}</p>}
          </div>
          <div className="sm:col-span-2">
            <span className={labelClass}>Team Configuration <span className="text-red-500">*</span></span>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" role="group" aria-label="Free Fire team format">
              {TEAM_MODES.map((mode, index) => {
                const selected = formData.teamMode === mode.value;
                return (
                  <button
                    key={mode.value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => {
                      setFormData((previous) => ({ ...previous, teamMode: mode.value }));
                      if (errors.teamMode) setErrors((previous) => ({ ...previous, teamMode: '' }));
                    }}
                    className={`rounded-xl border p-4 text-left transition-colors ${
                      selected
                        ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-500/30 dark:bg-primary-950/30'
                        : 'border-gray-200 bg-white hover:border-primary-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-primary-600'
                    }`}
                  >
                    <span className="block text-lg font-bold text-gray-900 dark:text-white">{mode.value}</span>
                    <span className="mt-1 block text-sm text-gray-600 dark:text-gray-300">
                      {index + 1} {index === 0 ? 'player' : 'players'}
                    </span>
                  </button>
                );
              })}
            </div>
            {isEditing && !formData.teamMode && (
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                This legacy event uses standard attendee registration with no team roster.
              </p>
            )}
            {errors.teamMode && <p className={errorClass}>{errors.teamMode}</p>}
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              One team registration consumes one capacity spot. Changing the format after registrations exist is blocked.
            </p>
          </div>
          <div className="sm:col-span-2">
            <span className={labelClass}>Event pricing <span className="text-red-500">*</span></span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="group" aria-label="Event pricing type">
              {[
                { value: 'FREE', title: 'FREE', description: 'No payment is required' },
                { value: 'PAID', title: 'PAID', description: 'Attendees pay a set INR price' },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={formData.pricingType === option.value}
                  onClick={() => handlePricingTypeChange(option.value)}
                  className={`rounded-xl border p-4 text-left transition-colors ${
                    formData.pricingType === option.value
                      ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-500 dark:bg-primary-900/20'
                      : 'border-gray-200 bg-white hover:border-primary-300 dark:border-gray-600 dark:bg-gray-800 dark:hover:border-primary-500'
                  }`}
                >
                  <span className="block font-bold text-gray-900 dark:text-white">{option.title}</span>
                  <span className="mt-1 block text-sm text-gray-600 dark:text-gray-400">{option.description}</span>
                </button>
              ))}
            </div>
            {errors.pricingType && <p className={errorClass}>{errors.pricingType}</p>}
          </div>
          {formData.pricingType === 'PAID' ? (
            <div className="sm:col-span-2">
              <label htmlFor="price" className={labelClass}>Ticket price (INR ₹) <span className="text-red-500">*</span></label>
              <input
                id="price"
                name="price"
                type="number"
                min={0.01}
                step="0.01"
                value={formData.price}
                onChange={handleNumberChange}
                placeholder="Enter an amount greater than 0"
                className={inputClass('price')}
                required
              />
              {errors.price && <p className={errorClass}>{errors.price}</p>}
            </div>
          ) : (
            <p className="sm:col-span-2 text-sm font-medium text-green-700 dark:text-green-400">
              This event is free. Attendees can register without payment.
            </p>
          )}
        </div>
      </FormSection>

      {/* Section 5 — Additional Details */}
      <FormSection title="Additional Details" icon={SparklesIcon}>
        {/* Tags */}
        <div>
          <label htmlFor="tagInput" className={labelClass}>Tags</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {formData.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium
                           bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="hover:text-red-500 transition-colors ml-0.5"
                  aria-label={`Remove ${tag}`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            ))}
          </div>
          <input
            id="tagInput"
            type="text"
            value={tagInput}
            onChange={(e) => handleTagInputChange(e.target.value)}
            onKeyDown={handleTagKeyDown}
            placeholder="Type a tag and press Enter"
            className={inputClass('tags')}
            disabled={formData.tags.length >= 10}
          />
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            {formData.tags.length}/10 tags — Separate with commas or press Enter
          </p>
        </div>

        {/* Image */}
        <div>
          <label className={labelClass}>Event Image</label>
          <ImageUpload
            value={formData.image}
            disabled={isLoading}
            onUploadingChange={setImageUploading}
            onChange={(url) => {
              setFormData((prev) => ({ ...prev, image: url }));
            }}
          />
        </div>
      </FormSection>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        {!isEditing && (
          <button
            type="button"
            onClick={(e) => handleSubmit(e, true)}
            disabled={isLoading || imageUploading}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold
                       text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors shadow-sm
                       hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading && <Spinner />}
            Publish Event
          </button>
        )}

        <button
          type="submit"
          disabled={isLoading || imageUploading}
          className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold
                     rounded-lg transition-colors shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed
                     ${isEditing
              ? 'text-white bg-primary-600 hover:bg-primary-700'
              : 'text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600'
            }`}
        >
          {isLoading && <Spinner />}
          {isEditing ? 'Update Event' : 'Save as Draft'}
        </button>
      </div>
    </form>
  );
};

/* ═══════ Sub-components ═══════ */

const FormSection = ({ title, icon: Icon, children }) => (
  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
    <div className="flex items-center gap-2.5 mb-5">
      <Icon />
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
    </div>
    <div className="space-y-4">{children}</div>
  </div>
);

const Spinner = () => (
  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

/* ═══════ Section Icons ═══════ */

const InfoIcon = () => (
  <svg className="w-5 h-5 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
  </svg>
);

const CalendarIcon = () => (
  <svg className="w-5 h-5 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
  </svg>
);

const LocationIcon = () => (
  <svg className="w-5 h-5 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
  </svg>
);

const TicketIcon = () => (
  <svg className="w-5 h-5 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" />
  </svg>
);

const SparklesIcon = () => (
  <svg className="w-5 h-5 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
  </svg>
);

export default EventForm;
