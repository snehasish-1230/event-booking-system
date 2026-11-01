import axiosInstance from './axiosInstance';

export const getDashboard = async () => {
  const response = await axiosInstance.get('/api/admin/dashboard');
  return response.data;
};

export const getUsers = async (params) => {
  const response = await axiosInstance.get('/api/admin/users', { params });
  return response.data;
};

export const updateUserRole = async (id, data) => {
  const response = await axiosInstance.put(
    `/api/admin/users/${id}/role`,
    data
  );
  return response.data;
};

export const toggleUserActive = async (id) => {
  const response = await axiosInstance.put(
    `/api/admin/users/${id}/toggle-active`
  );
  return response.data;
};

export const deleteUser = async (id) => {
  const response = await axiosInstance.delete(`/api/admin/users/${id}`);
  return response.data;
};

export const getEvents = async (params) => {
  const response = await axiosInstance.get('/api/admin/events', { params });
  return response.data;
};

export const updateEventStatus = async (id, data) => {
  const response = await axiosInstance.put(
    `/api/admin/events/${id}/status`,
    data
  );
  return response.data;
};

export const deleteEvent = async (id) => {
  const response = await axiosInstance.delete(`/api/admin/events/${id}`);
  return response.data;
};

export const getEventRoom = async (eventId) => {
  const response = await axiosInstance.get(`/api/admin/events/${eventId}/room`);
  return response.data;
};

export const saveEventRoomDraft = async (eventId, data) => {
  const response = await axiosInstance.put(`/api/admin/events/${eventId}/room/draft`, data);
  return response.data;
};

export const publishEventRoom = async (eventId, data) => {
  const response = await axiosInstance.put(`/api/admin/events/${eventId}/room`, data);
  return response.data;
};

export const resendFailedRoomEmails = async (eventId) => {
  const response = await axiosInstance.post(`/api/admin/events/${eventId}/room/resend-failed`);
  return response.data;
};

export const resendRoomEmails = async (eventId) => {
  const response = await axiosInstance.post(`/api/admin/events/${eventId}/room/resend`);
  return response.data;
};

export const getRegistrations = async (params) => {
  const response = await axiosInstance.get('/api/admin/registrations', {
    params,
  });
  return response.data;
};
