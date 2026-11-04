/**
 * Distance & Fuel Calculation Engine
 * Uses Nominatim Geocoding + OSRM Driving Distance API with Haversine fallback.
 */

// Benchmark fuel efficiencies by vehicle type (km per liter)
export const VEHICLE_MILEAGE = {
  bike: 35.0,
  van: 12.0,
  mini_truck: 8.0,
  truck: 4.5,
  container_truck: 3.5,
  default: 5.0
};

// In-memory cache for coordinates to avoid redundant network calls
const geocodeCache = new Map();

/**
 * Geocode address/city name to [lat, lon] using Nominatim
 */
export async function geocodeLocation(query) {
  if (!query || !query.trim()) return null;
  const q = query.trim().toLowerCase();

  if (geocodeCache.has(q)) {
    return geocodeCache.get(q);
  }

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`,
      { headers: { 'Accept-Language': 'en' } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.length > 0) {
      const coords = {
        lat: parseFloat(data[0].lat),
        lon: parseFloat(data[0].lon),
        displayName: data[0].display_name
      };
      geocodeCache.set(q, coords);
      return coords;
    }
  } catch (err) {
    console.warn('Geocoding error for:', query, err);
  }
  return null;
}

/**
 * Great-circle distance (Haversine) in km
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate driving distance (km) and estimated travel duration (minutes)
 * between two location strings.
 */
export async function calculateRouteDistance(source, destination) {
  if (!source || !destination) return null;

  const [srcCoords, destCoords] = await Promise.all([
    geocodeLocation(source),
    geocodeLocation(destination)
  ]);

  if (!srcCoords || !destCoords) {
    return null;
  }

  try {
    // Attempt OSRM driving route
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${srcCoords.lon},${srcCoords.lat};${destCoords.lon},${destCoords.lat}?overview=false`;
    const res = await fetch(osrmUrl);
    if (res.ok) {
      const data = await res.json();
      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const distanceKm = Math.round((route.distance / 1000) * 10) / 10;
        const durationMinutes = Math.round(route.duration / 60);
        return {
          distanceKm,
          durationMinutes,
          srcCoords,
          destCoords,
          isRoadRoute: true
        };
      }
    }
  } catch (err) {
    console.warn('OSRM routing failed, falling back to Haversine:', err);
  }

  // Fallback: Haversine distance adjusted for road curvature factor (1.25x)
  const straightLine = haversineDistance(
    srcCoords.lat,
    srcCoords.lon,
    destCoords.lat,
    destCoords.lon
  );
  const distanceKm = Math.round(straightLine * 1.25 * 10) / 10;
  // Assume avg commercial transit speed 50 km/h
  const durationMinutes = Math.round((distanceKm / 50) * 60);

  return {
    distanceKm,
    durationMinutes,
    srcCoords,
    destCoords,
    isRoadRoute: false
  };
}

/**
 * Calculate estimated fuel needed in liters
 * @param {number} distanceKm
 * @param {string} vehicleType - 'bike'|'van'|'mini_truck'|'truck'|'container_truck'
 * @param {number} cargoWeightKg - optional cargo weight to factor in load penalty
 * @param {number} maxCapacityKg - vehicle max capacity
 */
export function estimateFuelLiters(distanceKm, vehicleType = 'truck', cargoWeightKg = 0, maxCapacityKg = 5000) {
  if (!distanceKm || distanceKm <= 0) return 0;
  const mileage = VEHICLE_MILEAGE[vehicleType] || VEHICLE_MILEAGE.default;

  // Base fuel consumption
  let baseFuel = distanceKm / mileage;

  // Cargo load factor (up to 15% increase when fully loaded)
  if (cargoWeightKg > 0 && maxCapacityKg > 0) {
    const loadRatio = Math.min(cargoWeightKg / maxCapacityKg, 1.2);
    baseFuel *= (1 + loadRatio * 0.15);
  }

  return Math.round(baseFuel * 10) / 10;
}

