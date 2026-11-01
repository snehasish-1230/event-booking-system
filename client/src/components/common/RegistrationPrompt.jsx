import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const HANDLED_KEY = 'eventBookingRegistrationPromptHandled';
let handledInMemory = false;

const wasHandled = () => {
  try {
    return (
      handledInMemory ||
      window.sessionStorage.getItem(HANDLED_KEY) === 'true'
    );
  } catch {
    return handledInMemory;
  }
};

const RegistrationPrompt = () => {
  const { isAuthenticated, loading } = useAuth();
  const { pathname } = useLocation();
  const [handled, setHandled] = useState(wasHandled);
  const [isOpen, setIsOpen] = useState(false);
  const closeButtonRef = useRef(null);

  const isAuthRoute =
    /^\/(?:auth(?:\/|$)|login(?:\/|$)|register(?:\/|$)|forgot-password(?:\/|$)|reset-password(?:\/|$)|password(?:\/|$))/i.test(
      pathname
    );

  useEffect(() => {
    if (loading || handled || isAuthenticated || isAuthRoute || isOpen) {
      if (isAuthenticated || isAuthRoute) setIsOpen(false);
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      markHandled();
      setHandled(true);
      setIsOpen(true);
    }, 3000);
    return () => window.clearTimeout(timeoutId);
  }, [handled, isAuthRoute, isAuthenticated, isOpen, loading]);

  useEffect(() => {
    if (!isOpen) return undefined;
    closeButtonRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') closeButtonRef.current?.click();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const dismiss = () => {
    markHandled();
    setHandled(true);
    setIsOpen(false);
  };

  const markHandled = () => {
    handledInMemory = true;
    try {
      window.sessionStorage.setItem(HANDLED_KEY, 'true');
    } catch {
      // Keep the one-time prompt state in memory when session storage is unavailable.
    }
  };

  if (!isOpen || loading || isAuthenticated || isAuthRoute) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-slate-950/75 p-3 backdrop-blur-sm sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) dismiss();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="registration-prompt-title"
        className="relative my-auto grid w-full max-w-3xl overflow-hidden rounded-3xl border border-indigo-300/20 bg-[#11152f] text-white shadow-2xl shadow-indigo-950/50 sm:grid-cols-[1.05fr_0.95fr]"
      >
        <button
          ref={closeButtonRef}
          type="button"
          onClick={dismiss}
          aria-label="Close registration prompt"
          className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/15 hover:text-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="relative flex min-h-56 items-center justify-center overflow-hidden bg-gradient-to-br from-indigo-600 via-violet-700 to-blue-800 p-7 sm:min-h-full sm:p-10">
          <div className="absolute -left-12 -top-12 h-48 w-48 rounded-full bg-fuchsia-400/20 blur-3xl" />
          <div className="absolute -bottom-16 -right-12 h-56 w-56 rounded-full bg-cyan-300/20 blur-3xl" />
          <svg
            viewBox="0 0 280 220"
            className="relative w-full max-w-xs drop-shadow-2xl"
            role="img"
            aria-label="Event ticket and calendar illustration"
          >
            <rect x="63" y="24" width="154" height="170" rx="20" fill="#fff" fillOpacity=".95" />
            <path d="M63 44a20 20 0 0 1 20-20h114a20 20 0 0 1 20 20v25H63z" fill="#201f59" />
            <path d="M101 16v24M179 16v24" stroke="#a5b4fc" strokeWidth="9" strokeLinecap="round" />
            <rect x="87" y="88" width="24" height="24" rx="7" fill="#c4b5fd" />
            <rect x="128" y="88" width="24" height="24" rx="7" fill="#818cf8" />
            <rect x="169" y="88" width="24" height="24" rx="7" fill="#c4b5fd" />
            <rect x="87" y="128" width="24" height="24" rx="7" fill="#818cf8" />
            <rect x="128" y="128" width="24" height="24" rx="7" fill="#c4b5fd" />
            <rect x="169" y="128" width="24" height="24" rx="7" fill="#818cf8" />
            <path d="M112 177h56" stroke="#c7d2fe" strokeWidth="7" strokeLinecap="round" />
            <g transform="rotate(-12 207 151)">
              <rect x="178" y="127" width="78" height="48" rx="12" fill="#f5f3ff" />
              <path d="M190 127v48M244 127v48" stroke="#8b5cf6" strokeWidth="4" strokeDasharray="4 5" />
              <path d="M205 145h25M205 157h17" stroke="#4f46e5" strokeWidth="4" strokeLinecap="round" />
            </g>
          </svg>
        </div>

        <div className="px-6 pb-7 pt-12 sm:px-8 sm:pb-8 sm:pt-10">
          <span className="inline-flex items-center gap-2 rounded-full border border-indigo-300/20 bg-indigo-400/10 px-3 py-1.5 text-xs font-semibold text-indigo-200">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />
            Welcome to EventBooking!
          </span>
          <h2 id="registration-prompt-title" className="mt-4 text-2xl font-extrabold tracking-tight sm:text-3xl">
            Join Now &amp; Unlock More!
          </h2>
          <ul className="mt-5 space-y-3 text-sm text-slate-300">
            {[
              'Book your favourite events',
              'Get exclusive offers',
              'Receive event updates',
              'Manage your bookings easily',
            ].map((benefit) => (
              <li key={benefit} className="flex items-center gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-400/15 text-indigo-300">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="m5 12 4 4L19 6" />
                  </svg>
                </span>
                {benefit}
              </li>
            ))}
          </ul>
          <Link
            to="/auth/register"
            className="mt-7 flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-950/30 transition hover:from-violet-400 hover:to-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:ring-offset-2 focus:ring-offset-[#11152f]"
          >
            Create an Account
          </Link>
          <p className="mt-4 text-center text-sm text-slate-400">
            Already have an account?{' '}
            <Link to="/auth/login" className="font-semibold text-indigo-300 underline-offset-4 hover:text-white hover:underline">
              Login
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
};

export default RegistrationPrompt;
