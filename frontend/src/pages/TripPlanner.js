import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchTrips, createTrip, dispatchTrip, completeTrip, cancelTrip, clearValidationErrors } from '../redux/slices/tripSlice';
import vehicleService from '../services/vehicleService';
import driverService from '../services/driverService';
import StatusBadge from '../components/ui/StatusBadge';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import Modal from '../components/ui/Modal';
import PayloadGauge from '../components/ui/PayloadGauge';
import { toast } from 'react-toastify';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import api from '../services/api';
import freightBookingService from '../services/freightBookingService';
import { io } from 'socket.io-client';
import { FaRoute, FaPlus, FaCheck, FaBan, FaPlay, FaArrowRight, FaGasPump, FaTachometerAlt, FaShareAlt, FaMapMarkerAlt, FaBroadcastTower, FaStop, FaCopy, FaExternalLinkAlt, FaBoxOpen } from 'react-icons/fa';
import { calculateRouteDistance, estimateFuelLiters } from '../utils/distanceCalculator';

// Custom truck icon SVG data-URL
const truckIconSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">
  <circle cx="24" cy="24" r="22" fill="#2563eb" stroke="white" stroke-width="3"/>
  <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" font-size="22" fill="white">🚛</text>
</svg>`;
const truckIconUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(truckIconSvg)}`;

