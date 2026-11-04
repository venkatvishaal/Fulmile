import api from './api';

const freightBookingService = {
  create: (data) => api.post('/freight-bookings', data),
  list: (params) => api.get('/freight-bookings', { params }),
  listAvailable: () => api.get('/freight-bookings/available'),
  getById: (id) => api.get(`/freight-bookings/${id}`),
  setQuote: (id, priceQuote) => api.put(`/freight-bookings/${id}/quote`, { price_quote: priceQuote }),
  acceptQuote: (id) => api.put(`/freight-bookings/${id}/accept-quote`),
  accept: (id, tripId = null, priceQuote = null) => api.put(`/freight-bookings/${id}/accept`, { trip_id: tripId, price_quote: priceQuote }),
  getAcceptedForDispatch: () => api.get('/freight-bookings/accepted-for-dispatch'),
  cancel: (id) => api.put(`/freight-bookings/${id}/cancel`),
  trackByCode: (code) => api.get(`/freight-bookings/track/${encodeURIComponent(code)}`)
};

export default freightBookingService;

