import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  ViewChild,
  signal
} from '@angular/core';

import {
  Map as MapLibreMap,
  Marker,
  Popup,
  NavigationControl,
  setRTLTextPlugin
} from 'maplibre-gl';

import { MAP_STYLE_URL } from '../../../core/map/map.config';
import { governorateCentroid } from '../../../core/shared/tunisia-governorate-centroids';
import { ZmGovernorateStat } from '../../../core/zm-dashboard/zm-dashboard.model';

let rtlPluginLoaded = false;
function ensureRtlPlugin(): void {
  if (rtlPluginLoaded) return;
  setRTLTextPlugin(
    'https://unpkg.com/@mapbox/mapbox-gl-rtl-text@0.3.0/dist/mapbox-gl-rtl-text.js',
    true
  );
  rtlPluginLoaded = true;
}

/**
 * Small read-only Tunisia map that plots one proportional bubble per governorate, sized by the
 * ZM's case volume and coloured by the overdue share. Purely presentational — driven by the
 * {@link ZmGovernorateStat} array from the dashboard endpoint (no case coordinates loaded).
 */
@Component({
  selector: 'app-zm-zone-map',
  standalone: true,
  imports: [],
  template: `
    <div class="zm-zone-map">
      <div #mapContainer class="zm-zone-map__canvas"></div>
      @if (mapError()) {
        <div class="zm-zone-map__error">{{ mapError() }}</div>
      }
    </div>
  `,
  styles: [`
    .zm-zone-map { position: relative; width: 100%; height: 100%; }
    .zm-zone-map__canvas { position: absolute; inset: 0; border-radius: 0.5rem; overflow: hidden; }
    .zm-zone-map__error {
      position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
      text-align: center; padding: 1rem; color: #6b7280; font-size: 0.85rem;
    }
    :host ::ng-deep .zm-zone-bubble {
      border-radius: 50%; border: 2px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,.35);
      display: flex; align-items: center; justify-content: center;
      color: #fff; font-size: 10px; font-weight: 700; cursor: pointer;
    }
  `]
})
export class ZmZoneMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() governorates: ZmGovernorateStat[] = [];

  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef<HTMLDivElement>;

  readonly mapError = signal<string | null>(null);

  private map: MapLibreMap | null = null;
  private markers: Marker[] = [];
  private ready = false;

  ngAfterViewInit(): void {
    setTimeout(() => this.initMap(), 0);
  }

  ngOnChanges(): void {
    if (this.ready) this.renderMarkers();
  }

  ngOnDestroy(): void {
    this.clearMarkers();
    this.map?.remove();
    this.map = null;
  }

  private initMap(): void {
    try {
      ensureRtlPlugin();
      this.map = new MapLibreMap({
        container: this.mapContainer.nativeElement,
        style: MAP_STYLE_URL,
        center: [9.55, 34.4],
        zoom: 5.1,
        attributionControl: false
      });
      this.map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
      this.map.on('load', () => {
        this.ready = true;
        this.map?.resize();
        this.renderMarkers();
      });
    } catch (err) {
      console.error('[ZmZoneMap] init failed:', err);
      this.mapError.set('Map could not be loaded.');
    }
  }

  private renderMarkers(): void {
    if (!this.map) return;
    this.clearMarkers();

    const rows = (this.governorates ?? []).filter(g => g.total > 0);
    if (!rows.length) return;

    const max = Math.max(...rows.map(g => g.total));

    for (const g of rows) {
      const center = governorateCentroid(g.governorate);
      if (!center) continue;

      const size = this.bubbleSize(g.total, max);
      const el = document.createElement('div');
      el.className = 'zm-zone-bubble';
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
      el.style.background = this.bubbleColor(g);
      el.textContent = g.total >= 1000 ? `${Math.round(g.total / 1000)}k` : String(g.total);

      const popup = new Popup({ offset: size / 2 + 6, closeButton: false, maxWidth: '220px' })
        .setHTML(this.popupHtml(g));

      const marker = new Marker({ element: el })
        // MapLibre expects [lng, lat]; centroids are stored [lat, lng].
        .setLngLat([center[1], center[0]])
        .setPopup(popup)
        .addTo(this.map);

      this.markers.push(marker);
    }
  }

  private bubbleSize(total: number, max: number): number {
    const ratio = max > 0 ? total / max : 0;
    return Math.round(20 + ratio * 34); // 20px..54px
  }

  private bubbleColor(g: ZmGovernorateStat): string {
    const share = g.total > 0 ? g.overdue / g.total : 0;
    if (share >= 0.25) return '#DC2626';   // heavy overdue
    if (share > 0) return '#F59E0B';        // some overdue
    return '#E30613';                       // Ooredoo red (no overdue)
  }

  private popupHtml(g: ZmGovernorateStat): string {
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<div style="line-height:1.6;font-size:0.78rem">
      <strong>${esc(g.governorate)}</strong><br>
      ${g.total} case(s)<br>
      <span style="color:#F59E0B">${g.pending} pending</span> ·
      <span style="color:#DC2626">${g.overdue} overdue</span>
    </div>`;
  }

  private clearMarkers(): void {
    this.markers.forEach(m => m.remove());
    this.markers = [];
  }
}
