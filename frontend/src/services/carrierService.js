import api from './api';

const carrierService = {
  listCarriers: () => api.get('/carriers'),
  getCarrier: (id) => api.get(`/carriers/${id}`),
  updateCarrier: (id, data) => api.put(`/carriers/${id}`, data),
  getMembers: (id) => api.get(`/carriers/${id}/members`)
};

export default carrierService;

