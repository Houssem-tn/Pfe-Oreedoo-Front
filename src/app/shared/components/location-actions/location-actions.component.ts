import { Component, Input, signal } from '@angular/core';
import { MapViewerComponent } from '../map-viewer/map-viewer.component';

export interface ParsedCoords {
  lat: number;
  lng: number;
}

@Component({
  selector: 'app-location-actions',
  standalone: true,
  imports: [MapViewerComponent],
  templateUrl: './location-actions.component.html',
  styleUrls: ['./location-actions.component.scss']
})
export class LocationActionsComponent {
  @Input() lat: number | string | null | undefined;
  @Input() lng: number | string | null | undefined;
  @Input() label?: string;
  @Input() contextTitle?: string;
  @Input() disabled = false;

  readonly mapOpen = signal(false);

  // ── Coordinate parsing ──────────────────────────────────────────────

  get validCoords(): ParsedCoords | null {
    const lat = parseCoordinate(this.lat);
    const lng = parseCoordinate(this.lng);
    if (lat == null || lng == null) return null;
    // ITU validation bounds
    if (lat < -90 || lat > 90)    return null;
    if (lng < -180 || lng > 180)  return null;
    return { lat, lng };
  }

  get isValid(): boolean {
    return this.validCoords !== null;
  }

  get coordsLabel(): string {
    const c = this.validCoords;
    if (!c) return 'No valid coordinates';
    return `${c.lat.toFixed(6)}, ${c.lng.toFixed(6)}`;
  }

  get modalTitle(): string {
    return this.contextTitle ?? this.label ?? 'Location';
  }

  // ── Actions ─────────────────────────────────────────────────────────

  openGoogleMaps(): void {
    const c = this.validCoords;
    if (!c) return;
    // Google Maps URL uses lat,lng order
    const url = `https://www.google.com/maps/place/${c.lat},${c.lng}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  openMap(): void {
    if (!this.isValid || this.disabled) return;
    this.mapOpen.set(true);
  }

  closeMap(): void {
    this.mapOpen.set(false);
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('la-backdrop')) {
      this.closeMap();
    }
  }
}

/** Parse a coordinate value that may be number, string, comma-decimal, or null. */
function parseCoordinate(value: number | string | null | undefined): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  const text = (value ?? '').toString().trim();
  if (!text) return null;
  // Support comma as decimal separator (e.g. "37,2745" → 37.2745)
  const normalized = Number(text.replace(',', '.'));
  return Number.isFinite(normalized) ? normalized : null;
}
