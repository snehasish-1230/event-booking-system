import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import toast from 'react-hot-toast';
import { getRegistrationById } from '../services/registrationService';
import { getPaymentConfig, submitPayment, getPaymentById, createTestPayment } from '../services/paymentService';
import { formatCurrency } from '../utils/formatters';
import { isPaidEvent } from '../utils/eventPricing';
import { isValidPhoneNumber } from '../utils/phoneValidation';
import EventImage from '../components/ui/EventImage';
import useDocumentTitle from '../hooks/useDocumentTitle';

const PaymentPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const bookingIdParam = searchParams.get('bookingId') || searchParams.get('booking');

  useDocumentTitle('Complete Payment — Event Booking');

  // State
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(null);
  const [existingPayment, setExistingPayment] = useState(null);
  const [testPayment, setTestPayment] = useState(null);
  const [paymentConfig, setPaymentConfig] = useState({
    upiId: 'eventbooking@okaxis',
    paymentQrUrl: '',
    maxFileSizeMb: 5,
    currency: 'INR',
  });

  // Form State
  const [transactionId, setTransactionId] = useState('');
  const [freeFireAccountName, setFreeFireAccountName] = useState('');
  const [freeFireUid, setFreeFireUid] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [note, setNote] = useState('');
  const [screenshotFile, setScreenshotFile] = useState(null);
  const [screenshotPreview, setScreenshotPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const fileInputRef = useRef(null);
  const submitLockRef = useRef(false);

  // Fetch Booking, Existing Payment, and Config
  const loadData = useCallback(async () => {
    setBooking(null);
    setExistingPayment(null);
    setSubmittedSuccess(false);
    setTestPayment(null);
    if (!bookingIdParam) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setErrorMessage('');

      // Fetch config & booking concurrently
      const [configRes, bookingRes] = await Promise.all([
        getPaymentConfig(),
        getRegistrationById(bookingIdParam),
      ]);

      if (configRes?.data) {
        setPaymentConfig((prev) => ({ ...prev, ...configRes.data }));
      }

      const bookingData = bookingRes.data?.registration || bookingRes.registration || bookingRes.data;
      setBooking(bookingData);
      if (bookingData.players?.length) {
        setFreeFireAccountName(bookingData.players[0].playerName || '');
        setFreeFireUid(bookingData.players[0].freeFireUid || '');
      }

      // Check if there is already a payment record for this booking
      try {
        const paymentRes = await getPaymentById(bookingIdParam);
        const pData = paymentRes.data?.payment || paymentRes.payment || paymentRes.data;
        if (pData) {
          setExistingPayment(pData);
          if (pData.status === 'PENDING') {
            setSubmittedSuccess(true);
          }
        }
      } catch (err) {
        if (err.response?.status !== 404) {
          throw err;
        }
        setExistingPayment(null);
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to load booking details for payment.';
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [bookingIdParam]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Clean up object URL preview on unmount
  useEffect(() => {
    return () => {
      if (screenshotPreview && screenshotPreview.startsWith('blob:')) {
        URL.revokeObjectURL(screenshotPreview);
      }
    };
  }, [screenshotPreview]);

  // File selection handler
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type
    const validMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const validExtensions = /\.(jpe?g|png|webp|gif)$/i.test(file.name);
    if (file.type ? !validMimes.includes(file.type) : !validExtensions) {
      setFieldErrors((prev) => ({ ...prev, screenshot: 'Choose a PNG, JPG/JPEG, WebP, or GIF image.' }));
      if (screenshotPreview?.startsWith('blob:')) URL.revokeObjectURL(screenshotPreview);
      setScreenshotFile(null);
      setScreenshotPreview(null);
      e.target.value = '';
      return;
    }

    // Validate size
    const maxMb = paymentConfig.maxFileSizeMb || 5;
    if (file.size > maxMb * 1024 * 1024) {
      setFieldErrors((prev) => ({ ...prev, screenshot: `File size must not exceed ${maxMb}MB.` }));
      if (screenshotPreview?.startsWith('blob:')) URL.revokeObjectURL(screenshotPreview);
      setScreenshotFile(null);
      setScreenshotPreview(null);
      e.target.value = '';
      return;
    }

    if (screenshotPreview && screenshotPreview.startsWith('blob:')) {
      URL.revokeObjectURL(screenshotPreview);
    }

    setScreenshotFile(file);
    setScreenshotPreview(URL.createObjectURL(file));
    setFieldErrors((prev) => ({ ...prev, screenshot: '' }));
    setErrorMessage('');
  };

  const handleRemoveScreenshot = () => {
    if (screenshotPreview && screenshotPreview.startsWith('blob:')) {
      URL.revokeObjectURL(screenshotPreview);
    }
    setScreenshotFile(null);
    setScreenshotPreview(null);
    setFieldErrors((prev) => ({ ...prev, screenshot: 'Payment screenshot is required.' }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Submit payment form
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (submitLockRef.current || submitting) return;
    const errors = {};
    if (!bookingIdParam) {
      errors.bookingId = 'A registration ID is required to submit payment details.';
    }
    if (!transactionId.trim()) {
      errors.transactionId = 'Please enter the transaction reference / UTR ID.';
    } else if (transactionId.trim().length < 4 || transactionId.trim().length > 64) {
      errors.transactionId = 'Transaction reference must be between 4 and 64 characters.';
    }
    if (!screenshotFile) {
      errors.screenshot = 'Please upload a screenshot of your payment confirmation.';
    }
    if (!freeFireAccountName.trim()) {
      errors.freeFireAccountName = 'Please enter your Free Fire account name.';
    } else if (freeFireAccountName.trim().length > 80) {
      errors.freeFireAccountName = 'Free Fire account name cannot exceed 80 characters.';
    }
    if (!freeFireUid.trim()) {
      errors.freeFireUid = 'Please enter your Free Fire UID.';
    } else if (!/^\d{1,20}$/.test(freeFireUid)) {
      errors.freeFireUid = 'Free Fire UID must contain 1 to 20 digits only.';
    }
    if (!phoneNumber.trim()) {
      errors.phoneNumber = 'Please enter your phone number.';
    } else if (!isValidPhoneNumber(phoneNumber)) {
      errors.phoneNumber = 'Enter a valid phone number, including country code for international numbers.';
    }
    if (!booking) {
      errors.bookingId = 'Booking information is unavailable. Please reload the page.';
    }
    if (note.trim().length > 500) {
      errors.note = 'Payment note cannot exceed 500 characters.';
    }
    if (isApproved || isPending) {
      return;
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setErrorMessage('Please correct the highlighted fields before submitting.');
      return;
    }

    submitLockRef.current = true;
    setSubmitting(true);
    setErrorMessage('');
    setFieldErrors({});

    try {
      const formData = new FormData();
      formData.append('bookingId', booking._id);
      formData.append('transactionId', transactionId.trim().toUpperCase());
      formData.append('screenshot', screenshotFile);
      formData.append('freeFireAccountName', freeFireAccountName.trim());
      formData.append('freeFireUid', freeFireUid);
      formData.append('phoneNumber', phoneNumber.trim());
      if (note.trim()) {
        formData.append('note', note.trim());
      }

      const response = await submitPayment(formData);
      const payment = response.data?.payment || response.payment;
      if (payment) setExistingPayment(payment);
      setBooking((current) => current ? { ...current, paymentStatus: 'PENDING' } : current);
      setSubmittedSuccess(true);
      setTransactionId('');
      setFreeFireAccountName('');
      setFreeFireUid('');
      setPhoneNumber('');
      setNote('');
      setScreenshotFile(null);
      setScreenshotPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      const successMessage = response.message || 'Payment details submitted. Your payment is awaiting verification.';
      setErrorMessage('');
      toast.success(successMessage);
      navigate(`/tickets/${booking._id}`, { replace: true });
    } catch (err) {
      const responseErrors = err.response?.data?.errors;
      if (Array.isArray(responseErrors)) {
        const apiFieldErrors = {};
        responseErrors.forEach((error) => {
          if (error?.field && error?.message) apiFieldErrors[error.field] = error.message;
        });
        if (Object.keys(apiFieldErrors).length) setFieldErrors(apiFieldErrors);
      }
      const msg = responseErrors?.[0]?.message
        || err.response?.data?.message
        || err.message
        || 'Failed to submit payment. Please verify details and try again.';
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      submitLockRef.current = false;
      setSubmitting(false);
    }
  };

  const handleCreateTestPayment = async () => {
    if (!booking || submitting) return;
    setSubmitting(true);
    setErrorMessage('');
    try {
      const response = await createTestPayment(booking._id);
      setTestPayment(response.data?.payment || response.payment);
      toast.success(response.message || 'Development test payment created.');
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to create development test payment.';
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Generate UPI payload string for the QR code
  const event = booking?.event || {};
  const amountToPay = Number(event.price) || 0;
  const paidEvent = isPaidEvent(event);
  const currency = 'INR';

  // Standard UPI URI format: upi://pay?pa=upiId&pn=Name&am=Amount&cu=INR&tn=BookingRef
  const upiPayload = `upi://pay?pa=${encodeURIComponent(paymentConfig.upiId)}&pn=${encodeURIComponent('Event Booking')}&am=${encodeURIComponent(amountToPay.toFixed(2))}&cu=${encodeURIComponent(currency)}&tn=${encodeURIComponent(`Booking ${booking?.confirmationCode || ''}`)}`;

  const handleDownloadQr = () => {
    const svg = document.getElementById('payment-qr-svg');
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      const pngFile = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.download = `UPI-QR-Booking-${booking?.confirmationCode || 'payment'}.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };
    img.src = `data:image/svg+xml;base64,${btoa(svgData)}`;
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 border border-gray-200 dark:border-gray-700 animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mx-auto" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mx-auto" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6">
            <div className="h-72 bg-gray-200 dark:bg-gray-700 rounded-xl" />
            <div className="space-y-4">
              <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="h-28 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!bookingIdParam || (!booking && !loading)) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Booking Not Found</h2>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            {errorMessage || 'A valid booking ID is required to access the payment verification page.'}
          </p>
          <Link
            to="/tickets"
            className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors shadow-sm"
          >
            View My Tickets
          </Link>
        </div>
      </div>
    );
  }

  if (!paidEvent) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">No payment required</h2>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            This is a FREE event. Your registration does not require payment.
          </p>
          <Link
            to={`/tickets/${booking._id}`}
            className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors"
          >
            View My Ticket
          </Link>
        </div>
      </div>
    );
  }

  // Check if booking is already paid
  const isApproved = booking?.paymentStatus === 'APPROVED' || existingPayment?.status === 'APPROVED';
  const isPending = existingPayment?.status === 'PENDING' || (submittedSuccess && !isApproved);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Breadcrumb / Back button */}
      <div className="mb-6">
        <button
          onClick={() => navigate(`/tickets/${booking._id}`)}
          className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Back to Ticket Details
        </button>
      </div>

      {/* Main Container */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-lg">
        {/* Header Accent Bar */}
        <div className="h-2 bg-gradient-to-r from-primary-500 via-purple-600 to-pink-500" />

        <div className="p-6 sm:p-8">
          {/* Page Title */}
          <div className="text-center mb-8">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
              UPI QR Code Payment
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400 max-w-lg mx-auto text-sm sm:text-base">
              Scan the merchant QR code with any UPI app (GPay, PhonePe, Paytm, BHIM) to complete your booking.
            </p>
          </div>

          {/* Status Banners */}
          {isApproved && (
            <div className="mb-8 p-5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/60 flex items-center justify-center shrink-0 text-emerald-600 dark:text-emerald-400">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-emerald-900 dark:text-emerald-200">
                  Payment Verified & Approved!
                </h3>
                <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-300">
                  Your payment has been successfully verified by our team. Your ticket is confirmed and ready.
                </p>
                <div className="mt-4 flex gap-3">
                  <Link
                    to={`/tickets/${booking._id}`}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    View Confirmed Ticket
                  </Link>
                </div>
              </div>
            </div>
          )}

          {isPending && (
            <div className="mb-8 p-5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/60 flex items-center justify-center shrink-0 text-amber-600 dark:text-amber-400">
                <svg className="w-6 h-6 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-amber-900 dark:text-amber-200">
                  Payment Submitted & Awaiting Verification
                </h3>
                <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">
                  Payment details submitted successfully. Your payment is awaiting verification by the administrator. Once confirmed, your ticket status will be updated automatically.
                </p>
                {existingPayment && (
                  <div className="mt-3 pt-3 border-t border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 space-y-1">
                    <p><span className="font-semibold">Transaction ID / UTR:</span> {existingPayment.transactionId}</p>
                    <p><span className="font-semibold">Submitted Amount:</span> {formatCurrency(existingPayment.amount)}</p>
                    <p><span className="font-semibold">Submitted At:</span> {new Date(existingPayment.createdAt).toLocaleString()}</p>
                  </div>
                )}
                <div className="mt-4">
                  <Link
                    to={`/tickets/${booking._id}`}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    Return to Ticket
                  </Link>
                </div>
              </div>
            </div>
          )}

          {testPayment && (
            <div className="mb-8 rounded-xl border border-violet-300 bg-violet-50 p-5 text-violet-900 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-200">
              <h3 className="font-bold">TEST ONLY — no money transferred</h3>
              <p className="mt-1 text-sm">
                This development record can be reviewed by an admin, but it does not change registration or ticket status.
              </p>
              <p className="mt-2 font-mono text-xs">{testPayment.transactionId}</p>
            </div>
          )}

          {existingPayment?.status === 'REJECTED' && !isApproved && (
            <div className="mb-8 p-5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/60 flex items-center justify-center shrink-0 text-red-600 dark:text-red-400">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-red-900 dark:text-red-200">
                  Previous Submission Rejected
                </h3>
                <p className="mt-1 text-sm text-red-700 dark:text-red-300">
                  Your previous payment could not be verified.
                  {existingPayment.rejectionReason && (
                    <span className="block mt-1 font-semibold">
                      Reason: {existingPayment.rejectionReason}
                    </span>
                  )}
                </p>
                <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                  Please double-check your transaction ID, ensure the payment succeeded on your UPI app, and resubmit below.
                </p>
              </div>
            </div>
          )}

          {/* Grid Layout: Left QR & Instructions, Right Form */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: QR Code & Payment Summary */}
            <div className="lg:col-span-5 space-y-6">
              {/* Event & Booking Summary Box */}
              <div className="bg-gray-50 dark:bg-gray-900/60 rounded-xl p-5 border border-gray-200 dark:border-gray-700 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 font-semibold">
                    Event
                  </span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300">
                    {booking.ticketType || 'Standard'}
                  </span>
                </div>
                <EventImage
                  src={event.image}
                  alt={event.title || 'Event'}
                  className="h-40 w-full rounded-lg object-cover"
                  fallbackClassName="flex h-40 w-full items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800"
                />
                <h2 className="text-lg font-bold text-gray-900 dark:text-white line-clamp-2">
                  {event.title || 'Event Booking'}
                </h2>

                {booking.players?.length > 0 && (
                  <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                        {booking.teamMode || event.teamMode || event.gameMode || 'Team'} Roster
                      </h3>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {booking.players.length} players
                      </span>
                    </div>
                    <ul className="space-y-2">
                      {booking.players.map((player, index) => (
                        <li
                          key={`${player.freeFireUid}-${index}`}
                          className="flex items-center justify-between gap-3 text-sm"
                        >
                          <span className="truncate font-medium text-gray-800 dark:text-gray-200">
                            {index + 1}. {player.playerName}
                          </span>
                          <span className="shrink-0 font-mono text-xs text-gray-500 dark:text-gray-400">
                            UID {player.freeFireUid}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="pt-2 border-t border-gray-200 dark:border-gray-800 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Booking ID / Code</span>
                    <span className="font-mono font-bold text-gray-900 dark:text-white">
                      {booking.confirmationCode}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Quantity</span>
                    <span className="font-medium text-gray-900 dark:text-white">1 Ticket</span>
                  </div>
                  <div className="flex justify-between items-baseline pt-2 border-t border-gray-200 dark:border-gray-800">
                    <span className="text-gray-700 dark:text-gray-300 font-medium">Total Payable</span>
                    <span className="text-2xl font-black text-primary-600 dark:text-primary-400">
                      {formatCurrency(amountToPay)}
                    </span>
                  </div>
                </div>
              </div>

              {/* QR Code Card */}
              <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-700 text-center shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
                  Scan to Pay via UPI
                </p>

                <div className="inline-block p-3.5 bg-white rounded-2xl border-2 border-gray-200 shadow-inner">
                  {paymentConfig.paymentQrUrl ? (
                    <img
                      src={paymentConfig.paymentQrUrl}
                      alt="Merchant Payment QR"
                      className="w-48 h-48 object-contain"
                    />
                  ) : (
                    <QRCodeSVG
                      id="payment-qr-svg"
                      value={upiPayload}
                      size={200}
                      level="H"
                      includeMargin={true}
                    />
                  )}
                </div>

                {/* Merchant UPI ID display */}
                <div className="mt-4 p-2.5 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Merchant UPI ID</p>
                  <div className="flex items-center justify-center gap-2 mt-0.5">
                    <span className="font-mono font-bold text-sm text-gray-900 dark:text-white">
                      {paymentConfig.upiId}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(paymentConfig.upiId);
                        toast.success('UPI ID copied to clipboard');
                      }}
                      className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
                    >
                      Copy
                    </button>
                  </div>
                </div>

                {/* Download QR button */}
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={handleDownloadQr}
                    className="inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                    Download QR Code
                  </button>
                </div>
              </div>

              {/* Instructions Card */}
              <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-5 border border-blue-200 dark:border-blue-900/50">
                <h3 className="text-sm font-bold text-blue-900 dark:text-blue-200 flex items-center gap-2 mb-3">
                  <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Payment Instructions
                </h3>
                <ol className="text-xs text-blue-800 dark:text-blue-300 space-y-2 list-decimal list-inside">
                  <li>Open any supported UPI app (GPay, PhonePe, Paytm, etc.).</li>
                  <li>Scan the displayed QR code or use the Merchant UPI ID.</li>
                  <li>Pay the exact amount: <span className="font-bold">{formatCurrency(amountToPay)}</span>.</li>
                  <li>Copy the 12-digit UPI Transaction ID / UTR number from receipt.</li>
                  <li>Take a screenshot of the successful transaction confirmation.</li>
                  <li>Upload the screenshot & enter the UTR number in the form.</li>
                </ol>
              </div>
            </div>

            {/* Right Column: Verification Form */}
            <div className="lg:col-span-7">
              <div className="bg-gray-50 dark:bg-gray-900/40 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                  Submit Payment Details
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">
                  Provide your transfer details below for verification by our admin team.
                </p>

                {errorMessage && (
                  <div className="mb-5 p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
                    {errorMessage}
                  </div>
                )}

                <form onSubmit={handleSubmit} noValidate className="space-y-5">
                  {/* Read-only Booking ID */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                      Booking Reference ID (Read-only)
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={booking.confirmationCode || booking._id}
                      className="w-full px-3.5 py-2.5 text-sm bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 font-mono cursor-not-allowed"
                    />
                  </div>

                  {/* Read-only Amount */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                      Payable Amount (Read-only)
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={formatCurrency(amountToPay)}
                      className="w-full px-3.5 py-2.5 text-sm bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 font-bold cursor-not-allowed"
                    />
                  </div>

                  {/* Transaction ID / UTR */}
                  <div>
                    <label
                      htmlFor="transactionIdInput"
                      className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1.5"
                    >
                      Transaction ID / UTR / Reference No. <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="transactionIdInput"
                      type="text"
                      required
                      maxLength={64}
                      disabled={isApproved || isPending || submitting}
                      placeholder="e.g. 324158912345 or UPI ref no"
                      value={transactionId}
                      onChange={(e) => {
                        setTransactionId(e.target.value);
                        setFieldErrors((prev) => ({ ...prev, transactionId: '' }));
                        setErrorMessage('');
                      }}
                      aria-invalid={Boolean(fieldErrors.transactionId)}
                      aria-describedby={fieldErrors.transactionId ? 'transactionIdError' : undefined}
                      className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none uppercase font-mono transition-colors"
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Found in your UPI app payment receipt details (usually 12 digits).
                    </p>
                    {fieldErrors.transactionId && (
                      <p id="transactionIdError" className="mt-1 text-xs text-red-600 dark:text-red-400" role="alert">
                        {fieldErrors.transactionId}
                      </p>
                    )}
                  </div>

                  {/* Screenshot Upload with Preview */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1.5">
                      Payment Screenshot <span className="text-red-500">*</span>
                    </label>

                    {!screenshotPreview ? (
                      <div
                        onClick={() => !(isApproved || isPending || submitting) && fileInputRef.current?.click()}
                        className={`border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-6 text-center transition-colors ${
                          isApproved || isPending || submitting
                            ? 'opacity-60 cursor-not-allowed bg-gray-50 dark:bg-gray-800/50'
                            : 'cursor-pointer hover:border-primary-500 dark:hover:border-primary-400 bg-white dark:bg-gray-800'
                        }`}
                      >
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".png,.jpg,.jpeg,.webp,.gif,image/png,image/jpeg,image/webp,image/gif"
                          onChange={handleFileChange}
                          disabled={isApproved || isPending || submitting}
                          className="hidden"
                        />
                        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400">
                          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                          Click to browse and upload screenshot
                        </p>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          Supported formats: PNG, JPG/JPEG, WebP, GIF (Max {paymentConfig.maxFileSizeMb || 5}MB)
                        </p>
                      </div>
                    ) : (
                      <div className="relative bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={screenshotPreview}
                            alt="Screenshot Preview"
                            className="w-20 h-20 object-cover rounded-lg border border-gray-200 dark:border-gray-700"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {screenshotFile?.name || 'Selected Screenshot'}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              {screenshotFile ? `${(screenshotFile.size / (1024 * 1024)).toFixed(2)} MB` : ''}
                            </p>
                            <span className="inline-block mt-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded">
                              Ready for verification
                            </span>
                          </div>
                          {!isApproved && !isPending && !submitting && (
                            <button
                              type="button"
                              onClick={handleRemoveScreenshot}
                              className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                              title="Remove screenshot"
                            >
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                    {fieldErrors.screenshot && (
                      <p className="mt-1 text-xs text-red-600 dark:text-red-400" role="alert">
                        {fieldErrors.screenshot}
                      </p>
                    )}
                  </div>

                  {/* Free Fire account details */}
                  <div>
                    <label
                      htmlFor="freeFireAccountName"
                      className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1.5"
                    >
                      Free Fire Account Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="freeFireAccountName"
                      type="text"
                      required
                      maxLength={80}
                      disabled={isApproved || isPending || submitting}
                      placeholder="Enter your Free Fire in-game name"
                      value={freeFireAccountName}
                      onChange={(e) => {
                        setFreeFireAccountName(e.target.value);
                        setFieldErrors((prev) => ({ ...prev, freeFireAccountName: '' }));
                        setErrorMessage('');
                      }}
                      aria-invalid={Boolean(fieldErrors.freeFireAccountName)}
                      aria-describedby={fieldErrors.freeFireAccountName ? 'freeFireAccountNameError' : undefined}
                      className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-colors"
                    />
                    {fieldErrors.freeFireAccountName && (
                      <p id="freeFireAccountNameError" className="mt-1 text-xs text-red-600 dark:text-red-400" role="alert">
                        {fieldErrors.freeFireAccountName}
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="freeFireUid"
                      className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1.5"
                    >
                      Free Fire UID <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="freeFireUid"
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      pattern="[0-9]{1,20}"
                      required
                      maxLength={20}
                      disabled={isApproved || isPending || submitting}
                      placeholder="Enter your Free Fire UID number"
                      value={freeFireUid}
                      onChange={(e) => {
                        if (!/^\d*$/.test(e.target.value)) {
                          setFieldErrors((prev) => ({
                            ...prev,
                            freeFireUid: 'Free Fire UID can contain digits only.',
                          }));
                          return;
                        }
                        setFreeFireUid(e.target.value);
                        setFieldErrors((prev) => ({ ...prev, freeFireUid: '' }));
                        setErrorMessage('');
                      }}
                      aria-invalid={Boolean(fieldErrors.freeFireUid)}
                      aria-describedby={fieldErrors.freeFireUid ? 'freeFireUidError' : undefined}
                      className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-colors"
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Enter 1 to 20 digits. Leading zeros are accepted.
                    </p>
                    {fieldErrors.freeFireUid && (
                      <p id="freeFireUidError" className="mt-1 text-xs text-red-600 dark:text-red-400" role="alert">
                        {fieldErrors.freeFireUid}
                      </p>
                    )}
                  </div>

                  {/* Phone Number */}
                  <div>
                    <label
                      htmlFor="paymentPhoneNumber"
                      className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1.5"
                    >
                      Phone Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="paymentPhoneNumber"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      required
                      maxLength={25}
                      disabled={isApproved || isPending || submitting}
                      placeholder="Enter your phone number"
                      value={phoneNumber}
                      onChange={(e) => {
                        setPhoneNumber(e.target.value);
                        setFieldErrors((prev) => ({ ...prev, phoneNumber: '' }));
                        setErrorMessage('');
                      }}
                      aria-invalid={Boolean(fieldErrors.phoneNumber)}
                      aria-describedby={fieldErrors.phoneNumber ? 'paymentPhoneNumberError' : undefined}
                      className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-colors"
                    />
                    {fieldErrors.phoneNumber && (
                      <p id="paymentPhoneNumberError" className="mt-1 text-xs text-red-600 dark:text-red-400" role="alert">
                        {fieldErrors.phoneNumber}
                      </p>
                    )}
                  </div>

                  {/* Optional Note */}
                  <div>
                    <label
                      htmlFor="paymentNote"
                      className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1.5"
                    >
                      Payment Note (Optional)
                    </label>
                    <textarea
                      id="paymentNote"
                      rows={2}
                      maxLength={500}
                      disabled={isApproved || isPending || submitting}
                      placeholder="Account holder name or additional transfer remarks..."
                      value={note}
                      onChange={(e) => {
                        setNote(e.target.value);
                        setFieldErrors((prev) => ({ ...prev, note: '' }));
                        setErrorMessage('');
                      }}
                      aria-invalid={Boolean(fieldErrors.note)}
                      className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none transition-colors"
                    />
                    {fieldErrors.note && (
                      <p className="mt-1 text-xs text-red-600 dark:text-red-400" role="alert">
                        {fieldErrors.note}
                      </p>
                    )}
                  </div>

                  {/* Submit Button */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={submitting || isApproved || isPending}
                      className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 dark:disabled:bg-gray-700 text-white font-semibold rounded-lg shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                    >
                      {submitting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Submitting for Verification...
                        </>
                      ) : isApproved ? (
                        'Payment Already Verified'
                      ) : isPending ? (
                        'Awaiting Verification'
                      ) : (
                        'Submit Payment for Verification'
                      )}
                    </button>
                  </div>
                </form>
                {import.meta.env.DEV && !testPayment && (
                  <div className="mt-5 border-t border-dashed border-violet-300 pt-4 dark:border-violet-800">
                    <p className="mb-3 text-xs text-violet-700 dark:text-violet-300">
                      Development workflow only. This creates a separately marked test record and never confirms a real ticket.
                    </p>
                    <button
                      type="button"
                      onClick={handleCreateTestPayment}
                      disabled={submitting || isApproved || isPending}
                      className="w-full rounded-lg border border-violet-300 px-4 py-2.5 text-sm font-semibold text-violet-700 transition-colors hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-violet-700 dark:text-violet-300 dark:hover:bg-violet-950/50"
                    >
                      {submitting ? 'Creating test record...' : 'Create TEST ONLY payment'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentPage;
