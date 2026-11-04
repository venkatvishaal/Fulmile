import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchDashboard } from '../redux/slices/analyticsSlice';
import analyticsService from '../services/analyticsService';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { FaFileCsv, FaChartLine, FaGasPump, FaMoneyBillWave, FaCoins, FaTruck, FaRoute, FaArrowRight } from 'react-icons/fa';
import { BsDownload, BsFileEarmarkExcel, BsFileEarmarkPdf } from 'react-icons/bs';
import { toast } from 'react-toastify';
import Menu from '../components/ui/Menu';
import { canExportFinance, downloadBlob, exportExcel, exportPdf, fileDate, num, pdfMoney } from '../utils/reportExport';

// Same cost-to-asset ratio the ROI ledger shows.
const assetRatio = (item) => (num(item.acquisition_cost) > 0 ? (num(item.total_operational_cost) / num(item.acquisition_cost)) * 100 : 0);

function reportTables(data) {
  const status = (obj, keys) => keys.map((k) => [k, obj?.[k] ?? 0]);
  const finSummary = data?.financialSummary || {};
  const summary = [
    ['Total Completed Trips', finSummary.totalCompletedTrips ?? 0],
    ['Completed Gross Revenue', `₹${num(finSummary.totalGrossRevenue).toLocaleString()}`],
    ['Primary Freight Revenue', `₹${num(finSummary.totalFreightRevenue).toLocaleString()}`],
    ['Shared Cargo Pure Profit (100% Margin)', `₹${num(data?.sharedCargoAnalytics?.totalPureProfit).toLocaleString()}`],
    ['Total Trip Fuel Expense', `₹${num(finSummary.totalFuelCost).toLocaleString()}`],
    ['Net Profit from Completed Trips', `₹${num(finSummary.totalNetProfit).toLocaleString()}`],
    ['Overall Operating Margin', `${finSummary.overallMarginPct ?? 0}%`],
    ['Shared Cargo Orders (Fulfilled/Active)', data?.sharedCargoAnalytics?.sharedOrdersCount ?? 0],
    ['Fleet utilisation', `${data?.utilization ?? 0}%`],
    ['Open maintenance logs', data?.openMaintenance ?? 0],
    ...status(data?.vehicles, ['Available', 'On Trip', 'In Shop', 'Retired']).map(([k, v]) => [`Vehicles · ${k}`, v]),
    ...status(data?.drivers, ['Available', 'On Trip', 'Off Duty', 'Suspended']).map(([k, v]) => [`Drivers · ${k}`, v]),
    ...status(data?.trips, ['Draft', 'Dispatched', 'Completed', 'Cancelled']).map(([k, v]) => [`Trips · ${k}`, v]),
  ];

  const completedTripsList = (data?.completedTripsFinancials || []).map((t) => ({
    id: t.tracking_id,
    route: `${t.source} → ${t.destination}`,
    vehicle: t.vehicle_registration,
    driver: t.driver_name,
    distance: num(t.planned_distance),
    fuel_liters: num(t.fuel_consumed_liters),
    primaryRev: num(t.primary_revenue),
    sharedRev: num(t.shared_cargo_revenue),
    totalRev: num(t.total_revenue),
    fuelCost: num(t.fuel_cost),
    netProfit: num(t.net_profit),
    margin: `${num(t.profit_margin_pct)}%`,
    date: t.completed_at ? new Date(t.completed_at).toLocaleDateString('en-IN') : '—'
  }));

  const totRev = completedTripsList.reduce((a, r) => a + r.totalRev, 0);
  const totProfit = completedTripsList.reduce((a, r) => a + r.netProfit, 0);

  const tripTotals = {
    id: `Total (${completedTripsList.length} trips)`,
    route: '',
    vehicle: '',
    driver: '',
    distance: completedTripsList.reduce((a, r) => a + r.distance, 0),
    fuel_liters: completedTripsList.reduce((a, r) => a + r.fuel_liters, 0),
    primaryRev: completedTripsList.reduce((a, r) => a + r.primaryRev, 0),
    sharedRev: completedTripsList.reduce((a, r) => a + r.sharedRev, 0),
    totalRev: totRev,
    fuelCost: completedTripsList.reduce((a, r) => a + r.fuelCost, 0),
    netProfit: totProfit,
    margin: totRev > 0 ? `${((totProfit / totRev) * 100).toFixed(1)}%` : '0%',
    date: ''
  };

  const costs = (data?.operationalCosts || []).map((c) => ({
    vehicle: c.registration_number,
    model: c.model_name,
    acquisition: num(c.acquisition_cost),
    fuel: num(c.total_fuel_cost),
    maintenance: num(c.total_maintenance_cost),
    expenses: num(c.total_expense_cost),
    total: num(c.total_operational_cost),
    sharedProfit: num(c.shared_profit),
    netProfit: num(c.net_profit),
    ratio: Number(assetRatio(c).toFixed(1)),
  }));
  const efficiency = (data?.fuelEfficiency || []).map((e) => ({
    vehicle: e.vehicle?.registration_number || '—',
    distance: num(e.total_distance),
    fuel: num(e.total_fuel),
    kmpl: num(e.efficiency),
  }));
  const sum = (key) => costs.reduce((a, r) => a + r[key], 0);
  const costTotals = { vehicle: `Total (${costs.length})`, acquisition: sum('acquisition'), fuel: sum('fuel'), maintenance: sum('maintenance'), expenses: sum('expenses'), total: sum('total'), sharedProfit: sum('sharedProfit'), netProfit: sum('netProfit') };
  return { summary, costs, efficiency, costTotals, completedTripsList, tripTotals };
}

