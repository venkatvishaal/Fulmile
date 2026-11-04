import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import PageHeader from '../components/ui/PageHeader';
import StatusBadge from '../components/ui/StatusBadge';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { CopyButton } from '../components/ui/CopyButton';
import freightBookingService from '../services/freightBookingService';
import {
  BsBoxSeam, BsPlus, BsGeoAlt, BsArrowRight,
  BsFuelPump, BsCashCoin, BsCheckCircle
} from 'react-icons/bs';

export default function MyBookingsPage() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadBookings = async () => {
    setLoading(true);
    try {
      const res = await freightBookingService.list();
      setBookings(res.data.data || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load bookings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBookings();
  }, []);

  const handleCancel = async (id) => {
    if (!window.confirm('Cancel this freight booking?')) return;
    try {
      await freightBookingService.cancel(id);
      toast.success('Booking cancelled');
      loadBookings();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to cancel booking');
    }
  };

  const handleAcceptQuote = async (booking) => {
    if (!window.confirm(`Accept carrier price quote of ₹${parseFloat(booking.price_quote).toLocaleString()} for shipment ${booking.shipment_id}? This confirms your cargo order for carrier dispatch.`)) {
      return;
    }
    try {
      const res = await freightBookingService.acceptQuote(booking.id);
      toast.success(res.data?.message || 'Quote accepted! Your order is confirmed and scheduled for dispatch.');
      loadBookings();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to accept quote');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Freight Shipments"
        subtitle="Manage your cargo requests, view price quotes, and track real-time delivery status."
        actions={
          <Link to="/book-freight" className="btn btn-primary btn-sm flex items-center gap-1.5">
            <BsPlus className="text-base" /> Book New Cargo
          </Link>
        }
      />

      {loading ? (
        <div className="py-20 flex justify-center">
          <LoadingSpinner size="lg" />
        </div>
      ) : bookings.length === 0 ? (
        <div className="card p-12 text-center space-y-4">
          <div className="h-14 w-14 rounded-full bg-surface border border-line flex items-center justify-center mx-auto text-muted">
            <BsBoxSeam className="text-2xl" />
          </div>
          <div>
            <h4 className="font-bold text-base text-ink">No shipments booked yet</h4>
            <p className="text-xs text-muted mt-1 max-w-sm mx-auto">
              Create your first freight cargo booking to receive instant distance calculations and carrier quotes.
            </p>
          </div>
          <Link to="/book-freight" className="btn btn-primary btn-sm inline-flex items-center gap-1.5">
            <BsPlus /> Book Cargo Now
          </Link>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-line bg-surface/50 font-mono uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-4 py-3">Shipment ID</th>
                  <th className="px-4 py-3">Route (Origin ➔ Dest)</th>
                  <th className="px-4 py-3">Cargo Spec</th>
                  <th className="px-4 py-3">Distance & Fuel</th>
                  <th className="px-4 py-3">Price Quote</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {bookings.map((b) => (
                  <tr key={b.id} className="hover:bg-surface/30 transition-colors">
                    <td className="px-4 py-3.5 font-mono font-bold text-ink">
                      <div className="flex items-center gap-1.5">
                        <span>{b.shipment_id}</span>
                        <CopyButton value={b.shipment_id} label="Copy ID" />
                      </div>
                      <span className="text-[10px] font-normal text-muted block mt-0.5">
                        {new Date(b.created_at).toLocaleDateString()}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 max-w-xs">
                      <p className="font-semibold text-ink truncate">{b.pickup_address}</p>
                      <div className="flex items-center gap-1 text-[11px] text-muted">
                        <BsArrowRight className="text-signal" />
                        <span className="truncate">{b.delivery_address}</span>
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <span className="font-medium text-ink block">{b.cargo_type}</span>
                      <span className="text-[11px] text-muted font-mono">{parseFloat(b.cargo_weight).toLocaleString()} kg</span>
                    </td>

                    <td className="px-4 py-3.5">
                      {b.estimated_distance_km ? (
                        <div className="space-y-0.5 text-[11px]">
                          <span className="text-ink font-semibold">{b.estimated_distance_km} km</span>
                          {b.estimated_fuel_liters && (
                            <span className="text-muted block flex items-center gap-1">
                              <BsFuelPump className="text-[10px]" /> {b.estimated_fuel_liters} L
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3.5 font-mono">
                      {b.price_quote && parseFloat(b.price_quote) > 0 ? (
                        <span className="font-bold text-ink flex items-center gap-1 text-[13px]">
                          <BsCashCoin className="text-signal" /> ₹{parseFloat(b.price_quote).toLocaleString()}
                        </span>
                      ) : (b.trip_id || ['Accepted', 'In Transit', 'Delivered'].includes(b.status)) ? (
                        <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[11px] inline-flex items-center gap-1 border border-emerald-200">
                          Shared Cargo (Agreed)
                        </span>
                      ) : (
                        <span className="text-muted text-[11px]">Awaiting Quote</span>
                      )}
                    </td>

                    <td className="px-4 py-3.5">
                      <StatusBadge status={b.status} />
                    </td>

                    <td className="px-4 py-3.5 text-right space-x-2 whitespace-nowrap">
                      {b.status === 'Quoted' && (
                        <button
                          type="button"
                          onClick={() => handleAcceptQuote(b)}
                          className="btn btn-primary btn-xs inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                          title="Accept carrier quote and confirm order"
                        >
                          <BsCheckCircle className="text-xs" /> Accept Quote
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => navigate(`/track/${b.shipment_id}`)}
                        className="btn btn-secondary btn-xs inline-flex items-center gap-1"
                        title="Live GPS Tracking"
                      >
                        <BsGeoAlt className="text-signal" /> Track
                      </button>

                      {['Pending', 'Quoted'].includes(b.status) && (
                        <button
                          type="button"
                          onClick={() => handleCancel(b.id)}
                          className="btn btn-ghost btn-xs text-rose-500 hover:text-rose-600"
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
