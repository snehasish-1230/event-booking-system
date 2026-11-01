import axiosInstance from './axiosInstance';

const EMAIL_DELIVERY_TIMEOUT_MS = 30000;

export const register = async (data) => {
  const response = await axiosInstance.post('/api/auth/register', data, {
    timeout: EMAIL_DELIVERY_TIMEOUT_MS,
  });
  return response.data;
};

export const verifyEmail = async (data) => {
  const response = await axiosInstance.post('/api/auth/verify-email', data);
  return response.data;
};

export const resendEmailOtp = async (data) => {
  const response = await axiosInstance.post('/api/auth/resend-email-otp', data, {
    timeout: EMAIL_DELIVERY_TIMEOUT_MS,
  });
  return response.data;
};

export const requestPasswordReset = async (data) => {
  const response = await axiosInstance.post('/api/auth/forgot-password', data, {
    timeout: EMAIL_DELIVERY_TIMEOUT_MS,
  });
  return response.data;
};

export const verifyPasswordResetOtp = async (data) => {
  const response = await axiosInstance.post(
    '/api/auth/verify-password-reset-otp',
    data
  );
  return response.data;
};

export const resendPasswordResetOtp = async (data) => {
  const response = await axiosInstance.post(
    '/api/auth/resend-password-reset-otp',
    data,
    { timeout: EMAIL_DELIVERY_TIMEOUT_MS }
  );
  return response.data;
};

export const resetPassword = async (data) => {
  const response = await axiosInstance.post('/api/auth/reset-password', data);
  return response.data;
};

export const login = async (data) => {
  const response = await axiosInstance.post('/api/auth/login', data);
  return response.data;
};

export const getMe = async () => {
  const response = await axiosInstance.get('/api/auth/me');
  return response.data;
};

export const updateProfile = async (data) => {
  const response = await axiosInstance.put('/api/auth/profile', data);
  return response.data;
};

export const changePassword = async (data) => {
  const response = await axiosInstance.put('/api/auth/change-password', data);
  return response.data;
};

export const deleteAccount = async (data) => {
  const response = await axiosInstance.delete('/api/auth/delete-account', {
    data,
  });
  return response.data;
};
