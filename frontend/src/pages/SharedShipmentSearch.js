import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import api from '../services/api';
import PageHeader from '../components/ui/PageHeader';
import Modal from '../components/ui/Modal';
import { calculateRouteDistance, estimateFuelLiters } from '../utils/distanceCalculator';
import {
  BsSearch,
  BsTruck,
  BsGeoAltFill,
  BsFillInboxFill,
  BsBoxSeam,
  BsSignpostSplitFill,
  BsCheckCircleFill,
  BsCalendarEventFill,
  BsCurrencyRupee,
  BsArrowRight,
  BsFuelPump,
  BsClock,
  BsCheckCircle,
  BsSpeedometer2
} from 'react-icons/bs';

export default function SharedShipmentSearch() {
  const [searchParams, setSearchParams] = useState({
    pickup: '',
    destination: '',
    weight: ''
  });
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(null);
  const [searched, setSearched] = useState(false);

  // Search Bar Live Route & Fuel Estimate
  const [searchRouteCalc, setSearchRouteCalc] = useState(null);
  const [searchCalcLoading, setSearchCalcLoading] = useState(false);

  // Booking modal
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [bookingForm, setBookingForm] = useState({
    pickup_location: '',
    delivery_location: '',
    weight: '',
    planned_distance: '',
    price_quote: ''
  });
  const [modalRouteCalc, setModalRouteCalc] = useState(null);
  const [modalCalcLoading, setModalCalcLoading] = useState(false);

  const formatHours = (mins) => {
    if (!mins) return '';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m} mins`;
  };

  // Debounced distance & fuel preview on the search form
  useEffect(() => {
    const p = (searchParams.pickup || '').trim();
    const d = (searchParams.destination || '').trim();
    if (p.length < 3 || d.length < 3) {
      setSearchRouteCalc(null);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchCalcLoading(true);
      try {
        const result = await calculateRouteDistance(p, d);
        if (result && result.distanceKm > 0) {
          const w = parseFloat(searchParams.weight) || 100;
          const fuel = estimateFuelLiters(result.distanceKm, 'truck', w);
          setSearchRouteCalc({
            distanceKm: result.distanceKm,
            durationMinutes: result.durationMinutes,
            fuelLiters: fuel,
            isRoadRoute: result.isRoadRoute
          });
        }
      } catch (err) {
        console.warn('Search distance calc error:', err);
      } finally {
        setSearchCalcLoading(false);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [searchParams.pickup, searchParams.destination, searchParams.weight]);

  // Debounced distance & fuel auto-calculator inside the modal based on pickup & destination
  useEffect(() => {
    if (!showBookingModal || !selectedRoute) return;
    const p = (bookingForm.pickup_location || '').trim();
    const d = (bookingForm.delivery_location || '').trim();
    if (p.length < 3 || d.length < 3) return;

    const timer = setTimeout(async () => {
      setModalCalcLoading(true);
      try {
        const result = await calculateRouteDistance(p, d);
        if (result && result.distanceKm > 0) {
          const w = parseFloat(bookingForm.weight) || 100;
          const fuel = estimateFuelLiters(result.distanceKm, 'truck', w);
          setModalRouteCalc({
            distanceKm: result.distanceKm,
            durationMinutes: result.durationMinutes,
            fuelLiters: fuel,
            isRoadRoute: result.isRoadRoute
          });
          setBookingForm(prev => ({
            ...prev,
            planned_distance: String(result.distanceKm),
            price_quote: (parseFloat(selectedRoute.price_per_kg) * w).toFixed(2)
          }));
        }
      } catch (err) {
        console.warn('Modal distance calc error:', err);
      } finally {
        setModalCalcLoading(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [bookingForm.pickup_location, bookingForm.delivery_location, bookingForm.weight, showBookingModal, selectedRoute]);

  const handleSearch = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSearched(true);
    try {
      const res = await api.get('/vehicles/search', { params: searchParams });
      setResults(res.data.data || []);
      if ((res.data.data || []).length === 0) {
        toast.info('No active fleet vehicles found on this corridor with available capacity.');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const openBookingModal = async (route) => {
    setSelectedRoute(route);
    const pickupLoc = searchParams.pickup || route.source;
    const destLoc = searchParams.destination || route.destination;
    const weightVal = searchParams.weight || '100';

    setBookingForm({
      pickup_location: pickupLoc,
      delivery_location: destLoc,
      weight: weightVal,
      planned_distance: '',
      price_quote: (parseFloat(route.price_per_kg) * parseFloat(weightVal)).toFixed(2)
    });
    setModalRouteCalc(null);
    setShowBookingModal(true);

    // Initial distance calculation
    try {
      setModalCalcLoading(true);
      const calc = await calculateRouteDistance(pickupLoc, destLoc);
      if (calc && calc.distanceKm > 0) {
        const w = parseFloat(weightVal) || 100;
        const fuel = estimateFuelLiters(calc.distanceKm, 'truck', w);
        setModalRouteCalc({
          distanceKm: calc.distanceKm,
          durationMinutes: calc.durationMinutes,
          fuelLiters: fuel,
          isRoadRoute: calc.isRoadRoute
        });
        setBookingForm(prev => ({
          ...prev,
          planned_distance: String(calc.distanceKm),
          price_quote: (parseFloat(route.price_per_kg) * w).toFixed(2)
        }));
      }
    } catch (e) {
      console.warn('Initial calc failed:', e);
    } finally {
      setModalCalcLoading(false);
    }
  };

  const handleBook = async (e) => {
    e.preventDefault();
    if (!selectedRoute) return;

    if (!bookingForm.pickup_location || !bookingForm.delivery_location) {
      toast.error('Please specify pickup and destination locations for this cargo');
      return;
    }

    if (!bookingForm.planned_distance || parseFloat(bookingForm.planned_distance) <= 0) {
      toast.error('Please enter a valid planned distance');
      return;
    }

    setBookingLoading(selectedRoute.route_id);
    try {
      const res = await api.post('/vehicles/shared-booking', {
        route_id: selectedRoute.route_id,
        pickup_location: bookingForm.pickup_location,
        delivery_location: bookingForm.delivery_location,
        weight: bookingForm.weight,
        planned_distance: bookingForm.planned_distance,
        price_quote: bookingForm.price_quote || undefined
      });
      toast.success(res.data.message || 'Shared space booked successfully! Check your shipments.');
      setResults(results.filter(r => r.route_id !== selectedRoute.route_id));
      setShowBookingModal(false);
      setSelectedRoute(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Booking failed');
    } finally {
      setBookingLoading(null);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('en-IN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Shared Cargo Corridors"
        subtitle="Search verified carrier vehicles already running your route and book free cargo space with automated distance & fuel calculation."
      />

      {/* ── SEARCH CARD ── */}
      <div className="card p-6 bg-surface border border-line shadow-sm space-y-4">
        <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label htmlFor="pickup-city" className="label">Pickup City *</label>
            <div className="relative">
              <BsGeoAltFill className="absolute left-3 top-3 text-signal text-sm" />
              <input
                id="pickup-city"
                required
                placeholder="e.g. Mumbai"
                className="field pl-9 py-2.5 text-sm"
                value={searchParams.pickup}
                onChange={e => setSearchParams({ ...searchParams, pickup: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label htmlFor="dest-city" className="label">Destination City *</label>
            <div className="relative">
              <BsGeoAltFill className="absolute left-3 top-3 text-emerald-600 text-sm" />
              <input
                id="dest-city"
                required
                placeholder="e.g. Chennai"
                className="field pl-9 py-2.5 text-sm"
                value={searchParams.destination}
                onChange={e => setSearchParams({ ...searchParams, destination: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label htmlFor="cargo-weight" className="label">Cargo Weight (KG) *</label>
            <div className="relative">
              <BsFillInboxFill className="absolute left-3 top-3 text-muted text-sm" />
              <input
                id="cargo-weight"
                required
                type="number"
                min="0.1"
                step="0.1"
                placeholder="e.g. 250"
                className="field pl-9 py-2.5 text-sm font-mono"
                value={searchParams.weight}
                onChange={e => setSearchParams({ ...searchParams, weight: e.target.value })}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary py-2.5 font-semibold text-sm flex items-center justify-center gap-2 shadow-sm"
          >
            {loading ? (
              <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <>
                <BsSearch /> Search Capacity
              </>
            )}
          </button>
        </form>

        {/* Live Search Route Distance Preview */}
        {searchCalcLoading && (
          <div className="rounded-lg bg-surface-subtle border border-line p-2.5 flex items-center gap-2 text-xs text-muted animate-pulse">
            <BsSpeedometer2 className="text-signal animate-spin" />
            Calculating road transit distance between {searchParams.pickup} and {searchParams.destination}...
          </div>
        )}

        {searchRouteCalc && !searchCalcLoading && (
          <div className="rounded-lg bg-signal/5 border border-signal/25 px-3 py-2 flex items-center justify-between text-xs flex-wrap gap-2">
            <span className="font-semibold text-ink flex items-center gap-1.5">
              <BsCheckCircle className="text-signal" />
              Distance: <strong className="font-mono text-signal">{searchRouteCalc.distanceKm} km</strong>
            </span>
            <span className="text-muted flex items-center gap-1">
              <BsFuelPump className="text-[11px]" /> Est. Fuel: <strong className="font-mono text-ink">{searchRouteCalc.fuelLiters} L</strong>
            </span>
            <span className="text-muted flex items-center gap-1">
              <BsClock className="text-[11px]" /> Duration: <strong className="font-mono text-ink">{formatHours(searchRouteCalc.durationMinutes)}</strong>
            </span>
            <span className="text-[10px] text-muted font-mono opacity-80">
              {searchRouteCalc.isRoadRoute ? 'OSRM Driving Geometry' : 'Geodesic Estimate'}
            </span>
          </div>
        )}
      </div>

      {/* ── RESULTS ── */}
      {searched && !loading && results.length === 0 && (
        <div className="card p-12 text-center bg-surface border border-line">
          <BsTruck className="mx-auto text-5xl text-muted/40 mb-3" />
          <h4 className="font-semibold text-ink text-base">No Matching Vehicles Found</h4>
          <p className="text-sm text-muted mt-1 max-w-md mx-auto">
            No running fleet vehicles currently have available capacity on this exact corridor. You can also submit a standard booking under "Book freight".
          </p>
        </div>
      )}

      <div className="space-y-4">
        {results.map((route) => (
          <div
            key={route.route_id}
            className="card p-5 bg-surface border border-line hover:border-signal/40 transition-all shadow-sm"
          >
            <div className="flex flex-col md:flex-row justify-between gap-6">
              {/* Route Info */}
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-surface-subtle text-signal">
                    <BsTruck className="text-xl" />
                  </div>
                  <div>
                    <p className="font-bold text-ink">{route.vehicle.registration_number}</p>
                    <p className="text-xs text-muted">{route.vehicle.model_name} • {route.vehicle.vehicle_type}</p>
                  </div>
                  <span className={`ml-auto px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                    route.vehicle.status === 'On Trip' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {route.vehicle.status === 'On Trip' ? 'En Route' : route.vehicle.status}
                  </span>
                </div>

                {/* Route path visualization */}
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <span className="bg-ink text-paper px-2.5 py-1 rounded font-bold">{route.source}</span>
                  {(route.intermediate_points || []).map((pt, i) => (
                    <React.Fragment key={i}>
                      <BsArrowRight className="text-muted" />
                      <span className="bg-surface-subtle border border-line text-ink px-2 py-0.5 rounded font-medium">{pt}</span>
                    </React.Fragment>
                  ))}
                  <BsArrowRight className="text-muted" />
                  <span className="bg-signal text-ink px-2.5 py-1 rounded font-bold">{route.destination}</span>
                </div>

                {/* Meta details */}
                <div className="flex gap-5 text-xs text-muted">
                  <span className="flex items-center gap-1.5">
                    <BsCalendarEventFill className="text-signal" />
                    Departs: {formatDate(route.departure_time)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <BsCheckCircleFill className="text-emerald-600" />
                    Arrives: {formatDate(route.estimated_arrival)}
                  </span>
                </div>
              </div>

              {/* Pricing and Capacity */}
              <div className="flex flex-col items-end justify-between min-w-[200px] border-t md:border-t-0 md:border-l border-line md:pl-6 pt-4 md:pt-0">
                <div className="text-right mb-2">
                  <p className="text-[10px] font-bold text-muted uppercase tracking-wider">Price per KG</p>
                  <p className="text-2xl font-black text-ink flex items-center justify-end gap-0.5">
                    <BsCurrencyRupee className="text-signal text-xl" />
                    {parseFloat(route.price_per_kg).toFixed(2)}
                  </p>
                  <p className="text-xs text-muted mt-0.5 font-mono">
                    Est. total: ₹{(parseFloat(route.price_per_kg) * parseFloat(searchParams.weight || 100)).toLocaleString()}
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-muted uppercase">Free Space</p>
                    <p className="font-bold text-emerald-700 text-sm flex items-center gap-1">
                      <BsBoxSeam />
                      {route.remaining_capacity} kg
                    </p>
                  </div>
                  <button
                    onClick={() => openBookingModal(route)}
                    disabled={bookingLoading === route.route_id}
                    className="btn btn-primary btn-sm px-4 py-2 font-bold"
                  >
                    {bookingLoading === route.route_id ? 'Booking...' : 'Book Space'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── BOOKING MODAL WITH AUTOMATED DISTANCE & FUEL CALCULATION ── */}
      {showBookingModal && selectedRoute && (
        <Modal
          isOpen={showBookingModal}
          onClose={() => { setShowBookingModal(false); setSelectedRoute(null); }}
          title="Book Shared Space on Transit Corridor"
          description={`${selectedRoute.vehicle.registration_number} • Corridor: ${selectedRoute.source} ➔ ${selectedRoute.destination}`}
          size="lg"
        >
          <form onSubmit={handleBook} className="space-y-4">
            {/* Cargo Route Specifics */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="modal-pickup" className="label">Shared Cargo Pickup Place *</label>
                <div className="relative">
                  <BsGeoAltFill className="absolute left-3 top-3 text-signal text-sm" />
                  <input
                    id="modal-pickup"
                    required
                    placeholder="e.g. Mumbai"
                    className="field pl-9 py-2.5 text-sm"
                    value={bookingForm.pickup_location}
                    onChange={e => setBookingForm({ ...bookingForm, pickup_location: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="modal-delivery" className="label">Shared Cargo Destination Place *</label>
                <div className="relative">
                  <BsGeoAltFill className="absolute left-3 top-3 text-emerald-600 text-sm" />
                  <input
                    id="modal-delivery"
                    required
                    placeholder="e.g. Chennai"
                    className="field pl-9 py-2.5 text-sm"
                    value={bookingForm.delivery_location}
                    onChange={e => setBookingForm({ ...bookingForm, delivery_location: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Automated Route Distance & Fuel Banner */}
            {modalCalcLoading && (
              <div className="rounded-lg bg-surface-subtle border border-line p-3 flex items-center gap-3 text-xs text-muted animate-pulse">
                <BsSpeedometer2 className="text-signal animate-spin text-base" />
                Calculating road distance & fuel for {bookingForm.pickup_location} ➔ {bookingForm.delivery_location}...
              </div>
            )}

            {modalRouteCalc && !modalCalcLoading && (
              <div className="rounded-xl border border-signal/30 bg-signal/5 p-3.5">
                <div className="flex items-center justify-between pb-2 border-b border-signal/15 text-[11px]">
                  <span className="font-bold text-ink flex items-center gap-1.5 uppercase tracking-wide">
                    <BsCheckCircle className="text-signal" /> Calculated for {bookingForm.pickup_location} ➔ {bookingForm.delivery_location}
                  </span>
                  <span className="font-mono text-muted text-[10px]">
                    {modalRouteCalc.isRoadRoute ? 'OSRM Driving Geometry' : 'Geodesic Calculation'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3 pt-2.5">
                  <div>
                    <p className="text-[11px] text-muted flex items-center gap-1"><BsArrowRight /> Distance</p>
                    <p className="text-base font-bold text-ink">{modalRouteCalc.distanceKm} <span className="text-xs font-normal text-muted">km</span></p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted flex items-center gap-1"><BsFuelPump /> Est. Fuel</p>
                    <p className="text-base font-bold text-ink">{modalRouteCalc.fuelLiters} <span className="text-xs font-normal text-muted">Liters</span></p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted flex items-center gap-1"><BsClock /> Est. Duration</p>
                    <p className="text-base font-bold text-ink">{formatHours(modalRouteCalc.durationMinutes)}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="modal-cargo-weight" className="label">Cargo Weight (KG) *</label>
                <div className="relative">
                  <BsFillInboxFill className="absolute left-3 top-3 text-muted text-sm" />
                  <input
                    id="modal-cargo-weight"
                    type="number"
                    min="0.1"
                    step="0.1"
                    required
                    className="field pl-9 py-2.5 font-mono"
                    value={bookingForm.weight}
                    onChange={e => setBookingForm({ ...bookingForm, weight: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="modal-distance" className="label">Planned Route Distance (KM) *</label>
                <div className="relative">
                  <BsSignpostSplitFill className="absolute left-3 top-3 text-muted text-sm" />
                  <input
                    id="modal-distance"
                    type="number"
                    min="1"
                    step="0.1"
                    required
                    placeholder="e.g. 150"
                    className="field pl-9 py-2.5 font-mono font-semibold"
                    value={bookingForm.planned_distance}
                    onChange={e => setBookingForm({ ...bookingForm, planned_distance: e.target.value })}
                  />
                </div>
                <p className="text-[10px] text-muted mt-1">Auto-calculated from your pickup & destination.</p>
              </div>
            </div>

            <div>
              <label htmlFor="modal-price" className="label">Agreed Shared Price Quote (₹) *</label>
              <div className="relative">
                <BsCurrencyRupee className="absolute left-3 top-3 text-signal text-sm" />
                <input
                  id="modal-price"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  className="field pl-9 py-2.5 font-mono font-bold text-base"
                  value={bookingForm.price_quote}
                  onChange={e => setBookingForm({ ...bookingForm, price_quote: e.target.value })}
                />
              </div>
              <p className="text-[11px] text-muted mt-1">
                Calculated from carrier rate (₹{selectedRoute.price_per_kg}/kg) × {bookingForm.weight} kg.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-line">
              <button
                type="button"
                onClick={() => { setShowBookingModal(false); setSelectedRoute(null); }}
                className="btn btn-secondary btn-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={bookingLoading === selectedRoute.route_id}
                className="btn btn-primary btn-sm font-bold inline-flex items-center gap-1.5"
              >
                {bookingLoading === selectedRoute.route_id ? 'Booking...' : 'Confirm Shared Booking'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
