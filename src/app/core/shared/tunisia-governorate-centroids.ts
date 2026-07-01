import { normalizeGovernorate } from './tunisia-governorates';

/**
 * Approximate geographic centroid (lat, lng) of each Tunisian governorate.
 * Used to place proportional case-density markers on the ZM dashboard mini map
 * without shipping full boundary GeoJSON. Keys match the canonical names in
 * {@link tunisia-governorates}.
 */
export const TUNISIA_GOVERNORATE_CENTROIDS: Record<string, [number, number]> = {
  'Tunis': [36.8065, 10.1815],
  'Ariana': [36.8625, 10.1956],
  'Ben Arous': [36.7533, 10.2189],
  'Manouba': [36.8081, 10.0972],
  'Nabeul': [36.4513, 10.7357],
  'Zaghouan': [36.4028, 10.1433],
  'Bizerte': [37.2744, 9.8739],
  'Beja': [36.7256, 9.1817],
  'Jendouba': [36.5011, 8.7803],
  'Kef': [36.1826, 8.7148],
  'Siliana': [36.0849, 9.3708],
  'Sousse': [35.8256, 10.6084],
  'Monastir': [35.7780, 10.8262],
  'Mahdia': [35.5047, 11.0622],
  'Sfax': [34.7406, 10.7603],
  'Kairouan': [35.6781, 10.0963],
  'Kasserine': [35.1676, 8.8365],
  'Sidi Bouzid': [35.0382, 9.4849],
  'Gabes': [33.8815, 10.0982],
  'Medenine': [33.3549, 10.5055],
  'Tataouine': [32.9297, 10.4518],
  'Gafsa': [34.4250, 8.7842],
  'Tozeur': [33.9197, 8.1335],
  'Kebili': [33.7050, 8.9690]
};

/** Resolve a raw governorate label to [lat, lng], normalising aliases. Returns null if unknown. */
export function governorateCentroid(value?: string | null): [number, number] | null {
  if (!value) return null;
  const canonical = normalizeGovernorate(value);
  return TUNISIA_GOVERNORATE_CENTROIDS[canonical] ?? null;
}
