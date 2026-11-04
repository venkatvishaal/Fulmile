import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import PageHeader from '../components/ui/PageHeader';
import StatusBadge from '../components/ui/StatusBadge';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import Modal from '../components/ui/Modal';
import freightBookingService from '../services/freightBookingService';
import tripService from '../services/tripService';
import {
  BsBoxSeam, BsArrowRight, BsCheck2Circle,
  BsCashCoin, BsTruck, BsPlayCircle, BsCheckCircle
} from 'react-icons/bs';

export default function FreightRequestsPage() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');

  // Quote modal
  const [quoteModal, setQuoteModal] = useState(null);
  const [quotePrice, setQuotePrice] = useState('');
  const [quoteSubmitting, setQuoteSubmitting] = useState(false);

  // Merge into active trip modal (Single Dispatch Rule)
  const [mergeModal, setMergeModal] = useState(null);
  const [activeTrips, setActiveTrips] = useState([]);
  const [selectedTripId, setSelectedTripId] = useState('');
  const [mergePriceQuote, setMergePriceQuote] = useState('');
  const [mergeSubmitting, setMergeSubmitting] = useState(false);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const res = await freightBookingService.listAvailable();
      setRequests(res.data.data || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load freight requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const handleOpenQuote = (req) => {
    setQuoteModal(req);
    setQuotePrice(req.price_quote || '');
  };

  const handleSendQuote = async (e) => {
    e.preventDefault();
    if (!quotePrice || parseFloat(quotePrice) <= 0) {
      toast.error('Please enter a valid price quote');
      return;
    }
    setQuoteSubmitting(true);
    try {
      await freightBookingService.setQuote(quoteModal.id, parseFloat(quotePrice));
      toast.success(`Price quote sent for ${quoteModal.shipment_id}`);
      setQuoteModal(null);
      loadRequests();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit quote');
    } finally {
      setQuoteSubmitting(false);
    }
  };

  const handleOpenMerge = async (req) => {
    setMergeModal(req);
    setSelectedTripId('');
    if (req.price_quote && parseFloat(req.price_quote) > 0) {
      setMergePriceQuote(req.price_quote);
    } else {
      const dist = parseFloat(req.estimated_distance_km) || 500;
      const weight = parseFloat(req.cargo_weight) || 100;
      const estPrice = Math.round(Math.max(2500, (weight * 6) + (dist * 4)));
      setMergePriceQuote(estPrice);
    }
    try {
      // Load active or draft trips for merging
      const res = await tripService.getAll();
      const eligible = (res.data.data || []).filter(t => t.status === 'Dispatched' || t.status === 'Draft');
      setActiveTrips(eligible);
    } catch (err) {
      toast.error('Failed to load active fleet trips');
    }
  };

  const handleConfirmMerge = async (e) => {
    e.preventDefault();
    if (!selectedTripId) {
      toast.error('Please choose a trip to carry this cargo');
      return;
    }
    if (!mergePriceQuote || parseFloat(mergePriceQuote) <= 0) {
      toast.error('Please enter an agreed price quote for this shared cargo');
      return;
    }
    setMergeSubmitting(true);
    try {
      const res = await freightBookingService.accept(mergeModal.id, selectedTripId, parseFloat(mergePriceQuote));
      toast.success(res.data.message || 'Cargo merged into active trip successfully (No duplicate dispatch created)');
      setMergeModal(null);
      loadRequests();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to merge cargo');
    } finally {
      setMergeSubmitting(false);
    }
  };

  const filteredRequests = requests.filter(r => {
    if (statusFilter === 'all') return true;
    return r.status === statusFilter;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Freight Cargo Requests"
        subtitle="Review incoming freight from shippers, submit price quotes, or merge shared cargo onto active transit corridors."
        actions={
          <div className="flex items-center gap-1.5 bg-surface border border-line rounded-lg p-1 text-xs">
            {['all', 'Pending', 'Quoted', 'Accepted', 'In Transit', 'Delivered'].map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setStatusFilter(tab)}
                className={`px-3 py-1.5 rounded-md font-semibold capitalize transition ${
                  statusFilter === tab
                    ? 'bg-ink text-paper shadow-sm'
                    : 'text-muted hover:text-ink'
                }`}
              >
                {tab === 'all' ? 'All Requests' : tab}
                {tab !== 'all' && (
                  <span className="ml-1.5 opacity-75 text-[10px] font-mono">
                    ({requests.filter(r => r.status === tab).length})
                  </span>
                )}
              </button>
            ))}
          </div>
        }
      />

      {loading ? (
        <div className="py-20 flex justify-center">
          <LoadingSpinner size="lg" />
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="card p-12 text-center space-y-3">
          <div className="h-12 w-12 rounded-full bg-surface border border-line flex items-center justify-center mx-auto text-muted">
            <BsBoxSeam className="text-xl" />
          </div>
          <h4 className="font-bold text-base text-ink">
            {statusFilter === 'all' ? 'No freight requests' : `No ${statusFilter.toLowerCase()} requests`}
          </h4>
          <p className="text-xs text-muted max-w-sm mx-auto">
            {statusFilter === 'all'
              ? 'When shippers submit freight cargo requests, they will appear here for pricing and route assignment.'
              : `There are currently no requests in "${statusFilter}" status.`}
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-line bg-surface/50 font-mono uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-4 py-3">Shipment ID</th>
                  <th className="px-4 py-3">Shipper</th>
                  <th className="px-4 py-3">Route</th>
                  <th className="px-4 py-3">Weight & Distance</th>
                  <th className="px-4 py-3">Quote</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filteredRequests.map((r) => (
                  <tr key={r.id} className="hover:bg-surface/30 transition-colors">
                    <td className="px-4 py-3.5 font-mono font-bold text-ink">
                      <span>{r.shipment_id}</span>
                      <span className="text-[10px] text-muted block font-normal">
                        {new Date(r.created_at).toLocaleDateString()}
                      </span>
                    </td>

                    <td className="px-4 py-3.5">
                      <p className="font-semibold text-ink">{r.shipper?.name || 'Shipper'}</p>
                      <p className="text-[11px] text-muted">{r.shipper?.company_name || r.shipper?.email}</p>
                    </td>

                    <td className="px-4 py-3.5 max-w-xs">
                      <p className="font-semibold text-ink truncate">{r.pickup_address}</p>
                      <div className="flex items-center gap-1 text-[11px] text-muted">
                        <BsArrowRight className="text-signal" />
                        <span className="truncate">{r.delivery_address}</span>
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <p className="font-mono font-bold text-ink">{parseFloat(r.cargo_weight).toLocaleString()} kg</p>
                      {r.estimated_distance_km && (
                        <p className="text-[11px] text-muted">{r.estimated_distance_km} km ({r.estimated_fuel_liters || 0}L fuel)</p>
                      )}
                    </td>

                    <td className="px-4 py-3.5 font-mono">
                      {r.price_quote && parseFloat(r.price_quote) > 0 ? (
                        <span className="font-bold text-ink text-[13px]">₹{parseFloat(r.price_quote).toLocaleString()}</span>
                      ) : (
                        <span className="text-muted text-[11px]">Unquoted</span>
                      )}
                    </td>

                    <td className="px-4 py-3.5">
                      <StatusBadge status={r.status} />
                    </td>

                    <td className="px-4 py-3.5 text-right space-x-2 whitespace-nowrap">
                      {r.status === 'Accepted' && !r.trip_id && (
                        <button
                          type="button"
                          onClick={() => navigate('/trips')}
                          className="btn btn-primary btn-xs inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                          title="Open Trips page to assign vehicle & driver"
                        >
                          <BsPlayCircle className="text-xs" /> Dispatch in Trips
                        </button>
                      )}

                      {['Pending', 'Quoted'].includes(r.status) && (
                        <button
                          type="button"
                          onClick={() => handleOpenQuote(r)}
                          className="btn btn-secondary btn-xs"
                        >
                          <BsCashCoin className="mr-1" /> {r.status === 'Quoted' ? 'Update Quote' : 'Quote'}
                        </button>
                      )}

                      {['Pending', 'Quoted', 'Accepted'].includes(r.status) && !r.trip_id && (
                        <button
                          type="button"
                          onClick={() => handleOpenMerge(r)}
                          className="btn btn-ghost btn-xs inline-flex items-center gap-1 text-ink border border-line"
                          title="Merge onto active route (Single Dispatch Rule)"
                        >
                          <BsTruck className="text-xs" /> Merge on Route
                        </button>
                      )}

                      {r.status === 'In Transit' && (
                        <span className="text-xs font-semibold text-sky-700 bg-sky-50 px-2.5 py-1 rounded border border-sky-200 inline-flex items-center gap-1">
                          <BsTruck className="text-xs" /> Active on Route
                        </span>
                      )}

                      {r.status === 'Delivered' && (
                        <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200 inline-flex items-center gap-1">
                          <BsCheckCircle className="text-xs" /> Delivered
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Quote Modal */}
      {quoteModal && (
        <Modal
          isOpen={!!quoteModal}
          onClose={() => setQuoteModal(null)}
          title={`Submit Price Quote · ${quoteModal.shipment_id}`}
        >
          <form onSubmit={handleSendQuote} className="space-y-4 pt-2">
            <div>
              <p className="text-xs text-muted mb-2">
                Route: <strong>{quoteModal.pickup_address}</strong> ➔ <strong>{quoteModal.delivery_address}</strong>
                <br />Weight: <strong>{quoteModal.cargo_weight} kg</strong>
                {quoteModal.estimated_distance_km && ` | Distance: ~${quoteModal.estimated_distance_km} km`}
              </p>
            </div>

            <div>
              <label htmlFor="quote-price" className="label">Total Price Quote (₹) *</label>
              <input
                id="quote-price"
                type="number"
                step="0.01"
                min="1"
                value={quotePrice}
                onChange={(e) => setQuotePrice(e.target.value)}
                required
                placeholder="e.g. 12500"
                className="field py-2.5 text-base font-mono"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setQuoteModal(null)} className="btn btn-secondary btn-sm">
                Cancel
              </button>
              <button type="submit" disabled={quoteSubmitting} className="btn btn-primary btn-sm">
                {quoteSubmitting ? 'Sending...' : 'Send Quote to Shipper'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Merge on Route Modal (Single Dispatch Rule) */}
      {mergeModal && (
        <Modal
          isOpen={!!mergeModal}
          onClose={() => setMergeModal(null)}
          title={`Assign to Running Fleet · ${mergeModal.shipment_id}`}
        >
          <form onSubmit={handleConfirmMerge} className="space-y-4 pt-2">
            <div className="rounded-lg bg-surface p-3 text-xs text-muted space-y-1">
              <p className="font-semibold text-ink">Single Dispatch Rule:</p>
              <p>Attaching this cargo ({mergeModal.cargo_weight} kg) will update the existing trip in-place. No duplicate trip or separate dispatch is created.</p>
            </div>

            <div>
              <label htmlFor="active-trip-select" className="label">Select Active Dispatched Trip *</label>
              <select
                id="active-trip-select"
                value={selectedTripId}
                onChange={(e) => setSelectedTripId(e.target.value)}
                required
                className="field py-2.5"
              >
                <option value="">-- Choose an active transit corridor --</option>
                {activeTrips.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.tracking_id || t.id.slice(0, 8)} | {t.source} ➔ {t.destination} ({t.vehicle?.registration_number || 'Truck'}) - [{t.status}]
                  </option>
                ))}
              </select>
              {activeTrips.length === 0 && (
                <p className="error-text">No active dispatched trips available right now. Please create or dispatch a trip first.</p>
              )}
            </div>

            <div>
              <label htmlFor="merge-price-quote" className="label">Shared Cargo Price Quote (₹) *</label>
              <input
                id="merge-price-quote"
                type="number"
                min="100"
                step="50"
                value={mergePriceQuote}
                onChange={(e) => setMergePriceQuote(e.target.value)}
                required
                className="field py-2.5 font-mono text-base font-semibold"
                placeholder="e.g. 3500"
              />
              <p className="text-[11px] text-muted mt-1">
                Agreed price quote for this shared shipment. Immediately sets and confirms the price on the shipper's booking.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setMergeModal(null)} className="btn btn-secondary btn-sm">
                Cancel
              </button>
              <button
                type="submit"
                disabled={mergeSubmitting || !selectedTripId}
                className="btn btn-primary btn-sm inline-flex items-center gap-1.5"
              >
                <BsCheck2Circle /> {mergeSubmitting ? 'Merging...' : 'Confirm & Merge Cargo'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