export default function ReportsPage() {
  const dispatch = useDispatch();
  const { data, loading } = useSelector((state) => state.analytics);
  const role = useSelector((state) => state.auth.user?.role);

  useEffect(() => {
    dispatch(fetchDashboard());
  }, [dispatch]);

  // Goes through the API client so the auth token is sent (a plain window.open always got a 401).
  const handleExportCSV = async () => {
    try {
      const res = await analyticsService.exportCSV();
      downloadBlob(res.data, `transitops_fleet_register_${fileDate()}.csv`);
    } catch (err) {
      toast.error(err.response?.status === 403 ? 'You do not have access to this export.' : 'CSV export failed.');
    }
  };

  const runExport = async (format) => {
    const { summary, costs, efficiency, costTotals, completedTripsList, tripTotals } = reportTables(data);
    const name = `transitops_fleet_report_${fileDate()}`;
    try {
      if (format === 'xlsx') {
        const money = '₹#,##0';
        await exportExcel({
          fileName: `${name}.xlsx`,
          sheets: [
            {
              name: 'Summary', title: 'Fleet Analytics Summary',
              columns: [{ header: 'Metric', key: 'k', width: 30 }, { header: 'Value', key: 'v', width: 14 }],
              rows: summary.map(([k, v]) => ({ k, v })),
            },
            {
              name: 'Completed Trips Financials', title: 'Completed Trips Financial Performance & Settlement',
              columns: [
                { header: 'Trip ID', key: 'id', width: 16 },
                { header: 'Route', key: 'route', width: 26 },
                { header: 'Completion Date', key: 'date', width: 16 },
                { header: 'Vehicle', key: 'vehicle', width: 18 },
                { header: 'Driver', key: 'driver', width: 16 },
                { header: 'Distance (km)', key: 'distance', width: 16, numFmt: '#,##0.0' },
                { header: 'Fuel (L)', key: 'fuel_liters', width: 12, numFmt: '0.00' },
                { header: 'Primary Freight Quote', key: 'primaryRev', width: 20, numFmt: money },
                { header: 'Shared Cargo Pure Profit', key: 'sharedRev', width: 22, numFmt: money },
                { header: 'Gross Revenue', key: 'totalRev', width: 18, numFmt: money },
                { header: 'Fuel Expense', key: 'fuelCost', width: 16, numFmt: money },
                { header: 'Net Profit', key: 'netProfit', width: 18, numFmt: money },
                { header: 'Margin %', key: 'margin', width: 14 },
              ],
              rows: completedTripsList, totals: tripTotals,
            },
            {
              name: 'Operational Costs', title: 'Operational Costs by Vehicle',
              columns: [
                { header: 'Vehicle', key: 'vehicle', width: 18 }, { header: 'Model', key: 'model', width: 22 },
                { header: 'Fuel Cost', key: 'fuel', width: 14, numFmt: money }, { header: 'Maintenance Cost', key: 'maintenance', width: 18, numFmt: money },
                { header: 'Tolls & Other', key: 'expenses', width: 16, numFmt: money },
                { header: 'Total Operational Cost', key: 'total', width: 22, numFmt: money },
                { header: 'Shared Cargo Pure Profit', key: 'sharedProfit', width: 24, numFmt: money },
                { header: 'Net Margin', key: 'netProfit', width: 20, numFmt: money },
              ],
              rows: costs, totals: costTotals,
            },
            {
              name: 'Fuel Efficiency', title: 'Fuel Efficiency (completed trips)',
              columns: [
                { header: 'Vehicle', key: 'vehicle', width: 18 }, { header: 'Distance (km)', key: 'distance', width: 16, numFmt: '#,##0.0' },
                { header: 'Fuel (L)', key: 'fuel', width: 12, numFmt: '0.00' }, { header: 'Efficiency (km/L)', key: 'kmpl', width: 18, numFmt: '0.00' },
              ],
              rows: efficiency,
            },
            {
              name: 'ROI Ledger', title: 'Asset Return on Investment Ledger',
              columns: [
                { header: 'Vehicle', key: 'vehicle', width: 18 }, { header: 'Model', key: 'model', width: 22 },
                { header: 'Acquisition Cost', key: 'acquisition', width: 18, numFmt: money }, { header: 'Total Operational Cost', key: 'total', width: 22, numFmt: money },
                { header: 'Cost-to-Asset Ratio', key: 'ratio', width: 20, numFmt: '0.0"%"' },
              ],
              rows: costs, totals: costTotals,
            },
          ],
        });
      } else {
        await exportPdf({
          fileName: `${name}.pdf`,
          title: 'Fleet Analytics & Reports',
          subtitle: 'Completed trip financials, operating costs, fuel efficiency and asset ROI',
          summary: summary.map(([k, v]) => [k, String(v)]),
          sections: [
            {
              heading: 'Completed Trips Financial Settlement',
              columns: ['Trip ID', 'Route', 'Vehicle', 'Primary Rev', 'Shared Profit', 'Total Rev', 'Fuel Cost', 'Net Profit', 'Margin'],
              rows: completedTripsList.map((t) => [t.id, t.route, t.vehicle, pdfMoney(t.primaryRev), pdfMoney(t.sharedRev), pdfMoney(t.totalRev), pdfMoney(t.fuelCost), pdfMoney(t.netProfit), t.margin]),
              totals: [tripTotals.id, '', '', pdfMoney(tripTotals.primaryRev), pdfMoney(tripTotals.sharedRev), pdfMoney(tripTotals.totalRev), pdfMoney(tripTotals.fuelCost), pdfMoney(tripTotals.netProfit), tripTotals.margin],
            },
            {
              heading: 'Operational Costs by Vehicle',
              columns: ['Vehicle', 'Model', 'Fuel Cost', 'Maintenance Cost', 'Tolls & Other', 'Total Cost', 'Shared Profit', 'Net Margin'],
              rows: costs.map((r) => [r.vehicle, r.model, pdfMoney(r.fuel), pdfMoney(r.maintenance), pdfMoney(r.expenses), pdfMoney(r.total), pdfMoney(r.sharedProfit), pdfMoney(r.netProfit)]),
              totals: [costTotals.vehicle, '', pdfMoney(costTotals.fuel), pdfMoney(costTotals.maintenance), pdfMoney(costTotals.expenses), pdfMoney(costTotals.total), pdfMoney(costTotals.sharedProfit), pdfMoney(costTotals.netProfit)],
            },
            {
              heading: 'Fuel Efficiency (completed trips)',
              columns: ['Vehicle', 'Distance (km)', 'Fuel (L)', 'Efficiency (km/L)'],
              rows: efficiency.map((r) => [r.vehicle, r.distance.toLocaleString('en-IN'), r.fuel.toFixed(2), r.kmpl.toFixed(2)]),
            },
            {
              heading: 'Asset Return on Investment Ledger',
              columns: ['Vehicle', 'Model', 'Acquisition Cost', 'Total Operational Cost', 'Cost-to-Asset Ratio'],
              rows: costs.map((r) => [r.vehicle, r.model, pdfMoney(r.acquisition), pdfMoney(r.total), `${r.ratio.toFixed(1)}%`]),
            },
          ],
        });
      }
      toast.success(`${format === 'xlsx' ? 'Excel' : 'PDF'} report downloaded`);
    } catch (err) {
      console.error('Export failed:', err);
      toast.error('Export failed. Please try again.');
    }
  };

  if (loading && !data.operationalCosts.length) {
    return <LoadingSpinner />;
  }

  // Formatting data for Recharts Pie (Utilization Status)
  const vehicleStatusData = [
    { name: 'Available', value: data.vehicles.Available || 0, color: '#10B981' },
    { name: 'On Trip', value: data.vehicles['On Trip'] || 0, color: '#3B82F6' },
    { name: 'In Shop', value: data.vehicles['In Shop'] || 0, color: '#F59E0B' },
    { name: 'Retired', value: data.vehicles.Retired || 0, color: '#EF4444' }
  ].filter(v => v.value > 0);

  // Formatting Operational Cost stack
  const costBreakdownData = data.operationalCosts.map(item => ({
    name: item.registration_number,
    'Fuel Cost': parseFloat(item.total_fuel_cost),
    'Maintenance Cost': parseFloat(item.total_maintenance_cost),
    'Tolls & Other': parseFloat(item.total_expense_cost || 0)
  }));

  // Formatting Fuel Efficiency
  const efficiencyData = data.fuelEfficiency.map(item => ({
    name: item.vehicle?.registration_number || 'Veh',
    'Efficiency (KM/L)': parseFloat(item.efficiency)
  }));

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-800 flex items-center gap-3">
              <FaChartLine className="text-blue-600 text-3xl" /> Fleet Analytics & Reports
            </h1>
            <p className="text-gray-500 text-sm mt-1">Audit fleet performance, operational costs, fuel efficiency, and ROI metrics</p>
          </div>
          {canExportFinance(role) && (
            <Menu
              label="Export fleet analytics report"
              buttonLabel="Export"
              buttonIcon={BsDownload}
              items={[
                { label: 'Excel workbook (.xlsx)', icon: BsFileEarmarkExcel, onSelect: () => runExport('xlsx') },
                { label: 'PDF report', icon: BsFileEarmarkPdf, onSelect: () => runExport('pdf') },
                { label: 'Fleet register (.csv)', icon: FaFileCsv, onSelect: handleExportCSV },
              ]}
            />
          )}
        </div>

        {/* Executive Financial Highlights & Profit Settlements */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
            <div className="flex items-center justify-between pb-1">
              <span className="text-[11px] uppercase font-extrabold text-gray-400 tracking-wider">
                Delivered Gross Revenue
              </span>
              <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                {data.financialSummary?.totalCompletedTrips || 0} Trips
              </span>
            </div>
            <div className="text-2xl font-black text-gray-800 mt-2 font-mono">
              ₹{(data.financialSummary?.totalGrossRevenue || 0).toLocaleString()}
            </div>
            <p className="text-[11px] text-gray-500 mt-1.5">
              Primary: ₹{(data.financialSummary?.totalFreightRevenue || 0).toLocaleString()} · Shared: ₹{(data.financialSummary?.totalSharedCargoRevenue || 0).toLocaleString()}
            </p>
          </div>

          <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white rounded-2xl shadow-md p-5">
            <div className="flex items-center justify-between pb-1">
              <span className="text-[11px] uppercase font-extrabold tracking-wider opacity-90">
                Shared Cargo Pure Profit
              </span>
              <span className="bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                100% Margin
              </span>
            </div>
            <div className="text-2xl font-black mt-2 font-mono">
              ₹{(data.sharedCargoAnalytics?.totalPureProfit || 0).toLocaleString()}
            </div>
            <p className="text-[11px] opacity-85 mt-1.5">
              Zero additional fuel/driver cost on running transit corridors.
            </p>
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
            <div className="flex items-center justify-between pb-1">
              <span className="text-[11px] uppercase font-extrabold text-gray-400 tracking-wider">
                Trip Fuel Expense
              </span>
              <span className="bg-amber-50 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                Settled Logs
              </span>
            </div>
            <div className="text-2xl font-black text-gray-800 mt-2 font-mono">
              ₹{(data.financialSummary?.totalFuelCost || 0).toLocaleString()}
            </div>
            <p className="text-[11px] text-gray-500 mt-1.5">
              Actual fuel consumed across completed corridor trips.
            </p>
          </div>

          <div className="bg-white border border-emerald-100 rounded-2xl shadow-sm p-5 bg-gradient-to-b from-white to-emerald-50/30">
            <div className="flex items-center justify-between pb-1">
              <span className="text-[11px] uppercase font-extrabold text-emerald-800 tracking-wider">
                Net Operating Profit
              </span>
              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase">
                {data.financialSummary?.overallMarginPct || 0}% Margin
              </span>
            </div>
            <div className="text-2xl font-black text-emerald-700 mt-2 font-mono">
              +₹{(data.financialSummary?.totalNetProfit || 0).toLocaleString()}
            </div>
            <p className="text-[11px] text-emerald-600 font-medium mt-1.5">
              Gross revenue minus fuel & operational running costs.
            </p>
          </div>
        </div>

        {/* First Row of Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          {/* Pie Chart: Vehicle Status Allocation */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 flex flex-col justify-between">
            <h3 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
              <FaTruck className="text-blue-500" /> Vehicle Allocation Share
            </h3>
            {vehicleStatusData.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-12">No allocation metrics available.</p>
            ) : (
              <div className="h-64 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={vehicleStatusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {vehicleStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Bar Chart: Fuel Efficiency */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 flex flex-col justify-between">
            <h3 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
              <FaGasPump className="text-emerald-500" /> Fuel Economy Comparison (KM/L)
            </h3>
            {efficiencyData.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-12">No fuel efficiency logs completed yet.</p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={efficiencyData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" stroke="#9CA3AF" fontSize={10} tickLine={false} />
                    <YAxis stroke="#9CA3AF" fontSize={10} tickLine={false} />
                    <Tooltip />
                    <Bar dataKey="Efficiency (KM/L)" fill="#10B981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        {/* Second Row: Stacked Operational Cost Chart */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-8">
          <h3 className="text-base font-bold text-gray-800 mb-6 flex items-center gap-2">
            <FaMoneyBillWave className="text-yellow-500" /> Operating Cost Breakdown per Asset (INR)
          </h3>
          {costBreakdownData.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-12">No operational expenses logged yet.</p>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={costBreakdownData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" stroke="#9CA3AF" fontSize={10} tickLine={false} />
                  <YAxis stroke="#9CA3AF" fontSize={10} tickLine={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Fuel Cost" stackId="a" fill="#3B82F6" />
                  <Bar dataKey="Maintenance Cost" stackId="a" fill="#F59E0B" />
                  <Bar dataKey="Tolls & Other" stackId="a" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Completed Trips Financial Breakdown & Settlement Ledger */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-8 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
            <div>
              <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
                <FaRoute className="text-blue-600" /> Completed Trips Financial Settlement & Ledger
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                Audited trip revenue, 100% margin shared cargo profit, fuel expenses, and net profit per completed dispatch
              </p>
            </div>
            {data.completedTripsFinancials?.length > 0 && (
              <span className="text-xs font-mono font-bold bg-blue-50 text-blue-700 px-3 py-1 rounded-full border border-blue-200">
                {data.completedTripsFinancials.length} Settled Deliveries
              </span>
            )}
          </div>

          {!data.completedTripsFinancials || data.completedTripsFinancials.length === 0 ? (
            <div className="text-center py-12 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
              <FaRoute className="mx-auto text-3xl text-gray-300 mb-2" />
              <p className="text-gray-500 font-semibold text-sm">No completed trips settled yet</p>
              <p className="text-gray-400 text-xs mt-1 max-w-sm mx-auto">
                Once a dispatch is marked Completed by the driver or fleet manager, its complete financial ledger (freight quote, shared cargo gains, fuel logs, and net margin) will appear here instantly.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-400 text-xs font-bold uppercase tracking-wider">
                    <th className="pb-3">Trip ID & Route</th>
                    <th className="pb-3">Vehicle & Driver</th>
                    <th className="pb-3">Distance & Fuel</th>
                    <th className="pb-3">Primary Freight</th>
                    <th className="pb-3 text-emerald-700">Shared Cargo Profit</th>
                    <th className="pb-3">Gross Revenue</th>
                    <th className="pb-3 text-red-600">Fuel Cost</th>
                    <th className="pb-3 text-emerald-700">Net Profit & Margin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.completedTripsFinancials.map((trip) => {
                    const isPositive = trip.net_profit >= 0;
                    return (
                      <tr key={trip.id} className="hover:bg-gray-50 transition">
                        <td className="py-3.5">
                          <span className="font-mono font-bold text-xs bg-gray-100 text-gray-800 px-2 py-0.5 rounded">
                            {trip.tracking_id}
                          </span>
                          <div className="font-bold text-gray-800 text-xs mt-1">
                            {trip.source} <FaArrowRight className="inline text-[9px] text-gray-400 mx-1" /> {trip.destination}
                          </div>
                          {trip.completed_at && (
                            <div className="text-[10px] text-gray-400 mt-0.5">
                              {new Date(trip.completed_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5">
                          <span className="font-semibold text-gray-800 text-xs block">
                            {trip.vehicle_registration}
                          </span>
                          <span className="text-[11px] text-gray-500">
                            Driver: {trip.driver_name}
                          </span>
                        </td>
                        <td className="py-3.5 font-mono text-xs">
                          <span className="text-gray-700 block font-semibold">
                            {trip.planned_distance.toLocaleString()} km
                          </span>
                          <span className="text-gray-400 text-[11px]">
                            ⛽ {trip.fuel_consumed_liters.toLocaleString()} L
                          </span>
                        </td>
                        <td className="py-3.5 font-mono font-semibold text-gray-700">
                          ₹{trip.primary_revenue.toLocaleString()}
                        </td>
                        <td className="py-3.5 font-mono">
                          {trip.shared_cargo_revenue > 0 ? (
                            <div>
                              <span className="text-emerald-700 font-extrabold block">
                                +₹{trip.shared_cargo_revenue.toLocaleString()}
                              </span>
                              <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-sans font-bold border border-emerald-200">
                                {trip.shared_cargo_count} Shared · 100% Margin
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs">—</span>
                          )}
                        </td>
                        <td className="py-3.5 font-mono font-extrabold text-gray-900">
                          ₹{trip.total_revenue.toLocaleString()}
                        </td>
                        <td className="py-3.5 font-mono text-xs text-red-600 font-semibold">
                          -₹{trip.fuel_cost.toLocaleString()}
                        </td>
                        <td className="py-3.5 font-mono">
                          <div className={`font-black text-sm ${isPositive ? 'text-emerald-700' : 'text-red-600'}`}>
                            {isPositive ? '+' : ''}₹{trip.net_profit.toLocaleString()}
                          </div>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            isPositive ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {trip.profit_margin_pct}% Margin
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {data.completedTripsFinancials.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-gray-200 bg-gray-50 font-bold text-xs text-gray-800 font-mono">
                      <td className="py-3 px-2">Total ({data.completedTripsFinancials.length} Trips)</td>
                      <td className="py-3 px-2">—</td>
                      <td className="py-3 px-2">
                        {data.completedTripsFinancials.reduce((sum, t) => sum + t.planned_distance, 0).toLocaleString()} km
                      </td>
                      <td className="py-3 px-2">
                        ₹{(data.financialSummary?.totalFreightRevenue || 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-2 text-emerald-700">
                        +₹{(data.financialSummary?.totalSharedCargoRevenue || 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-2 text-gray-900">
                        ₹{(data.financialSummary?.totalGrossRevenue || 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-2 text-red-600">
                        -₹{(data.financialSummary?.totalFuelCost || 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-2 text-emerald-700">
                        +₹{(data.financialSummary?.totalNetProfit || 0).toLocaleString()} ({data.financialSummary?.overallMarginPct || 0}%)
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </div>

        {/* ROI Table Ledger */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 overflow-hidden">
          <h3 className="text-base font-bold text-gray-800 mb-6 flex items-center gap-2">
            <FaCoins className="text-purple-500" /> Asset Return On Investment Ledger (ROI)
          </h3>
          {data.operationalCosts.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-12">No financial operations on ledger.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-400 text-xs font-bold uppercase tracking-wider">
                    <th className="pb-3">Vehicle</th>
                    <th className="pb-3">Acquisition Cost</th>
                    <th className="pb-3">Total Operational Cost</th>
                    <th className="pb-3 text-emerald-700">Shared Cargo Profit</th>
                    <th className="pb-3">Net Profit Margin</th>
                    <th className="pb-3">Asset Value Ratio</th>
                  </tr>
                </thead>
                <tbody>
                  {data.operationalCosts.map(item => {
                    const ratio = parseFloat(item.acquisition_cost) > 0 
                      ? ((parseFloat(item.total_operational_cost) / parseFloat(item.acquisition_cost)) * 100).toFixed(1)
                      : 0;
                    return (
                      <tr key={item.vehicle_id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                        <td className="py-3.5 font-bold text-gray-700 uppercase">
                          {item.registration_number} ({item.model_name})
                        </td>
                        <td className="py-3.5 font-semibold text-gray-600">
                          ₹{parseFloat(item.acquisition_cost).toLocaleString()}
                        </td>
                        <td className="py-3.5 font-extrabold text-gray-800">
                          ₹{parseFloat(item.total_operational_cost).toLocaleString()}
                        </td>
                        <td className="py-3.5 font-bold text-emerald-700 font-mono">
                          +₹{parseFloat(item.shared_profit || 0).toLocaleString()}
                        </td>
                        <td className="py-3.5 font-mono font-bold">
                          <span className={item.net_profit >= 0 ? 'text-emerald-700' : 'text-gray-700'}>
                            {item.net_profit >= 0 ? '+' : ''}₹{parseFloat(item.net_profit || 0).toLocaleString()}
                          </span>
                        </td>
                        <td className="py-3.5">
                          <span className={`text-xs font-extrabold px-2.5 py-1 rounded-lg uppercase tracking-wide border ${
                            parseFloat(ratio) > 50 
                              ? 'bg-red-50 text-red-700 border-red-200'
                              : 'bg-green-50 text-green-700 border-green-200'
                          }`}>
                            {ratio}% Cost-to-Asset Ratio
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
