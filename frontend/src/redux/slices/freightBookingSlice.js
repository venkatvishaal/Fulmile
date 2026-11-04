import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import freightBookingService from '../../services/freightBookingService';

export const fetchFreightBookings = createAsyncThunk(
  'freightBookings/fetchList',
  async (params, { rejectWithValue }) => {
    try {
      const res = await freightBookingService.list(params);
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch bookings');
    }
  }
);

export const fetchAvailableBookings = createAsyncThunk(
  'freightBookings/fetchAvailable',
  async (_, { rejectWithValue }) => {
    try {
      const res = await freightBookingService.listAvailable();
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch requests');
    }
  }
);

export const createFreightBooking = createAsyncThunk(
  'freightBookings/create',
  async (data, { rejectWithValue }) => {
    try {
      const res = await freightBookingService.create(data);
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to create booking');
    }
  }
);

const freightBookingSlice = createSlice({
  name: 'freightBookings',
  initialState: {
    list: [],
    availableRequests: [],
    selectedBooking: null,
    loading: false,
    error: null
  },
  reducers: {
    clearBookingError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // fetch list
      .addCase(fetchFreightBookings.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchFreightBookings.fulfilled, (state, action) => {
        state.loading = false;
        state.list = action.payload;
      })
      .addCase(fetchFreightBookings.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // fetch available
      .addCase(fetchAvailableBookings.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchAvailableBookings.fulfilled, (state, action) => {
        state.loading = false;
        state.availableRequests = action.payload;
      })
      .addCase(fetchAvailableBookings.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // create
      .addCase(createFreightBooking.pending, (state) => {
        state.loading = true;
      })
      .addCase(createFreightBooking.fulfilled, (state, action) => {
        state.loading = false;
        state.list.unshift(action.payload);
      })
      .addCase(createFreightBooking.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  }
});

export const { clearBookingError } = freightBookingSlice.actions;
export default freightBookingSlice.reducer;

