import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import useDocumentTitle from '../hooks/useDocumentTitle';
import {
  requestPasswordReset,
  resendPasswordResetOtp,
  resetPassword,
  verifyPasswordResetOtp,
} from '../services/authService';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GENERIC_MESSAGE =
  'If an active account exists for this address, a verification code will be sent.';

const formatCountdown = (seconds) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

const ForgotPasswordPage = () => {
  useDocumentTitle('Forgot Password');
  const navigate = useNavigate();
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [otpSecondsRemaining, setOtpSecondsRemaining] = useState(0);
  const [resetSecondsRemaining, setResetSecondsRemaining] = useState(0);
  const [resendSecondsRemaining, setResendSecondsRemaining] = useState(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isRequesting, setIsRequesting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const requestLock = useRef(false);
  const verifyLock = useRef(false);
  const resendLock = useRef(false);
  const resetLock = useRef(false);

  useEffect(() => {
    if (step === 'success') {
      const timeoutId = window.setTimeout(
        () => navigate('/auth/login', { replace: true }),
        2500
      );
      return () => window.clearTimeout(timeoutId);
    }
    if (step !== 'otp' && step !== 'password') return undefined;

    const intervalId = window.setInterval(() => {
      setOtpSecondsRemaining((remaining) => Math.max(0, remaining - 1));
      setResendSecondsRemaining((remaining) => Math.max(0, remaining - 1));
      setResetSecondsRemaining((remaining) => Math.max(0, remaining - 1));
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, [navigate, step]);

  const clearFeedback = () => {
    setError('');
    setMessage('');
  };

  const handleRequest = async (event) => {
    event.preventDefault();
    if (requestLock.current) return;
    const normalizedEmail = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    requestLock.current = true;
    setIsRequesting(true);
    clearFeedback();
    try {
      const response = await requestPasswordReset({ email: normalizedEmail });
      setEmail(normalizedEmail);
      setOtpSecondsRemaining(response.data?.expiresInSeconds || 300);
      setResendSecondsRemaining(response.data?.resendCooldownSeconds || 60);
      setMessage(response.message || GENERIC_MESSAGE);
      setStep('otp');
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          'Unable to process the request right now. Please try again later.'
      );
    } finally {
      requestLock.current = false;
      setIsRequesting(false);
    }
  };

  const handleVerify = async (event) => {
    event.preventDefault();
    if (verifyLock.current) return;
    if (!/^\d{6}$/.test(otp)) {
      setError('Enter the six-digit code from your email.');
      return;
    }
    if (otpSecondsRemaining <= 0) {
      setError('This code has expired. Request a new code.');
      return;
    }

    verifyLock.current = true;
    setIsVerifying(true);
    clearFeedback();
    try {
      const response = await verifyPasswordResetOtp({ email, otp });
      const authorization = response.data?.resetToken;
      if (typeof authorization !== 'string' || authorization.length < 32) {
        throw new Error('Reset authorization was not returned. Request a new code.');
      }
      setResetToken(authorization);
      setResetSecondsRemaining(response.data?.expiresInSeconds || 600);
      setOtp('');
      setStep('password');
      setMessage('');
    } catch (verifyError) {
      setError(
        verifyError.response?.data?.message ||
          verifyError.message ||
          'Unable to verify this code. Please try again.'
      );
    } finally {
      verifyLock.current = false;
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (resendLock.current || resendSecondsRemaining > 0) return;
    resendLock.current = true;
    setIsResending(true);
    clearFeedback();
    try {
      const response = await resendPasswordResetOtp({ email });
      setOtp('');
      setOtpSecondsRemaining(response.data?.expiresInSeconds || 300);
      setResendSecondsRemaining(response.data?.resendCooldownSeconds || 60);
      setMessage(response.message || GENERIC_MESSAGE);
    } catch (resendError) {
      setError(
        resendError.response?.data?.message ||
          'Unable to resend the code. Please try again later.'
      );
      const retryAfter = Number(resendError.response?.headers?.['retry-after']);
      if (Number.isFinite(retryAfter) && retryAfter > 0) {
        setResendSecondsRemaining(Math.ceil(retryAfter));
      }
    } finally {
      resendLock.current = false;
      setIsResending(false);
    }
  };

  const handleReset = async (event) => {
    event.preventDefault();
    if (resetLock.current) return;
    if (!newPassword || !confirmPassword) {
      setError('Both password fields are required.');
      return;
    }
    if (newPassword.length < 6 || !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
      setError(
        'Password must be at least 6 characters and contain an uppercase letter, a lowercase letter, and a number.'
      );
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!resetToken || resetSecondsRemaining <= 0) {
      setResetToken('');
      setStep('email');
      setError('Your password reset authorization expired. Request a new code.');
      return;
    }

    resetLock.current = true;
    setIsResetting(true);
    clearFeedback();
    try {
      const response = await resetPassword({
        resetToken,
        newPassword,
        confirmPassword,
      });
      setResetToken('');
      setNewPassword('');
      setConfirmPassword('');
      setStep('success');
      setMessage(response.message || 'Your password has been reset successfully.');
      toast.success('Your password has been reset successfully.');
    } catch (resetError) {
      setError(
        resetError.response?.data?.message ||
          'Unable to reset your password. Request a new verification code.'
      );
      if ([400, 401, 410].includes(resetError.response?.status)) {
        setResetToken('');
        setNewPassword('');
        setConfirmPassword('');
        setStep('email');
      }
    } finally {
      resetLock.current = false;
      setIsResetting(false);
    }
  };

  const passwordPolicySatisfied =
    newPassword.length >= 6 && /(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword);

  return (
    <div className="flex min-h-[calc(100vh-160px)] items-center justify-center bg-linear-to-br from-primary-50 via-white to-primary-100 px-4 py-12 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900">
      <div className="w-full max-w-[440px]">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-100 dark:bg-primary-900/30">
            <svg className="h-7 w-7 text-primary-600 dark:text-primary-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {step === 'email' && 'Forgot Your Password?'}
            {step === 'otp' && 'Verify Your Email'}
            {step === 'password' && 'Create a New Password'}
            {step === 'success' && 'Password Reset Complete'}
          </h1>
          {step === 'email' && (
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Enter your registered email address to receive a verification code.
            </p>
          )}
          {(step === 'otp' || step === 'password') && (
            <p className="mt-2 break-all text-sm text-gray-600 dark:text-gray-400">
              {email}
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-xl shadow-gray-200/50 dark:border-gray-700 dark:bg-gray-800 dark:shadow-none">
          {error && (
            <div role="alert" className="mb-5 rounded-xl border border-danger-500/20 bg-danger-500/10 p-3 text-sm text-danger-600 dark:text-danger-500">
              {error}
            </div>
          )}
          {message && step !== 'success' && (
            <div role="status" className="mb-5 rounded-xl border border-primary-500/20 bg-primary-500/10 p-3 text-sm text-primary-700 dark:text-primary-300">
              {message}
            </div>
          )}

          {step === 'email' && (
            <form onSubmit={handleRequest} noValidate className="space-y-5">
              <div>
                <label htmlFor="resetEmail" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Email
                </label>
                <input
                  id="resetEmail"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setError('');
                  }}
                  disabled={isRequesting}
                  className="w-full rounded-xl border border-gray-300 bg-gray-50 px-4 py-2.5 text-gray-900 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/40 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  placeholder="you@example.com"
                />
              </div>
              <button
                type="submit"
                disabled={isRequesting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isRequesting ? 'Sending...' : 'Send OTP'}
              </button>
            </form>
          )}

          {step === 'otp' && (
            <>
              <form onSubmit={handleVerify} noValidate className="space-y-4">
                <div>
                  <label htmlFor="resetOtp" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Six-digit verification code
                  </label>
                  <input
                    id="resetOtp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={otp}
                    onChange={(event) => {
                      setOtp(event.target.value.replace(/\D/g, '').slice(0, 6));
                      setError('');
                    }}
                    disabled={isVerifying}
                    className="w-full rounded-xl border border-gray-300 bg-gray-50 px-4 py-3 text-center text-2xl font-bold tracking-[0.5em] text-gray-900 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/40 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                    placeholder="000000"
                  />
                </div>
                <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                  {otpSecondsRemaining > 0
                    ? `Code expires in ${formatCountdown(otpSecondsRemaining)}`
                    : 'This code has expired. Request a new one.'}
                </p>
                <button
                  type="submit"
                  disabled={isVerifying || otp.length !== 6 || otpSecondsRemaining === 0}
                  className="w-full rounded-xl bg-primary-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isVerifying ? 'Verifying...' : 'Verify OTP'}
                </button>
              </form>
              <button
                type="button"
                onClick={handleResend}
                disabled={isResending || resendSecondsRemaining > 0}
                className="mt-4 w-full text-sm font-medium text-primary-600 transition-colors hover:text-primary-500 disabled:cursor-not-allowed disabled:text-gray-400 dark:text-primary-400 dark:hover:text-primary-300"
              >
                {isResending
                  ? 'Sending new code...'
                  : resendSecondsRemaining > 0
                    ? `Resend OTP in ${formatCountdown(resendSecondsRemaining)}`
                    : 'Resend OTP'}
              </button>
            </>
          )}

          {step === 'password' && (
            <form onSubmit={handleReset} noValidate className="space-y-5">
              <div>
                <label htmlFor="newPassword" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  New Password
                </label>
                <div className="relative">
                  <input
                    id="newPassword"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(event) => {
                      setNewPassword(event.target.value);
                      setError('');
                    }}
                    disabled={isResetting}
                    className="w-full rounded-xl border border-gray-300 bg-gray-50 px-4 py-2.5 pr-12 text-gray-900 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/40 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                    placeholder="Enter a new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? 'Hide new password' : 'Show new password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-primary-600 dark:text-primary-400"
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                <p className={`mt-1.5 text-xs ${passwordPolicySatisfied ? 'text-success-500' : 'text-gray-500 dark:text-gray-400'}`}>
                  At least 6 characters, including uppercase, lowercase, and a number.
                </p>
              </div>
              <div>
                <label htmlFor="confirmPassword" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) => {
                      setConfirmPassword(event.target.value);
                      setError('');
                    }}
                    disabled={isResetting}
                    className="w-full rounded-xl border border-gray-300 bg-gray-50 px-4 py-2.5 pr-12 text-gray-900 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/40 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                    placeholder="Re-enter your new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((visible) => !visible)}
                    aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-primary-600 dark:text-primary-400"
                  >
                    {showConfirmPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>
              <p className="text-center text-xs text-gray-500 dark:text-gray-400">
                Reset authorization expires in {formatCountdown(resetSecondsRemaining)}
              </p>
              <button
                type="submit"
                disabled={isResetting || resetSecondsRemaining === 0}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isResetting ? 'Resetting password...' : 'Reset Password'}
              </button>
            </form>
          )}

          {step === 'success' && (
            <div className="space-y-5 text-center">
              <div role="status" className="rounded-xl border border-success-500/20 bg-success-500/10 p-4 text-sm font-medium text-success-600 dark:text-success-400">
                Your password has been reset successfully.
              </div>
              <button
                type="button"
                onClick={() => navigate('/auth/login', { replace: true })}
                className="w-full rounded-xl bg-primary-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-primary-700"
              >
                Back to Login
              </button>
            </div>
          )}
        </div>

        {step !== 'success' && (
          <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
            Remember your password?{' '}
            <Link
              to="/auth/login"
              className="font-medium text-primary-600 transition-colors hover:text-primary-500 dark:text-primary-400 dark:hover:text-primary-300"
            >
              Back to Login
            </Link>
          </p>
        )}
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
