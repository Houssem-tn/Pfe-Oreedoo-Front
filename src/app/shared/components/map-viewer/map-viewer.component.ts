import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
  signal
} from '@angular/core';

// Static import — keeps types and runtime in sync, required for esbuild
import {
  Map as MapLibreMap,
  Marker,
  Popup,
  NavigationControl,
  setRTLTextPlugin
} from 'maplibre-gl';

// Module-level flag — ensures the RTL plugin is registered only once
// regardless of how many map instances are opened during the session
let rtlPluginLoaded = false;

function ensureRtlPlugin(): void {
  if (rtlPluginLoaded) return;
  setRTLTextPlugin(
    'https://unpkg.com/@mapbox/mapbox-gl-rtl-text@0.3.0/dist/mapbox-gl-rtl-text.js',
    true  // lazy — loaded only when RTL text is first encountered
  );
  rtlPluginLoaded = true;
}

import { MAP_DEFAULT_ZOOM, MAP_STYLE_URL } from '../../../core/map/map.config';

// TODO: extend inputs to support markers[] array for multi-site visualization
// TODO: add GeoJSON source support for case clusters
// TODO: add polygon layer support for coverage zones

@Component({
  selector: 'app-map-viewer',
  standalone: true,
  imports: [],
  templateUrl: './map-viewer.component.html',
  styleUrls: ['./map-viewer.component.scss']
})
export class MapViewerComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input({ required: true }) lat!: number;
  @Input({ required: true }) lng!: number;
  @Input() title?: string;
  @Input() description?: string;
  @Input() markerLabel?: string;
  @Input() zoom = MAP_DEFAULT_ZOOM;

  /** Pixel height of the map canvas — toolbar sits below it */
  @Input() mapHeight = 440;

  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef<HTMLDivElement>;

  private map: MapLibreMap | null = null;
  private marker: Marker | null = null;

  readonly copied = signal(false);
  readonly mapError = signal<string | null>(null);

  get coordsLabel(): string {
    return `${this.lat.toFixed(6)}, ${this.lng.toFixed(6)}`;
  }

  get googleMapsUrl(): string {
    // Google Maps: lat,lng order
    return `https://www.google.com/maps/place/${this.lat},${this.lng}`;
  }

  ngAfterViewInit(): void {
    // Defer one tick so the browser completes layout before MapLibre
    // reads the container's bounding rect — avoids a 0×0 canvas bug
    setTimeout(() => this.initMap(), 0);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.map) return;
    if (changes['lat'] || changes['lng']) {
      // MapLibre uses [longitude, latitude] — never invert
      this.map.flyTo({ center: [this.lng, this.lat], zoom: this.zoom });
      this.marker?.setLngLat([this.lng, this.lat]);
    }
  }

  ngOnDestroy(): void {
    this.destroyMap();
  }

  openGoogleMaps(): void {
    window.open(this.googleMapsUrl, '_blank', 'noopener,noreferrer');
  }

  copyCoords(): void {
    navigator.clipboard.writeText(this.coordsLabel).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    }).catch(() => {});
  }

  private initMap(): void {
    try {
      // Register RTL plugin once so Arabic labels render right-to-left
      ensureRtlPlugin();

      // MapLibre coordinate order is [longitude, latitude]
      this.map = new MapLibreMap({
        container: this.mapContainer.nativeElement,
        style: MAP_STYLE_URL,
        center: [this.lng, this.lat],
        zoom: this.zoom
      });

      this.map.addControl(new NavigationControl(), 'top-right');

      const popup = new Popup({ offset: 28, maxWidth: '280px', closeButton: false })
        .setHTML(this.buildPopupHtml());

      this.marker = new Marker({ color: '#e5243b' })
        .setLngLat([this.lng, this.lat])
        .setPopup(popup)
        .addTo(this.map);

      // Open the popup immediately so the user sees the pin label
      this.marker.togglePopup();

      // Resize after tiles load to fix any residual canvas sizing issues
      this.map.on('load', () => this.map?.resize());

    } catch (err) {
      console.error('[MapViewer] init failed:', err);
      this.mapError.set('Map could not be loaded. Check console for details.');
    }
  }

  private buildPopupHtml(): string {
    const parts: string[] = [];
    if (this.title) {
      parts.push(`<strong style="font-size:0.82rem">${this.esc(this.title)}</strong>`);
    }
    if (this.description) {
      parts.push(`<span style="font-size:0.78rem;color:#555">${this.esc(this.description)}</span>`);
    }
    parts.push(
      `<span style="font-family:monospace;font-size:0.74rem;color:#888">` +
      `${this.lat.toFixed(6)}, ${this.lng.toFixed(6)}</span>`
    );
    return `<div style="line-height:1.65;padding:2px 0">${parts.join('<br>')}</div>`;
  }

  private esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  private destroyMap(): void {
    this.marker?.remove();
    this.map?.remove();
    this.marker = null;
    this.map = null;
  }
}
