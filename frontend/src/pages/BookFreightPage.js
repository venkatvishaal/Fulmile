import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import PageHeader from '../components/ui/PageHeader';
import freightBookingService from '../services/freightBookingService';
import { calculateRouteDistance, estimateFuelLiters } from '../utils/distanceCalculator';
import {
  BsBoxSeam, BsGeoAlt, BsArrowRight, BsFuelPump,
  BsSpeedometer2, BsCheckCircle, BsCalendarDate, BsClock
} from 'react-icons/bs';

const CARGO_TYPES = [
  'General Goods',
  'Perishable / Cold Storage',
  'Fragile / Electronics',
  'Heavy Industrial',
  'Chemicals / Hazardous',
  'Automotive Parts'
];

export default function BookFreightPage() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    pickup_address: '',
    delivery_address: '',
    cargo_type: 'General Goods',
    cargo_description: '',
    cargo_weight: '',
    preferred_pickup_date: '',
    preferred_delivery_date: '',
    notes: ''
  });

  // Automated Route & Fuel State
  const [routeCalc, setRouteCalc] = useState(null);
  const [calcLoading, setCalcLoading] = useState(false);

  // Debounce auto-calculate distance & fuel when pickup and delivery are entered
  useEffect(() => {
    const pickup = form.pickup_address.trim();
    const delivery = form.delivery_address.trim();

    if (pickup.length < 3 || delivery.length < 3) {
      setRouteCalc(null);
      return;
    }

    const timer = setTimeout(async () => {
      setCalcLoading(true);
      try {
        const result = await calculateRouteDistance(pickup, delivery);
        if (result && result.distanceKm > 0) {
          const weight = parseFloat(form.cargo_weight) || 500;
          const fuel = estimateFuelLiters(result.distanceKm, 'truck', weight);
          setRouteCalc({
            distanceKm: result.distanceKm,
            durationMinutes: result.durationMinutes,
            fuelLiters: fuel,
            isRoadRoute: result.isRoadRoute
          });
        }
      } catch (err) {
        console.warn('Calculation error:', err);
      } finally {
        setCalcLoading(false);
      }
    }, 700);

    return () => clearTimeout(timer);
  }, [form.pickup_address, form.delivery_address, form.cargo_weight]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.pickup_address || !form.delivery_address || !form.cargo_weight) {
      toast.error('Please enter pickup, delivery address, and cargo weight');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ...form,
        cargo_weight: parseFloat(form.cargo_weight),
        estimated_distance_km: routeCalc?.distanceKm || null,
        estimated_fuel_liters: routeCalc?.fuelLiters || null
      };

      const res = await freightBookingService.create(payload);
      toast.success(`Booking created! Shipment ID: ${res.data.data.shipment_id}`);
      navigate('/my-bookings');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create booking');
    } finally {
      setSubmitting(false);
    }
  };

  const formatHours = (mins) => {
    if (!mins) return '';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m} mins`;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Book Freight Cargo"
        subtitle="Request freight transport across carrier networks with automated distance and fuel calculation."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Booking Form */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit} className="card p-6 space-y-6">
            <div className="border-b border-line pb-3">
              <h3 className="text-base font-bold text-ink flex items-center gap-2">
                <BsGeoAlt className="text-signal text-lg" />
                Transit Route
              </h3>
              <p className="text-xs text-muted">Enter origin and destination to compute route distance and fuel automatically.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="pickup_address" className="label">Pickup Location / City *</label>
                <input
                  id="pickup_address"
                  type="text"
                  name="pickup_address"
                  value={form.pickup_address}
                  onChange={handleChange}
                  required
                  placeholder="e.g. Mumbai Port Terminal"
                  className="field py-2.5"
                />
              </div>

              <div>
                <label htmlFor="delivery_address" className="label">Delivery Location / City *</label>
                <input
                  id="delivery_address"
                  type="text"
                  name="delivery_address"
                  value={form.delivery_address}
                  onChange={handleChange}
                  required
                  placeholder="e.g. Pune Logistics Park"
                  className="field py-2.5"
                />
              </div>
            </div>

            {/* Live Calculation Banner */}
            {calcLoading && (
              <div className="rounded-lg bg-surface/70 border border-line p-3 flex items-center gap-3 text-xs text-muted animate-pulse">
                <BsSpeedometer2 className="text-signal animate-spin text-base" />
                Calculating road transit distance & fuel requirement...
              </div>
            )}

            {routeCalc && !calcLoading && (
              <div className="rounded-xl border border-signal/30 bg-signal/5 p-4">
                <div className="flex items-center justify-between pb-2 border-b border-signal/15">
                  <span className="font-mono text-[11px] font-bold text-ink uppercase tracking-wider flex items-center gap-1.5">
                    <BsCheckCircle className="text-signal text-sm" /> Automated Route Estimate
                  </span>
                  <span className="text-[10px] text-muted font-mono">
                    {routeCalc.isRoadRoute ? 'OSRM Driving Geometry' : 'Geodesic Calculation'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-4 pt-3">
                  <div>
                    <p className="text-[11px] text-muted flex items-center gap-1"><BsArrowRight /> Distance</p>
                    <p className="text-lg font-bold text-ink">{routeCalc.distanceKm} <span className="text-xs font-normal text-muted">km</span></p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted flex items-center gap-1"><BsFuelPump /> Est. Fuel</p>
                    <p className="text-lg font-bold text-ink">{routeCalc.fuelLiters} <span className="text-xs font-normal text-muted">Liters</span></p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted flex items-center gap-1"><BsClock /> Est. Duration</p>
                    <p className="text-lg font-bold text-ink">{formatHours(routeCalc.durationMinutes)}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Cargo Details */}
            <div className="border-b border-line pb-3 pt-2">
              <h3 className="text-base font-bold text-ink flex items-center gap-2">
                <BsBoxSeam className="text-signal text-lg" />
                Cargo Manifest
              </h3>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="cargo_type" className="label">Cargo Type *</label>
                <select
                  id="cargo_type"
                  name="cargo_type"
                  value={form.cargo_type}
                  onChange={handleChange}
                  className="field py-2.5"
                >
                  {CARGO_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="cargo_weight" className="label">Cargo Weight (kg) *</label>
                <input
                  id="cargo_weight"
                  type="number"
                  step="0.01"
                  min="0.1"
                  name="cargo_weight"
                  value={form.cargo_weight}
                  onChange={handleChange}
                  required
                  placeholder="e.g. 1500"
                  className="field py-2.5"
                />
              </div>
            </div>

            <div>
              <label htmlFor="cargo_description" className="label">Cargo Description <span className="normal-case text-muted font-normal">(optional)</span></label>
              <textarea
                id="cargo_description"
                name="cargo_description"
                value={form.cargo_description}
                onChange={handleChange}
                rows={2}
                placeholder="Brief description of items, packaging, or special handling notes..."
                className="field py-2.5"
              />
            </div>

            {/* Schedule */}
            <div className="grid gap-4 sm:grid-cols-2 pt-2">
              <div>
                <label htmlFor="preferred_pickup_date" className="label flex items-center gap-1.5">
                  <BsCalendarDate /> Preferred Pickup Date
                </label>
                <input
                  id="preferred_pickup_date"
                  type="date"
                  name="preferred_pickup_date"
                  value={form.preferred_pickup_date}
                  onChange={handleChange}
                  className="field py-2.5"
                />
              </div>
              <div>
                <label htmlFor="preferred_delivery_date" className="label flex items-center gap-1.5">
                  <BsCalendarDate /> Preferred Delivery Date
                </label>
                <input
                  id="preferred_delivery_date"
                  type="date"
                  name="preferred_delivery_date"
                  value={form.preferred_delivery_date}
                  onChange={handleChange}
                  className="field py-2.5"
                />
              </div>
            </div>

            <div>
              <label htmlFor="notes" className="label">Additional Notes</label>
              <input
                id="notes"
                type="text"
                name="notes"
                value={form.notes}
                onChange={handleChange}
                placeholder="Gate entry instructions, contact person on delivery, etc."
                className="field py-2.5"
              />
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="btn btn-primary px-8 py-3 font-semibold text-sm shadow-sm"
              >
                {submitting ? 'Submitting Booking Request...' : 'Submit Freight Booking'}
              </button>
            </div>
          </form>
        </div>

        {/* Right Info Sidebar */}
        <div className="space-y-4">
          <div className="card p-5 space-y-3 bg-surface">
            <h4 className="font-bold text-sm text-ink">How Freight Booking Works</h4>
            <ul className="space-y-2.5 text-xs text-muted">
              <li className="flex items-start gap-2">
                <span className="h-5 w-5 rounded-full bg-signal/20 text-signal flex items-center justify-center font-bold text-[11px] shrink-0">1</span>
                <span>Enter origin, destination & cargo details. Route distance and fuel estimate are computed automatically.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="h-5 w-5 rounded-full bg-signal/20 text-signal flex items-center justify-center font-bold text-[11px] shrink-0">2</span>
                <span>You receive an immediate <strong>Shipment ID</strong> (e.g. <code>SHP-2026-XXXX</code>).</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="h-5 w-5 rounded-full bg-signal/20 text-signal flex items-center justify-center font-bold text-[11px] shrink-0">3</span>
                <span>A carrier reviews capacity, submits a price quote, and assigns your shipment to an active transit corridor.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="h-5 w-5 rounded-full bg-signal/20 text-signal flex items-center justify-center font-bold text-[11px] shrink-0">4</span>
                <span>Once dispatched, stream live GPS tracking on the interactive map tracker with 1 click.</span>
              </li>
            </ul>
          </div>

          <div className="card p-5 border-emerald-200 bg-emerald-50/60">
            <div className="flex items-center gap-2 mb-2">
              <span className="p-1.5 rounded-md bg-emerald-600 text-white text-xs">
                <BsBoxSeam />
              </span>
              <h5 className="font-bold text-xs text-emerald-950 uppercase tracking-wider">
                Lower Cost Shared Cargo
              </h5>
            </div>
            <p className="text-xs text-muted mb-3">
              Need to ship smaller cargo loads? Search vehicles already running along your route with free cargo capacity and book instantly at shared rates.
            </p>
            <button
              type="button"
              onClick={() => navigate('/shared-search')}
              className="btn btn-primary btn-sm w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            >
              Browse Shared Cargo Routes
            </button>
          </div>

          <div className="card p-5 border-signal/20 bg-signal/5">
            <h5 className="font-semibold text-xs text-ink uppercase tracking-wider mb-2">Live Public Tracking</h5>
            <p className="text-xs text-muted mb-3">Anyone with your Shipment ID can track cargo directly on the public tracking portal without logging in.</p>
            <button
              type="button"
              onClick={() => navigate('/track')}
              className="btn btn-secondary btn-sm w-full"
            >
              Open Live Tracker
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
