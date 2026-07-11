import { environment } from '../../../environments/environment';

/**
 * Map tile style URL.
 * Swap this for a self-hosted or commercial tile server when ready
 * (Maptiler, MapBox-compatible, OpenFreeMap, etc.).
 */
export const MAP_STYLE_URL = `https://api.maptiler.com/maps/streets-v2/style.json?key=${environment.mapTilerKey}`;

export const MAP_DEFAULT_ZOOM = 14;