export default function TripPlanner() {
  const dispatch = useDispatch();
  const { list: trips, loading } = useSelector((state) => state.trips);
  
  // Local state for dropdown options
  const [eligibleVehicles, setEligibleVehicles] = useState([]);
  const [eligibleDrivers, setEligibleDrivers] = useState([]);
  
  // Accepted freight orders ready for dispatch
  const [acceptedOrders, setAcceptedOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(null); // stores active trip object
  
  const [form, setForm] = useState({
    source: '',
    destination: '',
    vehicle_id: '',
    driver_id: '',
    cargo_weight: '',
    planned_distance: '',
    estimated_fuel_liters: '',
    booking_id: null
  });
  const [routeCalc, setRouteCalc] = useState(null);
  const [calcLoading, setCalcLoading] = useState(false);

  const [completeForm, setCompleteForm] = useState({
    final_odometer: '',
    fuel_consumed_liters: ''
  });

  // Share Capacity modal
  const [showShareModal, setShowShareModal] = useState(null);
  const [shareForm, setShareForm] = useState({
    source: '',
    destination: '',
    intermediate_points: '',
    departure_time: '',
    estimated_arrival: '',
    price_per_kg: ''
  });
  const [shareLoading, setShareLoading] = useState(false);

  // Live Tracking checkpoint modal
  const [showTrackingModal, setShowTrackingModal] = useState(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [trackingForm, setTrackingForm] = useState({
    location: '',
    latitude: '',
    longitude: '',
    status: 'in_transit',
    notes: ''
  });
  const [trackingLoading, setTrackingLoading] = useState(false);

  // Live continuous GPS streaming state
  const [liveTrip, setLiveTrip] = useState(null);  // which trip is being streamed
  const liveSocketRef = useRef(null);
  const watchIdRef = useRef(null);

  // Live Location Map Modal for Carrier
  const [showMapModal, setShowMapModal] = useState(null);
  const modalMapDivRef = useRef(null);
  const modalMapRef = useRef(null);
  const modalMarkerRef = useRef(null);
  const modalPolylineRef = useRef(null);
  const [modalCheckpoints, setModalCheckpoints] = useState([]);
  const [modalLoading, setModalLoading] = useState(false);

  const openLiveMapModal = useCallback(async (trip) => {
    setShowMapModal(trip);
    setModalLoading(true);
    try {
      const res = await api.get(`/tracking/${trip.id}`);
      setModalCheckpoints(res.data.data?.checkpoints || []);
    } catch (err) {
      console.warn('Failed to load tracking history:', err);
      setModalCheckpoints([]);
    } finally {
      setModalLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!showMapModal || !modalMapDivRef.current) return;

    if (modalMapRef.current) {
      modalMapRef.current.remove();
      modalMapRef.current = null;
      modalMarkerRef.current = null;
      modalPolylineRef.current = null;
    }

    if (modalMapDivRef.current._leaflet_id) {
      modalMapDivRef.current._leaflet_id = null;
    }

    const map = L.map(modalMapDivRef.current, { zoomControl: true }).setView(
      [20.5937, 78.9629],
      5
    );

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);

    modalMapRef.current = map;

    setTimeout(() => {
      if (modalMapRef.current) modalMapRef.current.invalidateSize();
    }, 150);

    const validCps = modalCheckpoints
      .map(cp => ({ ...cp, lat: parseFloat(cp.latitude), lng: parseFloat(cp.longitude) }))
      .filter(c => !isNaN(c.lat) && !isNaN(c.lng));

    if (validCps.length > 0) {
      const sorted = [...validCps].reverse();
      const coords = sorted.map(c => [c.lat, c.lng]);

      if (coords.length > 1) {
        modalPolylineRef.current = L.polyline(coords, {
          color: '#3B82F6',
          weight: 4,
          opacity: 0.8
        }).addTo(map);
      }

      const latest = validCps[0];
      const icon = L.icon({
        iconUrl: truckIconUrl,
        iconSize: [44, 44],
        iconAnchor: [22, 22],
        popupAnchor: [0, -22]
      });

      modalMarkerRef.current = L.marker([latest.lat, latest.lng], { icon }).addTo(map);
      modalMarkerRef.current
        .bindPopup(`<strong>📍 ${latest.location}</strong><br/>${latest.lat.toFixed(4)}, ${latest.lng.toFixed(4)}`)
        .openPopup();
      map.flyTo([latest.lat, latest.lng], 12);
    }

    return () => {
      if (modalMapRef.current) {
        modalMapRef.current.remove();
        modalMapRef.current = null;
        modalMarkerRef.current = null;
        modalPolylineRef.current = null;
      }
    };
  }, [showMapModal, modalCheckpoints]);

  // ── Reverse geocode helper (city name from lat/lng) ──────────
  const reverseGeocode = useCallback(async (lat, lng) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10`
      );
      const data = await res.json();
      return (
        data.address?.city ||
        data.address?.town ||
        data.address?.village ||
        data.address?.county ||
        data.display_name?.split(',')[0] ||
        'Current Location'
      );
    } catch {
      return 'Current Location';
    }
  }, []);

  // ── Open modal and auto-fetch real GPS ───────────────────────
  const openTrackingModal = useCallback(async (trip) => {
    setShowTrackingModal(trip);
    setTrackingForm({ location: '', latitude: '', longitude: '', status: 'in_transit', notes: '' });
    setGpsLoading(true);

    if (!navigator.geolocation) {
      toast.warning('Geolocation not supported by your browser.');
      setGpsLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const cityName = await reverseGeocode(latitude, longitude);
        setTrackingForm(prev => ({
          ...prev,
          latitude: latitude.toFixed(6),
          longitude: longitude.toFixed(6),
          location: cityName
        }));
        setGpsLoading(false);
      },
      (err) => {
        console.warn('GPS error:', err.message);
        toast.warning('Could not fetch GPS. Please enter location manually.');
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [reverseGeocode]);

  // ── Start Live Tracking (continuous GPS stream via socket) ───
  const startLiveTracking = useCallback((trip) => {
    if (liveTrip) {
      toast.info('Already live tracking another trip. Stop it first.');
      return;
    }
    if (!navigator.geolocation) {
      toast.error('Geolocation not supported.');
      return;
    }

    const socketUrl = process.env.REACT_APP_API_BASE_URL
      ? process.env.REACT_APP_API_BASE_URL.replace('/api', '')
      : 'http://localhost:5000';

    const socket = io(socketUrl);
    socket.emit('join', trip.id);
    liveSocketRef.current = socket;

    // Watch position and emit every update
    watchIdRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const { latitude, longitude, speed } = pos.coords;
        const cityName = await reverseGeocode(latitude, longitude);
        socket.emit('driverLocation', {
          trip_id: trip.id,
          latitude,
          longitude,
          location: cityName,
          speed: speed ? Math.round(speed * 3.6) : null // m/s → km/h
        });
      },
      (err) => {
        console.error('Live GPS error:', err);
        toast.error('GPS stream interrupted: ' + err.message);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    );

    setLiveTrip(trip);
    toast.success(`🔴 Live tracking started for ${trip.source} → ${trip.destination}`);
  }, [liveTrip, reverseGeocode]);

  // ── Stop Live Tracking ────────────────────────────────────────
  const stopLiveTracking = useCallback(() => {
    // Also runs on unmount; stay quiet when tracking was never started.
    if (watchIdRef.current === null && !liveSocketRef.current) return;
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (liveSocketRef.current) {
      liveSocketRef.current.disconnect();
      liveSocketRef.current = null;
    }
    setLiveTrip(null);
    toast.info('⏹ Live tracking stopped.');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopLiveTracking();
  }, [stopLiveTracking]);

  const selectedVehicleObj = eligibleVehicles.find(v => v.id === form.vehicle_id);

  const loadAcceptedOrders = useCallback(async () => {
    try {
      const res = await freightBookingService.getAcceptedForDispatch();
      setAcceptedOrders(res.data.data || []);
    } catch (err) {
      console.warn('Failed to load accepted freight orders:', err);
    }
  }, []);

  const handleDispatchFreightOrder = (order) => {
    setSelectedOrder(order);
    setForm({
      source: order.pickup_address || '',
      destination: order.delivery_address || '',
      vehicle_id: '',
      driver_id: '',
      cargo_weight: order.cargo_weight?.toString() || '',
      planned_distance: order.estimated_distance_km?.toString() || '',
      estimated_fuel_liters: order.estimated_fuel_liters?.toString() || '',
      booking_id: order.id
    });
    if (order.estimated_distance_km) {
      setRouteCalc({
        distanceKm: parseFloat(order.estimated_distance_km),
        fuelLiters: parseFloat(order.estimated_fuel_liters || 0)
      });
    }
    setShowAddModal(true);
  };

  useEffect(() => {
    dispatch(fetchTrips());
    loadAcceptedOrders();

    const socketUrl = process.env.REACT_APP_API_BASE_URL
      ? process.env.REACT_APP_API_BASE_URL.replace('/api', '')
      : 'http://localhost:5000';
    const s = io(socketUrl);
    s.on('fleet:update', () => {
      dispatch(fetchTrips());
      loadAcceptedOrders();
    });
    return () => s.disconnect();
  }, [dispatch, loadAcceptedOrders]);

  const loadEligibleOptions = async () => {
    try {
      const [vRes, dRes] = await Promise.all([
        vehicleService.getEligibleForDispatch(),
        driverService.getEligibleForDispatch()
      ]);
      setEligibleVehicles(vRes.data.data);
      setEligibleDrivers(dRes.data.data);
    } catch (err) {
      console.error('Failed to load eligible options:', err);
    }
  };

  useEffect(() => {
    if (showAddModal) {
      loadEligibleOptions();
      dispatch(clearValidationErrors());
    }
  }, [showAddModal, dispatch]);

  
  // Auto-calculate distance and fuel when source and destination are entered
  useEffect(() => {
    const src = (form.source || '').trim();
    const dst = (form.destination || '').trim();
    if (src.length < 3 || dst.length < 3) {
      setRouteCalc(null);
      return;
    }
    const timer = setTimeout(async () => {
      setCalcLoading(true);
      try {
        const res = await calculateRouteDistance(src, dst);
        if (res && res.distanceKm > 0) {
          const vObj = eligibleVehicles.find(v => v.id === form.vehicle_id);
          const fuel = estimateFuelLiters(res.distanceKm, vObj?.vehicle_type || 'truck', parseFloat(form.cargo_weight) || 0);
          setRouteCalc({ ...res, fuelLiters: fuel });
          setForm(prev => ({
            ...prev,
            planned_distance: res.distanceKm.toString(),
            estimated_fuel_liters: fuel.toString()
          }));
        }
      } catch (e) {
        console.warn(e);
      } finally {
        setCalcLoading(false);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [form.source, form.destination, form.vehicle_id, form.cargo_weight, eligibleVehicles]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const res = await dispatch(createTrip(form));
    if (createTrip.fulfilled.match(res)) {
      toast.success(selectedOrder ? `Dispatch created for freight order ${selectedOrder.shipment_id}` : 'Trip created as Draft');
      setShowAddModal(false);
      setSelectedOrder(null);
      setForm({
        source: '',
        destination: '',
        vehicle_id: '',
        driver_id: '',
        cargo_weight: '',
        planned_distance: '',
        estimated_fuel_liters: '',
        booking_id: null
      });
      loadAcceptedOrders();
      dispatch(fetchTrips());
    } else {
      const errMsg = res.payload;
      if (errMsg && errMsg.message) {
        toast.error(errMsg.message);
      }
    }
  };

  const handleDispatch = async (id) => {
    const res = await dispatch(dispatchTrip(id));
    if (dispatchTrip.fulfilled.match(res)) {
      toast.success(res.meta.message || 'Trip dispatched successfully. Vehicle & Driver status updated.');
      dispatch(fetchTrips());
    } else {
      toast.error(res.payload || 'Failed to dispatch');
    }
  };

  const handleCancel = async (id) => {
    if (window.confirm('Cancel this trip?')) {
      const res = await dispatch(cancelTrip(id));
      if (cancelTrip.fulfilled.match(res)) {
        toast.success('Trip cancelled successfully.');
      } else {
        toast.error(res.payload || 'Failed to cancel');
      }
    }
  };

  const handleCompleteSubmit = async (e) => {
    e.preventDefault();
    const trip = showCompleteModal;
    const res = await dispatch(completeTrip({ id: trip.id, data: completeForm }));
    if (completeTrip.fulfilled.match(res)) {
      toast.success(res.meta.message || 'Trip completed successfully. Vehicle odometer & logs updated.');
      setShowCompleteModal(null);
      setCompleteForm({ final_odometer: '', fuel_consumed_liters: '' });
      dispatch(fetchTrips());
    } else {
      const errMsg = res.payload;
      toast.error(errMsg?.message || 'Failed to complete trip');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-800 flex items-center gap-3">
              <FaRoute className="text-blue-600 text-3xl" /> Dispatch & Trips
            </h1>
            <p className="text-gray-500 text-sm mt-1">Plan, dispatch, and track active cargo routes</p>
          </div>
          <button 
            onClick={() => {
              setSelectedOrder(null);
              setForm({
                source: '',
                destination: '',
                vehicle_id: '',
                driver_id: '',
                cargo_weight: '',
                planned_distance: '',
                estimated_fuel_liters: '',
                booking_id: null
              });
              setRouteCalc(null);
              setShowAddModal(true);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg flex items-center gap-2 transition font-bold shadow-sm"
          >
            <FaPlus /> Create Dispatch
          </button>
        </div>

        {/* Accepted Freight Orders Ready for Dispatch */}
        {acceptedOrders.length > 0 && (
          <div className="mb-8 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-extrabold text-gray-900 flex items-center gap-2">
                  <span className="flex h-3 w-3 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-600"></span>
                  </span>
                  Accepted Freight Orders Ready for Dispatch ({acceptedOrders.length})
                </h2>
                <p className="text-xs text-gray-600 mt-1">
                  Shippers have accepted price quotes for these shipments. Click below to assign a vehicle & driver to dispatch them.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {acceptedOrders.map((order) => (
                <div key={order.id} className="bg-white rounded-xl border border-blue-100 p-4 shadow-sm hover:shadow transition flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-mono font-bold text-xs bg-blue-100 text-blue-800 px-2.5 py-1 rounded-md">
                        {order.shipment_id}
                      </span>
                      <span className="font-mono font-extrabold text-sm text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-200">
                        ₹{parseFloat(order.price_quote || 0).toLocaleString()}
                      </span>
                    </div>

                    <div className="text-sm font-extrabold text-gray-800 flex items-center gap-2 mt-2">
                      <span className="truncate">{order.pickup_address}</span>
                      <FaArrowRight className="text-xs text-gray-400 shrink-0" />
                      <span className="truncate">{order.delivery_address}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600 mt-2.5 font-mono">
                      <span>⚖️ {parseFloat(order.cargo_weight).toLocaleString()} kg</span>
                      {order.estimated_distance_km && (
                        <span>📍 {order.estimated_distance_km} km</span>
                      )}
                      {order.estimated_fuel_liters && (
                        <span>⛽ {order.estimated_fuel_liters} L</span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1.5 font-medium">Shipper: {order.shipper?.name || 'Shipper'} {order.shipper?.company_name ? `(${order.shipper.company_name})` : ''}</p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-100 flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleDispatchFreightOrder(order)}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition flex items-center gap-1.5 shadow-sm"
                    >
                      <FaPlay className="text-[10px]" /> Dispatch This Order
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {loading && trips.length === 0 ? (
          <LoadingSpinner />
        ) : (
          <div className="space-y-4">
            {trips.length === 0 ? (
              <div className="bg-white p-12 rounded-xl border border-gray-100 shadow-sm text-center">
                <FaRoute className="text-6xl text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-xl font-bold">No dispatches scheduled.</p>
              </div>
            ) : (
              trips.map(t => (
                <div key={t.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 hover:shadow-md transition">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-extrabold text-gray-800 text-lg flex items-center gap-2">
                        {t.source} <FaArrowRight className="text-xs text-gray-400" /> {t.destination}
                      </h3>
                      <p className="text-xs text-gray-400 font-bold uppercase mt-1">
                        Driver: {t.driver?.name} • Vehicle: {t.vehicle?.registration_number} ({t.vehicle?.model_name})
                      </p>
                      {/* Trip ID — copyable */}
                      <button
                        type="button"
                        title="Copy Trip ID"
                        onClick={() => {
                          navigator.clipboard.writeText(t.id);
                          toast.success('Trip ID copied to clipboard!');
                        }}
                        className="mt-1.5 flex items-center gap-1.5 text-[10px] font-mono text-gray-400 hover:text-blue-600 transition group"
                      >
                        <FaCopy className="text-gray-300 group-hover:text-blue-500" />
                        {t.id.slice(0, 8)}…{t.id.slice(-4)}
                        <span className="text-[9px] font-sans normal-case opacity-0 group-hover:opacity-100 transition text-blue-500">click to copy</span>
                      </button>
                    </div>
                    <StatusBadge status={t.status} />
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600 bg-gray-50 p-3 rounded-lg border border-gray-100">
                    <div>
                      <p className="text-[10px] text-gray-400 font-bold uppercase">Weight</p>
                      <p className="font-bold text-gray-800">{t.cargo_weight} KG</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 font-bold uppercase">Distance</p>
                      <p className="font-bold text-gray-800">{t.planned_distance} KM</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 font-bold uppercase">Dispatched At</p>
                      <p className="font-bold text-gray-800">{t.dispatched_at ? new Date(t.dispatched_at).toLocaleTimeString() : '—'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 font-bold uppercase">Completed At</p>
                      <p className="font-bold text-gray-800">{t.completed_at ? new Date(t.completed_at).toLocaleTimeString() : '—'}</p>
                    </div>
                  </div>

                  {/* Shared Cargo Accepted Section */}
                  {t.freight_bookings && t.freight_bookings.length > 0 && (
                    <div className="mt-3.5 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-3.5">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-extrabold text-purple-950 flex items-center gap-1.5">
                          <span className="flex h-2 w-2 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-600"></span>
                          </span>
                          📦 Shared Cargo Accepted ({t.freight_bookings.length})
                        </span>
                        <span className="text-[10px] font-mono font-bold uppercase text-purple-700 bg-purple-100 px-2 py-0.5 rounded border border-purple-200">
                          Active Route Load
                        </span>
                      </div>

                      <div className="space-y-2">
                        {t.freight_bookings.map((fb) => (
                          <div 
                            key={fb.id} 
                            className="flex flex-wrap items-center justify-between gap-2 text-xs bg-white rounded-lg p-3 border border-purple-100 shadow-sm"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-xs bg-purple-100 text-purple-900 px-2 py-0.5 rounded">
                                {fb.shipment_id}
                              </span>
                              <span className="font-semibold text-gray-800">
                                {fb.pickup_address} <FaArrowRight className="inline text-[10px] text-gray-400 mx-1" /> <strong className="text-purple-900 font-extrabold">{fb.delivery_address}</strong>
                              </span>
                            </div>

                            <div className="flex items-center gap-2.5 font-mono text-xs">
                              <span className="text-gray-700 bg-gray-100 px-2 py-0.5 rounded font-semibold">
                                ⚖️ {parseFloat(fb.cargo_weight).toLocaleString()} kg
                              </span>
                              <span className="bg-emerald-100 text-emerald-800 font-extrabold px-2.5 py-1 rounded-md border border-emerald-300 flex items-center gap-1 shadow-xs">
                                🏁 Shared Cargo Accepted: Destination {fb.delivery_address}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Completed Trip Financial Settlement Summary */}
                  {t.status === 'Completed' && (() => {
                    const bookings = t.freight_bookings || [];
                    let primaryRev = 0;
                    let sharedRev = 0;
                    bookings.forEach(b => {
                      const amt = parseFloat(b.price_quote) || 0;
                      if (b.is_shared) sharedRev += amt;
                      else primaryRev += amt;
                    });
                    if (primaryRev === 0 && parseFloat(t.price_quote) > 0) {
                      primaryRev = parseFloat(t.price_quote);
                    }
                    const totalRev = primaryRev + sharedRev;
                    const fuelLit = parseFloat(t.fuel_consumed_liters) || 0;
                    const fuelCost = fuelLit * 100;
                    const netProfit = totalRev - fuelCost;
                    const margin = totalRev > 0 ? ((netProfit / totalRev) * 100).toFixed(1) : 0;

                    return (
                      <div className="mt-3.5 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-3.5">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-extrabold text-emerald-950 flex items-center gap-1.5">
                            💰 Completed Trip Financial Settlement
                          </span>
                          <span className="text-[10px] font-mono font-bold uppercase text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300">
                            Reconciled in Reports & Analytics
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                          <div className="bg-white p-2 rounded-lg border border-emerald-100">
                            <span className="text-[10px] text-gray-400 block font-sans font-bold uppercase">Primary Freight</span>
                            <span className="font-bold text-gray-800">₹{primaryRev.toLocaleString()}</span>
                          </div>
                          <div className="bg-white p-2 rounded-lg border border-emerald-100">
                            <span className="text-[10px] text-emerald-600 block font-sans font-bold uppercase">Shared Cargo Profit</span>
                            <span className="font-bold text-emerald-700">+{sharedRev > 0 ? `₹${sharedRev.toLocaleString()}` : '₹0'}</span>
                          </div>
                          <div className="bg-white p-2 rounded-lg border border-emerald-100">
                            <span className="text-[10px] text-red-500 block font-sans font-bold uppercase">Fuel Expense</span>
                            <span className="font-bold text-red-600">-₹{fuelCost.toLocaleString()} ({fuelLit}L)</span>
                          </div>
                          <div className="bg-white p-2 rounded-lg border border-emerald-200 bg-gradient-to-r from-emerald-50 to-white">
                            <span className="text-[10px] text-emerald-800 block font-sans font-bold uppercase">Net Profit Margin</span>
                            <span className="font-black text-emerald-800">+{netProfit.toLocaleString()} ({margin}%)</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Actions Row */}
                  <div className="mt-4 pt-4 border-t border-gray-100 flex gap-3 justify-end flex-wrap">
                    {t.status === 'Draft' && (
                      <>
                        <button 
                          onClick={() => handleDispatch(t.id)}
                          className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition flex items-center gap-1.5 shadow-sm"
                        >
                          <FaPlay /> Dispatch
                        </button>
                        <button 
                          onClick={() => handleCancel(t.id)}
                          className="border border-red-200 text-red-500 hover:bg-red-50 text-xs font-bold px-4 py-2 rounded-lg transition flex items-center gap-1.5"
                        >
                          <FaBan /> Cancel
                        </button>
                      </>
                    )}

                    {t.status === 'Dispatched' && (
                      <>
                        {/* Live Location Map modal for Carrier */}
                        <button
                          onClick={() => openLiveMapModal(t)}
                          className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition flex items-center gap-1.5 shadow-sm"
                          title="View Live Location Map directly"
                        >
                          <FaMapMarkerAlt /> Live Map
                        </button>

                        {/* Manual GPS checkpoint */}
                        <button
                          onClick={() => openTrackingModal(t)}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition flex items-center gap-1.5 shadow-sm"
                        >
                          <FaMapMarkerAlt /> Pin Location
                        </button>

                        {/* Live continuous GPS stream */}
                        {liveTrip?.id === t.id ? (
                          <button
                            onClick={stopLiveTracking}
                            className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition flex items-center gap-1.5 shadow-sm animate-pulse"
                          >
                            <FaStop /> Stop Live
                          </button>
                        ) : (
                          <button
                            onClick={() => startLiveTracking(t)}
                            className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition flex items-center gap-1.5 shadow-sm"
                          >
                            <FaBroadcastTower /> Go Live
                          </button>
                        )}

                        <button
                          onClick={() => {
                            setShowShareModal(t);
                            setShareForm({
                              source: t.source || '',
                              destination: t.destination || '',
                              intermediate_points: '',
                              departure_time: '',
                              estimated_arrival: '',
                              price_per_kg: ''
                            });
                          }}
                          className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition flex items-center gap-1.5 shadow-sm"
                        >
                          <FaShareAlt /> Share Capacity
                        </button>
                        {/* Open customer tracking page */}
                        <button
                          onClick={() => {
                            const code = t.tracking_id || t.id;
                            const url = `${window.location.origin}/track/${code}`;
                            navigator.clipboard.writeText(url).then(() =>
                              toast.success('🔗 Tracking link copied to clipboard!')
                            );
                            window.open(url, '_blank');
                          }}
                          className="bg-gray-800 hover:bg-gray-900 text-white text-xs font-bold px-4 py-2 rounded-lg transition flex items-center gap-1.5 shadow-sm"
                        >
                          <FaExternalLinkAlt /> Open Tracker
                        </button>
                        <button 
                          onClick={() => {
                            setShowCompleteModal(t);
                            setCompleteForm({
                              final_odometer: (parseFloat(t.vehicle?.odometer || 0) + parseFloat(t.planned_distance)).toString(),
                              fuel_consumed_liters: ''
                            });
                          }}
                          className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition flex items-center gap-1.5 shadow-sm"
                        >
                          <FaCheck /> Complete
                        </button>
                        <button 
                          onClick={() => handleCancel(t.id)}
                          className="border border-red-200 text-red-500 hover:bg-red-50 text-xs font-bold px-4 py-2 rounded-lg transition flex items-center gap-1.5"
                        >
                          <FaBan /> Cancel
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Create Modal */}
        <Modal 
          isOpen={showAddModal} 
          onClose={() => {
            setShowAddModal(false);
            setSelectedOrder(null);
          }} 
          title={selectedOrder ? `Dispatch Freight Order · ${selectedOrder.shipment_id}` : "Create Dispatch Trip"}
        >
          <form onSubmit={handleCreate} className="space-y-4">
            {selectedOrder ? (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 text-xs text-blue-900 flex justify-between items-center">
                <div>
                  <div className="font-extrabold text-blue-950 flex items-center gap-1.5">
                    <FaBoxOpen className="text-blue-600" />
                    <span>Fulfilling Order: {selectedOrder.shipment_id}</span>
                    <span className="bg-emerald-100 text-emerald-800 font-mono px-2 py-0.5 rounded font-bold">
                      ₹{parseFloat(selectedOrder.price_quote || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-[11px] text-blue-700 mt-1">
                    Shipper: {selectedOrder.shipper?.name} • Weight: {selectedOrder.cargo_weight} kg
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedOrder(null);
                    setForm(prev => ({
                      ...prev,
                      booking_id: null,
                      source: '',
                      destination: '',
                      cargo_weight: '',
                      planned_distance: '',
                      estimated_fuel_liters: ''
                    }));
                    setRouteCalc(null);
                  }}
                  className="text-blue-600 hover:text-blue-800 underline font-semibold text-[11px]"
                >
                  Clear Order
                </button>
              </div>
            ) : acceptedOrders.length > 0 && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs">
                <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1.5">
                  <FaBoxOpen className="text-blue-600" /> Fulfill an Accepted Freight Order (Optional):
                </label>
                <select
                  onChange={(e) => {
                    const ord = acceptedOrders.find(o => o.id === e.target.value);
                    if (ord) handleDispatchFreightOrder(ord);
                  }}
                  className="w-full border border-gray-300 rounded-lg p-2 text-xs outline-none focus:ring-blue-500 bg-white"
                  defaultValue=""
                >
                  <option value="">-- Choose an accepted shipment to auto-fill --</option>
                  {acceptedOrders.map(o => (
                    <option key={o.id} value={o.id}>
                      {o.shipment_id} ({o.pickup_address} ➔ {o.delivery_address}, {o.cargo_weight}kg · ₹{o.price_quote})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Source Depot</label>
                <input
                  required
                  name="source"
                  value={form.source}
                  onChange={handleChange}
                  placeholder="Warehouse A"
                  className="w-full border border-gray-300 rounded-lg p-3 text-sm outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Destination</label>
                <input
                  required
                  name="destination"
                  value={form.destination}
                  onChange={handleChange}
                  placeholder="Depot B"
                  className="w-full border border-gray-300 rounded-lg p-3 text-sm outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {calcLoading && (
              <div className="bg-blue-50 border border-blue-200 text-blue-700 text-xs p-2.5 rounded-lg animate-pulse flex items-center gap-2">
                ⚡ Calculating real road distance and estimated fuel...
              </div>
            )}
            {routeCalc && !calcLoading && (
              <div className="bg-green-50 border border-green-300 text-green-900 text-xs p-3 rounded-xl flex items-center justify-between">
                <div>
                  <span className="font-bold">📍 Road Distance:</span> {routeCalc.distanceKm} km
                  <span className="mx-2">|</span>
                  <span className="font-bold">⛽ Est. Fuel:</span> {routeCalc.fuelLiters} L
                </div>
                <span className="text-[10px] text-green-700 font-mono">Auto-Calculated</span>
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Select Driver</label>
              <select
                required
                name="driver_id"
                value={form.driver_id}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg p-3 text-sm outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-700 bg-white"
              >
                <option value="">Select available driver...</option>
                {eligibleDrivers.map(d => (
                  <option key={d.id} value={d.id}>{d.name} (Score: {d.safety_score})</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Select Vehicle</label>
                <select
                  required
                  name="vehicle_id"
                  value={form.vehicle_id}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg p-3 text-sm outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-700 bg-white"
                >
                  <option value="">Select vehicle...</option>
                  {eligibleVehicles.map(v => (
                    <option key={v.id} value={v.id}>{v.registration_number} (Capacity: {v.max_load_capacity_kg}kg)</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Planned Distance (KM)</label>
                <input
                  required
                  type="number"
                  name="planned_distance"
                  value={form.planned_distance}
                  onChange={handleChange}
                  placeholder="120"
                  className="w-full border border-gray-300 rounded-lg p-3 text-sm outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Cargo Payload Weight (KG)</label>
              <input
                required
                type="number"
                name="cargo_weight"
                value={form.cargo_weight}
                onChange={handleChange}
                placeholder="350"
                className="w-full border border-gray-300 rounded-lg p-3 text-sm outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {selectedVehicleObj && (
              <PayloadGauge 
                value={parseFloat(form.cargo_weight || 0)} 
                max={parseFloat(selectedVehicleObj.max_load_capacity_kg)} 
              />
            )}

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="flex-1 border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold py-3 rounded-lg text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={selectedVehicleObj && parseFloat(form.cargo_weight || 0) > parseFloat(selectedVehicleObj.max_load_capacity_kg)}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg text-sm disabled:bg-gray-300 disabled:cursor-not-allowed shadow-sm"
              >
                Schedule Draft
              </button>
            </div>
          </form>
        </Modal>

        {/* Complete Modal */}
        <Modal isOpen={!!showCompleteModal} onClose={() => setShowCompleteModal(null)} title="Complete Trip Delivery">
          <form onSubmit={handleCompleteSubmit} className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-xl text-xs space-y-1">
              <p>📍 <strong>Route:</strong> {showCompleteModal?.source} ➔ {showCompleteModal?.destination}</p>
              <p>🚙 <strong>Vehicle:</strong> {showCompleteModal?.vehicle?.registration_number}</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Final Odometer Reading (KM)</label>
              <div className="relative">
                <input
                  required
                  type="number"
                  name="final_odometer"
                  value={completeForm.final_odometer}
                  onChange={(e) => setCompleteForm({...completeForm, final_odometer: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg p-3 pl-10 text-sm outline-none focus:ring-blue-500 focus:border-blue-500"
                />
                <FaTachometerAlt className="absolute left-3.5 top-3.5 text-gray-400" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Fuel Consumed (Liters)</label>
              <div className="relative">
                <input
                  required
                  type="number"
                  step="0.01"
                  name="fuel_consumed_liters"
                  value={completeForm.fuel_consumed_liters}
                  onChange={(e) => setCompleteForm({...completeForm, fuel_consumed_liters: e.target.value})}
                  placeholder="e.g. 15"
                  className="w-full border border-gray-300 rounded-lg p-3 pl-10 text-sm outline-none focus:ring-blue-500 focus:border-blue-500"
                />
                <FaGasPump className="absolute left-3.5 top-3.5 text-gray-400" />
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => setShowCompleteModal(null)}
                className="flex-1 border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold py-3 rounded-lg text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg text-sm shadow-sm"
              >
                Complete & Release
              </button>
            </div>
          </form>
        </Modal>

        {/* Share Capacity Modal (Publish Route) */}
        <Modal isOpen={!!showShareModal} onClose={() => setShowShareModal(null)} title="Share Vehicle Capacity">
          <form onSubmit={async (e) => {
            e.preventDefault();
            if (!showShareModal?.vehicle_id) return;
            setShareLoading(true);
            try {
              const intermediateArr = shareForm.intermediate_points
                ? shareForm.intermediate_points.split(',').map(s => s.trim()).filter(Boolean)
                : [];
              await api.post(`/vehicles/${showShareModal.vehicle_id}/publish-route`, {
                source: shareForm.source,
                destination: shareForm.destination,
                intermediate_points: intermediateArr,
                departure_time: shareForm.departure_time || null,
                estimated_arrival: shareForm.estimated_arrival || null,
                price_per_kg: parseFloat(shareForm.price_per_kg) || 0
              });
              toast.success('Route published! Others can now book shared space on this vehicle.');
              setShowShareModal(null);
            } catch (err) {
              toast.error(err.response?.data?.message || 'Failed to publish route');
            } finally {
              setShareLoading(false);
            }
          }} className="space-y-4">
            <div className="bg-purple-50 border border-purple-200 text-purple-800 p-4 rounded-xl text-xs space-y-1">
              <p>🚙 <strong>Vehicle:</strong> {showShareModal?.vehicle?.registration_number} ({showShareModal?.vehicle?.model_name})</p>
              <p>📍 <strong>Current Trip:</strong> {showShareModal?.source} → {showShareModal?.destination}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Route Source</label>
                <input
                  required
                  value={shareForm.source}
                  onChange={e => setShareForm({ ...shareForm, source: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg p-3 text-sm outline-none focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Route Destination</label>
                <input
                  required
                  value={shareForm.destination}
                  onChange={e => setShareForm({ ...shareForm, destination: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg p-3 text-sm outline-none focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Intermediate Stops (comma-separated)</label>
              <input
                value={shareForm.intermediate_points}
                onChange={e => setShareForm({ ...shareForm, intermediate_points: e.target.value })}
                placeholder="e.g. Nashik, Shirdi"
                className="w-full border border-gray-300 rounded-lg p-3 text-sm outline-none focus:ring-purple-500 focus:border-purple-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Departure Time</label>
                <input
                  type="datetime-local"
                  value={shareForm.departure_time}
                  onChange={e => setShareForm({ ...shareForm, departure_time: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg p-3 text-sm outline-none focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Estimated Arrival</label>
                <input
                  type="datetime-local"
                  value={shareForm.estimated_arrival}
                  onChange={e => setShareForm({ ...shareForm, estimated_arrival: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg p-3 text-sm outline-none focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Price per KG (₹)</label>
              <input
                required
                type="number"
                step="0.01"
                min="0"
                value={shareForm.price_per_kg}
                onChange={e => setShareForm({ ...shareForm, price_per_kg: e.target.value })}
                placeholder="e.g. 5.50"
                className="w-full border border-gray-300 rounded-lg p-3 text-sm outline-none focus:ring-purple-500 focus:border-purple-500"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => setShowShareModal(null)}
                className="flex-1 border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold py-3 rounded-lg text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={shareLoading}
                className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white font-bold py-3 rounded-lg text-sm shadow-sm"
              >
                {shareLoading ? 'Publishing...' : '🚀 Publish Route'}
              </button>
            </div>
          </form>
        </Modal>

        {/* Live Location Checkpoint Update Modal */}
        <Modal isOpen={!!showTrackingModal} onClose={() => setShowTrackingModal(null)} title="📍 Pin Location Checkpoint">
          <form onSubmit={async (e) => {
            e.preventDefault();
            if (!showTrackingModal?.id) return;
            setTrackingLoading(true);
            try {
              await api.post('/tracking', {
                trip_id: showTrackingModal.id,
                location: trackingForm.location,
                latitude: parseFloat(trackingForm.latitude),
                longitude: parseFloat(trackingForm.longitude),
                status: trackingForm.status,
                notes: trackingForm.notes
              });
              toast.success('📍 Checkpoint saved and broadcasted to shippers!');
              setShowTrackingModal(null);
            } catch (err) {
              toast.error(err.response?.data?.message || 'Failed to save checkpoint');
            } finally {
              setTrackingLoading(false);
            }
          }} className="space-y-4">
            <div className="bg-indigo-50 border border-indigo-200 text-indigo-800 p-4 rounded-xl text-xs space-y-1">
              <p>📍 <strong>Route:</strong> {showTrackingModal?.source} ➔ {showTrackingModal?.destination}</p>
              <p>🚙 <strong>Vehicle:</strong> {showTrackingModal?.vehicle?.registration_number}</p>
            </div>

            {/* GPS Status Banner */}
            {gpsLoading ? (
              <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl p-3 text-blue-700 text-sm">
                <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full flex-shrink-0" />
                <span className="font-medium">Fetching your real GPS coordinates...</span>
              </div>
            ) : trackingForm.latitude ? (
              <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl p-3">
                <div className="text-green-700 text-sm">
                  <span className="font-bold">✅ GPS Acquired:</span>{' '}
                  {trackingForm.latitude}, {trackingForm.longitude}
                </div>
                <button
                  type="button"
                  onClick={() => openTrackingModal(showTrackingModal)}
                  className="text-xs text-blue-600 underline font-semibold"
                >
                  Re-fetch
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between bg-yellow-50 border border-yellow-200 rounded-xl p-3">
                <span className="text-yellow-700 text-sm font-medium">⚠️ GPS unavailable — enter manually</span>
                <button
                  type="button"
                  onClick={() => openTrackingModal(showTrackingModal)}
                  className="text-xs text-blue-600 underline font-semibold"
                >
                  Try Again
                </button>
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Location / Checkpoint Name</label>
              <input
                required
                placeholder="e.g. Lonavala Toll Plaza"
                value={trackingForm.location}
                onChange={e => setTrackingForm({ ...trackingForm, location: e.target.value })}
                className="w-full border border-gray-300 rounded-lg p-3 text-sm outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Latitude</label>
                <input
                  required
                  type="number"
                  step="0.000001"
                  placeholder="Auto-filled from GPS"
                  value={trackingForm.latitude}
                  onChange={e => setTrackingForm({ ...trackingForm, latitude: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg p-3 text-sm outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-green-50"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Longitude</label>
                <input
                  required
                  type="number"
                  step="0.000001"
                  placeholder="Auto-filled from GPS"
                  value={trackingForm.longitude}
                  onChange={e => setTrackingForm({ ...trackingForm, longitude: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg p-3 text-sm outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-green-50"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Transit Status</label>
                <select
                  value={trackingForm.status}
                  onChange={e => setTrackingForm({ ...trackingForm, status: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg p-3 text-sm outline-none focus:ring-indigo-500 focus:border-indigo-500 text-gray-700 bg-white"
                >
                  <option value="in_transit">🚛 In Transit</option>
                  <option value="picked_up">📦 Picked Up</option>
                  <option value="out_for_delivery">🏍️ Out for Delivery</option>
                  <option value="Completed">✅ Delivered</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Log Notes (optional)</label>
              <textarea
                placeholder="e.g. Traffic clear, moving at 60 km/h."
                value={trackingForm.notes}
                onChange={e => setTrackingForm({ ...trackingForm, notes: e.target.value })}
                rows="2"
                className="w-full border border-gray-300 rounded-lg p-3 text-sm outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => setShowTrackingModal(null)}
                className="flex-1 border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold py-3 rounded-lg text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={trackingLoading}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold py-3 rounded-lg text-sm shadow-sm"
              >
                {trackingLoading ? 'Saving...' : '📍 Save Checkpoint'}
              </button>
            </div>
          </form>
        </Modal>

        {/* Live Location Map Modal for Carrier */}
        <Modal 
          isOpen={!!showMapModal} 
          onClose={() => {
            setShowMapModal(null);
            setModalCheckpoints([]);
          }} 
          title={`🗺 Live Location Map · ${showMapModal?.source} ➔ ${showMapModal?.destination}`}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 text-xs text-blue-900">
              <div>
                <span className="font-bold">Truck:</span> {showMapModal?.vehicle?.registration_number} ({showMapModal?.vehicle?.model_name})
                <span className="mx-2">•</span>
                <span className="font-bold">Driver:</span> {showMapModal?.driver?.name}
              </div>
              {modalCheckpoints.length > 0 && (
                <span className="font-mono font-bold bg-blue-600 text-white px-2 py-0.5 rounded">
                  📍 {modalCheckpoints[0].location}
                </span>
              )}
            </div>

            {/* Shared cargo onboard section */}
            {showMapModal?.freight_bookings && showMapModal.freight_bookings.length > 0 && (
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-xs">
                <span className="font-extrabold text-purple-900 block mb-1.5 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-purple-600"></span>
                  Shared Cargo Accepted on Route:
                </span>
                <div className="space-y-1.5">
                  {showMapModal.freight_bookings.map(fb => (
                    <div key={fb.id} className="flex justify-between items-center text-[11px] bg-white rounded-md px-2.5 py-1.5 border border-purple-100">
                      <span><strong>{fb.shipment_id}</strong>: {fb.pickup_address} ➔ <strong className="text-purple-900">{fb.delivery_address}</strong> ({fb.cargo_weight}kg)</span>
                      <span className="bg-emerald-100 text-emerald-800 font-extrabold px-2 py-0.5 rounded border border-emerald-300">
                        🏁 Destination: {fb.delivery_address}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {modalLoading ? (
              <div className="h-[400px] flex items-center justify-center bg-gray-50 rounded-2xl border border-gray-200">
                <LoadingSpinner />
              </div>
            ) : (
              <div
                ref={modalMapDivRef}
                style={{ height: '400px', width: '100%', minHeight: '400px', position: 'relative' }}
                className="rounded-2xl overflow-hidden border border-gray-200 z-0 bg-gray-50"
              />
            )}

            <div className="flex justify-between items-center pt-2">
              <span className="text-xs text-gray-500 font-mono">
                {modalCheckpoints.length} GPS update{modalCheckpoints.length !== 1 ? 's' : ''} recorded
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const code = showMapModal?.tracking_id || showMapModal?.id;
                    const url = `${window.location.origin}/track/${code}`;
                    navigator.clipboard.writeText(url).then(() =>
                      toast.success('Tracking link copied!')
                    );
                  }}
                  className="border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-bold px-3 py-1.5 rounded-lg transition inline-flex items-center gap-1.5"
                >
                  <FaCopy /> Copy Link
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const code = showMapModal?.tracking_id || showMapModal?.id;
                    window.open(`${window.location.origin}/track/${code}`, '_blank');
                  }}
                  className="bg-gray-800 hover:bg-gray-900 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition inline-flex items-center gap-1.5 shadow-sm"
                >
                  <FaExternalLinkAlt /> Full Tracker
                </button>
              </div>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
}
