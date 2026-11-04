import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import analyticsService from '../../services/analyticsService';

export const fetchDashboard = createAsyncThunk(
  'analytics/fetchDashboard',
  async (_, { rejectWithValue }) => {
    try {
      const res = await analyticsService.getDashboard();
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch dashboard metrics');
    }
  }
);

const analyticsSlice = createSlice({
  name: 'analytics',
  initialState: {
    data: {
      vehicles: { total: 0, Available: 0, 'On Trip': 0, 'In Shop': 0, Retired: 0 },
      drivers: { total: 0, Available: 0, 'On Trip': 0, 'Off Duty': 0, Suspended: 0 },
      trips: { total: 0, Draft: 0, Dispatched: 0, Completed: 0, Cancelled: 0 },
      utilization: 0,
      openMaintenance: 0,
      fuelEfficiency: [],
      operationalCosts: [],
      financialSummary: {
        totalCompletedTrips: 0,
        totalGrossRevenue: 0,
        totalFreightRevenue: 0,
        totalSharedCargoRevenue: 0,
        totalFuelCost: 0,
        totalNetProfit: 0,
        overallMarginPct: 0
      },
      completedTripsFinancials: []
    },
    loading: false,
    error: null
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchDashboard.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDashboard.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(fetchDashboard.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  }
});

export default analyticsSlice.reducer;
