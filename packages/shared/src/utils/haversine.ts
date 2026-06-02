const EARTH_RADIUS_KM = 6371;

export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function isInsideGeofence(
  lat: number,
  lon: number,
  centerLat: number,
  centerLon: number,
  radiusMeters: number,
): boolean {
  const distKm = haversineDistanceKm(lat, lon, centerLat, centerLon);
  return distKm * 1000 <= radiusMeters;
}

export function speedBetweenPointsKmh(
  lat1: number,
  lon1: number,
  time1: Date,
  lat2: number,
  lon2: number,
  time2: Date,
): number {
  const distKm = haversineDistanceKm(lat1, lon1, lat2, lon2);
  const hours = (time2.getTime() - time1.getTime()) / 3_600_000;
  if (hours <= 0) return 0;
  return distKm / hours;
}
