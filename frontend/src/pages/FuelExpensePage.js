import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import fuelService from '../services/fuelService';
import expenseService from '../services/expenseService';
import vehicleService from '../services/vehicleService';
import tripService from '../services/tripService';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { toast } from 'react-toastify';
import { FaGasPump, FaMoneyBillWave, FaPlus, FaFilter } from 'react-icons/fa';
import { BsDownload, BsFileEarmarkExcel, BsFileEarmarkPdf } from 'react-icons/bs';
import Menu from '../components/ui/Menu';
import { canExportFinance, exportExcel, exportPdf, fileDate, num, pdfMoney } from '../utils/reportExport';

const FUEL_COLUMNS = [
  { header: 'Vehicle', key: 'vehicle', width: 20 },
  { header: 'Litres', key: 'liters', width: 12, numFmt: '0.00' },
  { header: 'Cost (₹)', key: 'cost', width: 14, numFmt: '₹#,##0.00' },
  { header: 'Date', key: 'date', width: 14 },
];
const EXPENSE_COLUMNS = [
  { header: 'Vehicle', key: 'vehicle', width: 20 },
  { header: 'Type', key: 'type', width: 16 },
  { header: 'Description', key: 'description', width: 40 },
  { header: 'Amount (₹)', key: 'cost', width: 14, numFmt: '₹#,##0.00' },
  { header: 'Date', key: 'date', width: 14 },
];

// Rows exactly as the ledgers show them, plus totals.
function financeRows(fuelLogs, expenses) {
  const fuel = fuelLogs.map((l) => ({ vehicle: l.vehicle?.registration_number || '—', liters: num(l.liters), cost: num(l.cost), date: l.date }));
  const exp = expenses.map((e) => ({ vehicle: e.vehicle?.registration_number || '—', type: e.type, description: e.description || '—', cost: num(e.cost), date: e.date }));
  const fuelLitres = fuel.reduce((a, r) => a + r.liters, 0);
  const fuelCost = fuel.reduce((a, r) => a + r.cost, 0);
  const expCost = exp.reduce((a, r) => a + r.cost, 0);
  return { fuel, exp, fuelLitres, fuelCost, expCost };
}

