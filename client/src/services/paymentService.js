import axiosInstance from './axiosInstance';

/**
 * Get payment configuration (merchant UPI ID, optional direct QR URL, limits)
 */
export const getPaymentConfig = async () => {
  const response = await axiosInstance.get('/api/payments/config');
  return response.data;
};

/**
 * Submit manual QR payment verification
 * @param {FormData} formData - Contains bookingId, transactionId, screenshot, and optional note
 */
export const submitPayment = async (formData) => {
  const response = await axiosInstance.post('/api/payments', formData);
  return response.data;
};

export const createTestPayment = async (bookingId) => {
  const response = await axiosInstance.post('/api/payments/test', { bookingId });
  return response.data;
};

/**
 * Get payments for currently authenticated user
 */
export const getMyPayments = async (params) => {
  const response = await axiosInstance.get('/api/payments/my', { params });
  return response.data;
};

/**
 * Get payment details by payment ID or booking ID
 */
export const getPaymentById = async (id) => {
  const response = await axiosInstance.get(`/api/payments/${id}`);
  return response.data;
};

/**
 * Admin: Get all payment submissions with filtering and pagination
 */
export const getAllPaymentsAdmin = async (params) => {
  const response = await axiosInstance.get('/api/payments/admin/all', { params });
  return response.data;
};

export const getAllTestPaymentsAdmin = async (params) => {
  const response = await axiosInstance.get('/api/payments/admin/test/all', { params });
  return response.data;
};

/**
 * Admin: Review payment (Approve or Reject)
 * @param {string} id - Payment ID
 * @param {Object} data - { action: 'APPROVE' | 'REJECT', rejectionReason?: string }
 */
export const reviewPaymentAdmin = async (id, data) => {
  const response = await axiosInstance.patch(`/api/payments/admin/${id}/review`, data);
  return response.data;
};

export const reviewTestPaymentAdmin = async (id, data) => {
  const response = await axiosInstance.patch(`/api/payments/admin/test/${id}/review`, data);
  return response.data;
};