export default function FuelExpensePage() {
  const role = useSelector((state) => state.auth.user?.role);
  const [activeTab, setActiveTab] = useState('fuel'); // 'fuel' or 'expense'
  const [fuelLogs, setFuelLogs] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);

  // Forms
  const [fuelForm, setFuelForm] = useState({
    vehicle_id: '',
    trip_id: '',
    liters: '',
    cost: '',
    date: new Date().toISOString().split('T')[0]
  });

  const [expenseForm, setExpenseForm] = useState({
    vehicle_id: '',
    type: 'tolls',
    cost: '',
    date: new Date().toISOString().split('T')[0],
    description: ''
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [fRes, eRes, vRes, tRes] = await Promise.all([
        fuelService.getAll(),
        expenseService.getAll(),
        vehicleService.getAll(),
        tripService.getAll()
      ]);
      setFuelLogs(fRes.data.data);
      setExpenses(eRes.data.data);
      setVehicles(vRes.data.data);
      setTrips(tRes.data.data.filter(t => t.status === 'Completed' || t.status === 'Dispatched'));
    } catch (err) {
      toast.error('Failed to load transaction registers');
    } finally {
      setLoading(false);
    }
  };

  const runExport = async (format) => {
    const { fuel, exp, fuelLitres, fuelCost, expCost } = financeRows(fuelLogs, expenses);
    const name = `fulmile_fuel_expenses_${fileDate()}`;
    try {
      if (format === 'xlsx') {
        await exportExcel({
          fileName: `${name}.xlsx`,
          sheets: [
            { name: 'Fuel Register', title: 'Fuel Register', columns: FUEL_COLUMNS, rows: fuel, totals: { vehicle: `Total (${fuel.length})`, liters: fuelLitres, cost: fuelCost } },
            { name: 'Expense Register', title: 'Expense Register', columns: EXPENSE_COLUMNS, rows: exp, totals: { vehicle: `Total (${exp.length})`, cost: expCost } },
          ],
        });
      } else {
        await exportPdf({
          fileName: `${name}.pdf`,
          title: 'Fleet Transactions',
          subtitle: 'Fuel receipts and trip expenditures',
          summary: [
            ['Fuel entries', String(fuel.length)],
            ['Total litres', `${fuelLitres.toFixed(2)} L`],
            ['Total fuel spend', pdfMoney(fuelCost)],
            ['Expense entries', String(exp.length)],
            ['Total expenses', pdfMoney(expCost)],
          ],
          sections: [
            {
              heading: 'Fuel Register',
              columns: ['Vehicle', 'Litres', 'Cost', 'Date'],
              rows: fuel.map((r) => [r.vehicle, `${r.liters.toFixed(2)} L`, pdfMoney(r.cost), r.date]),
              totals: [`Total (${fuel.length})`, `${fuelLitres.toFixed(2)} L`, pdfMoney(fuelCost), ''],
            },
            {
              heading: 'Expense Register',
              columns: ['Vehicle', 'Type', 'Description', 'Amount', 'Date'],
              rows: exp.map((r) => [r.vehicle, r.type, r.description, pdfMoney(r.cost), r.date]),
              totals: [`Total (${exp.length})`, '', '', pdfMoney(expCost), ''],
            },
          ],
        });
      }
      toast.success(`${format === 'xlsx' ? 'Excel' : 'PDF'} export downloaded`);
    } catch (err) {
      console.error('Export failed:', err);
      toast.error('Export failed. Please try again.');
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleFuelSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = { ...fuelForm };
      if (!data.trip_id) delete data.trip_id; // optional trip link
      await fuelService.create(data);
      toast.success('Fuel log recorded');
      setFuelForm({
        vehicle_id: '',
        trip_id: '',
        liters: '',
        cost: '',
        date: new Date().toISOString().split('T')[0]
      });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record fuel log');
    }
  };

  const handleExpenseSubmit = async (e) => {
    e.preventDefault();
    try {
      await expenseService.create(expenseForm);
      toast.success('Expense transaction recorded');
      setExpenseForm({
        vehicle_id: '',
        type: 'tolls',
        cost: '',
        date: new Date().toISOString().split('T')[0],
        description: ''
      });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record expense');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-800 flex items-center gap-3">
              <FaGasPump className="text-blue-600 text-3xl" /> Fleet Transactions
            </h1>
            <p className="text-gray-500 text-sm mt-1">Audit vehicle fuel receipts and trip expenditures</p>
          </div>
          {canExportFinance(role) && (
            <Menu
              label="Export fuel and expense registers"
              buttonLabel="Export"
              buttonIcon={BsDownload}
              items={[
                { label: 'Excel workbook (.xlsx)', icon: BsFileEarmarkExcel, onSelect: () => runExport('xlsx') },
                { label: 'PDF report', icon: BsFileEarmarkPdf, onSelect: () => runExport('pdf') },
              ]}
            />
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-8 border-b">
          <button
            onClick={() => setActiveTab('fuel')}
            className={`pb-3 font-bold text-sm flex items-center gap-2 transition ${
              activeTab === 'fuel'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <FaGasPump /> Fuel Register
          </button>
          <button
            onClick={() => setActiveTab('expense')}
            className={`pb-3 font-bold text-sm flex items-center gap-2 transition ${
              activeTab === 'expense'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <FaMoneyBillWave /> Expense Register
          </button>
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Input Forms Column */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 h-fit">
              <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2 border-b border-gray-50 pb-3">
                <FaPlus className="text-blue-600" /> Log Transaction
              </h3>

              {activeTab === 'fuel' ? (
                <form onSubmit={handleFuelSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Select Vehicle</label>
                    <select
                      required
                      value={fuelForm.vehicle_id}
                      onChange={(e) => setFuelForm({ ...fuelForm, vehicle_id: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg p-3 text-sm outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-700 bg-white"
                    >
                      <option value="">Select vehicle...</option>
                      {vehicles.map(v => (
                        <option key={v.id} value={v.id}>{v.registration_number} ({v.model_name})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Link Trip (Optional)</label>
                    <select
                      value={fuelForm.trip_id}
                      onChange={(e) => setFuelForm({ ...fuelForm, trip_id: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg p-3 text-sm outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-700 bg-white"
                    >
                      <option value="">No trip link...</option>
                      {trips.map(t => (
                        <option key={t.id} value={t.id}>{t.source} ➔ {t.destination}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Liters filled</label>
                      <input
                        required
                        type="number"
                        step="0.01"
                        placeholder="e.g. 25"
                        value={fuelForm.liters}
                        onChange={(e) => setFuelForm({ ...fuelForm, liters: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg p-3 text-sm outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Receipt Cost (₹)</label>
                      <input
                        required
                        type="number"
                        placeholder="e.g. 2500"
                        value={fuelForm.cost}
                        onChange={(e) => setFuelForm({ ...fuelForm, cost: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg p-3 text-sm outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Transaction Date</label>
                    <input
                      required
                      type="date"
                      value={fuelForm.date}
                      onChange={(e) => setFuelForm({ ...fuelForm, date: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg p-3 text-sm outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-700 bg-white"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg text-sm transition shadow-sm"
                  >
                    Save Log
                  </button>
                </form>
              ) : (
                <form onSubmit={handleExpenseSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Select Vehicle</label>
                    <select
                      required
                      value={expenseForm.vehicle_id}
                      onChange={(e) => setExpenseForm({ ...expenseForm, vehicle_id: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg p-3 text-sm outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-700 bg-white"
                    >
                      <option value="">Select vehicle...</option>
                      {vehicles.map(v => (
                        <option key={v.id} value={v.id}>{v.registration_number} ({v.model_name})</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Expense Type</label>
                      <select
                        required
                        value={expenseForm.type}
                        onChange={(e) => setExpenseForm({ ...expenseForm, type: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg p-3 text-sm outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-700 bg-white"
                      >
                        <option value="tolls">Tolls</option>
                        <option value="maintenance">Maintenance</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Amount (₹)</label>
                      <input
                        required
                        type="number"
                        placeholder="e.g. 500"
                        value={expenseForm.cost}
                        onChange={(e) => setExpenseForm({ ...expenseForm, cost: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg p-3 text-sm outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Date</label>
                    <input
                      required
                      type="date"
                      value={expenseForm.date}
                      onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg p-3 text-sm outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-700 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Description / Memo</label>
                    <textarea
                      name="description"
                      value={expenseForm.description}
                      onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                      rows="2"
                      placeholder="e.g. NH4 Highway Toll receipt"
                      className="w-full border border-gray-300 rounded-lg p-3 text-sm outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg text-sm transition shadow-sm"
                  >
                    Record Expense
                  </button>
                </form>
              )}
            </div>

            {/* List Tables Column */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-6 overflow-hidden">
              <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2 border-b border-gray-50 pb-3">
                <FaFilter className="text-blue-600" /> Transaction Register Ledger
              </h3>

              {activeTab === 'fuel' ? (
                fuelLogs.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-12">No fuel entries logged.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead>
                        <tr className="border-b border-gray-100 text-gray-400 text-xs font-bold uppercase tracking-wider">
                          <th className="pb-3">Vehicle</th>
                          <th className="pb-3">Liters</th>
                          <th className="pb-3">Cost</th>
                          <th className="pb-3">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fuelLogs.map(log => (
                          <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                            <td className="py-3.5 font-bold text-gray-700 uppercase">{log.vehicle?.registration_number}</td>
                            <td className="py-3.5 font-semibold text-gray-600">{log.liters} L</td>
                            <td className="py-3.5 font-extrabold text-gray-800">₹{parseFloat(log.cost).toLocaleString()}</td>
                            <td className="py-3.5 text-gray-400 font-semibold">{log.date}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              ) : (
                expenses.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-12">No expense entries logged.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead>
                        <tr className="border-b border-gray-100 text-gray-400 text-xs font-bold uppercase tracking-wider">
                          <th className="pb-3">Vehicle</th>
                          <th className="pb-3">Type</th>
                          <th className="pb-3">Description</th>
                          <th className="pb-3">Amount</th>
                          <th className="pb-3">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {expenses.map(exp => (
                          <tr key={exp.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                            <td className="py-3.5 font-bold text-gray-700 uppercase">{exp.vehicle?.registration_number}</td>
                            <td className="py-3.5"><span className="text-xs font-bold bg-gray-100 text-gray-600 px-2.5 py-1 rounded-lg uppercase tracking-wide border border-gray-200">{exp.type}</span></td>
                            <td className="py-3.5 text-gray-500 font-medium max-w-xs truncate">{exp.description || '—'}</td>
                            <td className="py-3.5 font-extrabold text-gray-800">₹{parseFloat(exp.cost).toLocaleString()}</td>
                            <td className="py-3.5 text-gray-400 font-semibold">{exp.date}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
