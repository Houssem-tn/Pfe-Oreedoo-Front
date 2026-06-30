import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  computed,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  Map as MapLibreMap,
  NavigationControl,
  setRTLTextPlugin
} from 'maplibre-gl';

import { MAP_STYLE_URL } from '../../../core/map/map.config';
import { AuthStore } from '../../../core/auth/auth.store';
import { CoverageService } from '../../../core/coverage/coverage.service';
import { CoverageAnalysisService } from '../../../core/coverage/coverage-analysis.service';
import {
  CoverageAnalyticsPoint,
  CoverageLayerDetail,
  CoverageLayerSummary,
  CoverageTechnology,
  CoverageLayerType,
  LAYER_COLORS,
  PointCheckResponse,
  layerColorKey
} from '../../../core/coverage/coverage.models';

let rtlLoaded = false;
function ensureRtl(): void {
  if (rtlLoaded) return;
  setRTLTextPlugin(
    'https://unpkg.com/@mapbox/mapbox-gl-rtl-text@0.3.0/dist/mapbox-gl-rtl-text.js',
    true
  );
  rtlLoaded = true;
}

const TUNISIA_CENTER: [number, number] = [9.5375, 33.8869];
const COVERAGE_MAP_ZOOM = 6;

/** Marker color for activation (SOURCE = MES) points — matches the toggle dot. */
const ACTIVATION_MARKER_COLOR = '#2196F3';

interface LayerVisibility {
  coverage4G: boolean;
  coverage5G: boolean;
  ws4G: boolean;
  ws5G: boolean;
  points: boolean;
}

@Component({
  selector: 'app-network-coverage',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './network-coverage.component.html',
  styleUrls: ['./network-coverage.component.scss']
})
export class NetworkCoverageComponent implements AfterViewInit, OnDestroy {

  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef<HTMLDivElement>;

  // ── DI ──────────────────────────────────────────────────────────────────────
  private readonly authStore   = inject(AuthStore);
  private readonly coverageSvc = inject(CoverageService);
  private readonly analysisSvc = inject(CoverageAnalysisService);

  // ── Auth ─────────────────────────────────────────────────────────────────────
  readonly role              = this.authStore.role;
  readonly canImportCoverage = this.authStore.canImportCoverage;

  readonly showUploadPanel = computed(() =>
    this.role() === 'ROLE_ADMIN' ||
    (this.role() === 'ROLE_ZM' && this.canImportCoverage())
  );

  // ── Coverage layer state ───────────────────────────────────────────────────────
  readonly layers          = signal<CoverageLayerSummary[]>([]);

  readonly loadingLayers   = signal(false);
  readonly loadingUpload   = signal(false);
  readonly mapError        = signal<string | null>(null);
  readonly uploadError     = signal<string | null>(null);
  readonly uploadSuccess   = signal<string | null>(null);

  // ── Activation (merged-analytics) marker state ──────────────────────────────────
  readonly points        = signal<CoverageAnalyticsPoint[]>([]);
  readonly selectedPoint = signal<CoverageAnalyticsPoint | null>(null);
  readonly totalPoints   = signal(0);
  readonly capped        = signal(false);
  readonly hasStudy      = signal(true);

  readonly loadingPoints = signal(false);
  readonly pointsError   = signal<string | null>(null);
  readonly pointsLoaded  = signal(false);

  readonly visibility = signal<LayerVisibility>({
    coverage4G: true,
    coverage5G: true,
    ws4G: true,
    ws5G: true,
    points: true
  });

  // ── Coordinate lookup ─────────────────────────────────────────────────────────
  /** Combined paste input — accepts "36.8065, 10.1815" or "lat lon" */
  coordInput = '';
  coordError: string | null = null;
  readonly loadingPointCheck = signal(false);
  readonly pointCheckResult  = signal<PointCheckResponse | null>(null);

  // ── Upload form ───────────────────────────────────────────────────────────────
  uploadFile:        File | null = null;
  uploadName        = '';
  uploadTechnology: CoverageTechnology = 'FOUR_G';
  uploadLayerType:  CoverageLayerType  = 'COVERAGE';
  uploadGovernorate = '';
  uploadColor       = '';

  // ── MapLibre ──────────────────────────────────────────────────────────────────
  private map: MapLibreMap | null = null;
  private addedLayerIds = new Set<string>();
  private pointHandlersBound = false;

  // ── Lifecycle ─────────────────────────────────────────────────────────────────

  ngAfterViewInit(): void {
    setTimeout(() => this.initMap(), 0);
  }

  ngOnDestroy(): void {
    this.map?.remove();
    this.map = null;
  }

  // ── Map init ──────────────────────────────────────────────────────────────────

  private initMap(): void {
    try {
      ensureRtl();
      this.map = new MapLibreMap({
        container: this.mapContainer.nativeElement,
        style: MAP_STYLE_URL,
        center: TUNISIA_CENTER,
        zoom: COVERAGE_MAP_ZOOM
      });

      this.map.addControl(new NavigationControl(), 'top-right');

      this.map.on('load', () => {
        this.map?.resize();
        this.initOverlaySources();
        this.loadLayers();
        this.loadActivationPoints();
      });
    } catch (err) {
      console.error('[NetworkCoverage] Map init failed:', err);
      this.mapError.set('Map could not be loaded. Check your internet connection.');
    }
  }

  /**
   * Adds two dedicated GeoJSON sources + layers that persist for the session:
   *  - selected-case-source / selected-case-layer  (gold ring — updated on row click)
   *  - locate-source / locate-layer               (magenta dot — updated on coord locate)
   *
   * Coverage polygon layers and points-layer are added BEFORE these via beforeId so
   * these overlays always render on top.
   */
  private initOverlaySources(): void {
    if (!this.map) return;
    const empty = { type: 'FeatureCollection' as const, features: [] as any[] };

    this.map.addSource('selected-case-source', { type: 'geojson', data: empty });
    this.map.addLayer({
      id: 'selected-case-layer',
      type: 'circle',
      source: 'selected-case-source',
      paint: {
        'circle-radius': 13,
        'circle-color': '#FFD600',
        'circle-stroke-width': 3,
        'circle-stroke-color': '#E65100',
        'circle-opacity': 1
      }
    });

    // Locate marker sits above selected-case-layer (added after = higher z-order)
    this.map.addSource('locate-source', { type: 'geojson', data: empty });
    this.map.addLayer({
      id: 'locate-layer',
      type: 'circle',
      source: 'locate-source',
      paint: {
        'circle-radius': 11,
        'circle-color': '#E91E63',
        'circle-stroke-width': 3,
        'circle-stroke-color': '#fff',
        'circle-opacity': 1
      }
    });
  }

  // ── Layer management ──────────────────────────────────────────────────────────

  private loadLayers(): void {
    this.loadingLayers.set(true);
    this.coverageSvc.getLayers().subscribe({
      next: summaries => {
        this.layers.set(summaries);
        this.loadingLayers.set(false);
        summaries.filter(l => l.status === 'ACTIVE').forEach(l => this.fetchAndAddLayer(l));
      },
      error: () => this.loadingLayers.set(false)
    });
  }

  private fetchAndAddLayer(summary: CoverageLayerSummary): void {
    this.coverageSvc.getLayer(summary.id).subscribe({
      next: detail => this.addLayerToMap(detail),
      error: err => console.warn('[NetworkCoverage] Failed to load layer', summary.id, err)
    });
  }

  private addLayerToMap(layer: CoverageLayerDetail): void {
    if (!this.map || !layer.geoJson) return;

    const sourceId = `cov-src-${layer.id}`;
    const fillId   = `cov-fill-${layer.id}`;
    const lineId   = `cov-line-${layer.id}`;

    if (this.addedLayerIds.has(fillId)) return;

    const color = layer.color || LAYER_COLORS[layerColorKey(layer.technology, layer.layerType)] || '#888';

    let geoJsonData: any;
    try {
      geoJsonData = JSON.parse(layer.geoJson);
    } catch {
      console.warn('[NetworkCoverage] Invalid GeoJSON for layer', layer.id);
      return;
    }

    this.map.addSource(sourceId, { type: 'geojson', data: geoJsonData });

    // Insert below selected-case-layer so overlays always render on top
    this.map.addLayer({
      id: fillId,
      type: 'fill',
      source: sourceId,
      filter: ['==', '$type', 'Polygon'],
      paint: { 'fill-color': color, 'fill-opacity': 0.25 }
    }, 'selected-case-layer');

    this.map.addLayer({
      id: lineId,
      type: 'line',
      source: sourceId,
      filter: ['==', '$type', 'Polygon'],
      paint: { 'line-color': color, 'line-width': 1.5, 'line-opacity': 0.8 }
    }, 'selected-case-layer');

    this.addedLayerIds.add(fillId);
    this.addedLayerIds.add(lineId);

    this.applyVisibility(layer);
  }

  private applyVisibility(layer: CoverageLayerSummary): void {
    if (!this.map) return;
    const vis = this.visibility();
    const fillId = `cov-fill-${layer.id}`;
    const lineId = `cov-line-${layer.id}`;
    const value = this.isLayerVisible(layer, vis) ? 'visible' : 'none';
    if (this.map.getLayer(fillId)) this.map.setLayoutProperty(fillId, 'visibility', value);
    if (this.map.getLayer(lineId)) this.map.setLayoutProperty(lineId, 'visibility', value);
  }

  private isLayerVisible(layer: CoverageLayerSummary, vis: LayerVisibility): boolean {
    if (layer.technology === 'FOUR_G' && layer.layerType === 'COVERAGE') return vis.coverage4G;
    if (layer.technology === 'FIVE_G' && layer.layerType === 'COVERAGE') return vis.coverage5G;
    if (layer.technology === 'FOUR_G' && layer.layerType === 'WS')       return vis.ws4G;
    if (layer.technology === 'FIVE_G' && layer.layerType === 'WS')       return vis.ws5G;
    return true;
  }

  // ── Toggle handlers ───────────────────────────────────────────────────────────

  toggleVisibility(key: keyof LayerVisibility): void {
    this.visibility.update(v => ({ ...v, [key]: !v[key] }));
    this.layers().filter(l => l.status === 'ACTIVE').forEach(l => this.applyVisibility(l));

    if (key === 'points' && this.map?.getLayer('points-layer')) {
      this.map.setLayoutProperty('points-layer', 'visibility', this.visibility().points ? 'visible' : 'none');
    }
  }

  // ── Upload ────────────────────────────────────────────────────────────────────

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.uploadFile = input.files?.[0] ?? null;
  }

  submitUpload(): void {
    if (!this.uploadFile || !this.uploadName.trim()) {
      this.uploadError.set('Please select a file and enter a layer name.');
      return;
    }

    this.uploadError.set(null);
    this.uploadSuccess.set(null);
    this.loadingUpload.set(true);

    const form = new FormData();
    form.append('file', this.uploadFile);
    form.append('name', this.uploadName.trim());
    form.append('technology', this.uploadTechnology);
    form.append('layerType', this.uploadLayerType);
    if (this.uploadGovernorate.trim()) form.append('governorate', this.uploadGovernorate.trim());
    if (this.uploadColor.trim())        form.append('color', this.uploadColor.trim());

    this.coverageSvc.uploadLayer(form).subscribe({
      next: detail => {
        this.loadingUpload.set(false);
        this.uploadSuccess.set(`Layer "${detail.name}" uploaded and converted successfully.`);
        this.resetUploadForm();
        this.coverageSvc.getLayers().subscribe(summaries => {
          this.layers.set(summaries);
          this.addLayerToMap(detail);
        });
      },
      error: err => {
        this.loadingUpload.set(false);
        this.uploadError.set(err?.error?.message ?? err?.message ?? 'Upload failed.');
      }
    });
  }

  private resetUploadForm(): void {
    this.uploadFile        = null;
    this.uploadName        = '';
    this.uploadTechnology  = 'FOUR_G';
    this.uploadLayerType   = 'COVERAGE';
    this.uploadGovernorate = '';
    this.uploadColor       = '';
  }

  archiveLayer(id: string): void {
    this.coverageSvc.archiveLayer(id).subscribe({
      next: () => {
        this.layers.update(list => list.map(l => l.id === id ? { ...l, status: 'ARCHIVED' } : l));
        const fillId = `cov-fill-${id}`;
        const lineId = `cov-line-${id}`;
        if (this.map?.getLayer(fillId)) this.map.setLayoutProperty(fillId, 'visibility', 'none');
        if (this.map?.getLayer(lineId)) this.map.setLayoutProperty(lineId, 'visibility', 'none');
      },
      error: err => console.error('[NetworkCoverage] Archive failed', err)
    });
  }

  // ── Activation (merged-analytics) markers ───────────────────────────────────────

  /**
   * Loads activation markers from the latest imported Merged Operations file
   * (merged-analytics rows where SOURCE = MES) and plots them on the map.
   * Replaces the old case-entity coverage analysis as the marker source.
   */
  loadActivationPoints(): void {
    this.pointsError.set(null);
    this.loadingPoints.set(true);
    this.clearSelection();

    this.analysisSvc.getAnalyticsPoints('MES').subscribe({
      next: res => {
        this.loadingPoints.set(false);
        this.pointsLoaded.set(true);
        this.hasStudy.set(res.studyId != null);
        this.totalPoints.set(res.totalMatching);
        this.capped.set(res.capped);
        this.points.set(res.points);
        this.plotPointMarkers(res.points);
      },
      error: err => {
        this.loadingPoints.set(false);
        this.pointsLoaded.set(true);
        this.pointsError.set(err?.error?.message ?? 'Failed to load activation coverage data.');
      }
    });
  }

  private plotPointMarkers(points: CoverageAnalyticsPoint[]): void {
    if (!this.map) return;

    const features = points
      .filter(p => p.latitude != null && p.longitude != null)
      .map(p => ({
        type: 'Feature' as const,
        properties: { id: p.id },
        geometry: { type: 'Point' as const, coordinates: [p.longitude, p.latitude] }
      }));

    const data = { type: 'FeatureCollection' as const, features };
    const existing = this.map.getSource('points-src') as any;

    if (existing) {
      existing.setData(data);
    } else {
      this.map.addSource('points-src', { type: 'geojson', data });

      // Insert below selected-case-layer so the selection marker stays on top
      this.map.addLayer({
        id: 'points-layer',
        type: 'circle',
        source: 'points-src',
        paint: {
          'circle-radius': 5,
          'circle-color': ACTIVATION_MARKER_COLOR,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#fff',
          'circle-opacity': 0.85
        }
      }, 'selected-case-layer');

      this.bindPointHandlers();
    }

    if (!this.visibility().points && this.map.getLayer('points-layer')) {
      this.map.setLayoutProperty('points-layer', 'visibility', 'none');
    }
  }

  /** Binds click/hover handlers once — the source data is swapped in place on reload. */
  private bindPointHandlers(): void {
    if (!this.map || this.pointHandlersBound) return;
    this.pointHandlersBound = true;

    this.map.on('click', 'points-layer', (e: any) => {
      const id = e.features?.[0]?.properties?.['id'];
      if (id == null) return;
      const match = this.points().find(p => p.id === id);
      if (match) this.selectPoint(match);
    });

    this.map.on('mouseenter', 'points-layer', () => {
      if (this.map) this.map.getCanvas().style.cursor = 'pointer';
    });
    this.map.on('mouseleave', 'points-layer', () => {
      if (this.map) this.map.getCanvas().style.cursor = '';
    });
  }

  // ── Selection ─────────────────────────────────────────────────────────────────

  /**
   * Selects a point from the results table or map click:
   * - Updates the right-panel detail view
   * - Flies the map to the point coordinates at zoom 14
   * - Moves the gold selected-case-layer marker to the point position
   */
  selectPoint(point: CoverageAnalyticsPoint): void {
    this.selectedPoint.set(point);

    if (this.map && point.longitude != null && point.latitude != null) {
      this.map.flyTo({ center: [point.longitude, point.latitude], zoom: 14 });

      (this.map.getSource('selected-case-source') as any)?.setData({
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          properties: { crmCase: point.caseCrm },
          geometry: { type: 'Point', coordinates: [point.longitude, point.latitude] }
        }]
      });
    }
  }

  clearSelection(): void {
    this.selectedPoint.set(null);
    (this.map?.getSource('selected-case-source') as any)?.setData({
      type: 'FeatureCollection', features: []
    });
  }

  // ── Coordinate lookup ─────────────────────────────────────────────────────────

  /**
   * Parses coordInput, validates, then flies the map and places the magenta locate marker.
   * Accepts: "36.8065, 10.1815"  |  "36.8065,10.1815"  |  "36.8065 10.1815"
   */
  locateCoordinate(): void {
    const parsed = this.parseCoordInput();
    if (!parsed) return;
    const [lat, lon] = parsed;

    this.coordError = null;
    this.pointCheckResult.set(null);
    this.placeLocateMarker(lat, lon);
    this.map?.flyTo({ center: [lon, lat], zoom: 15 });
  }

  /**
   * Validates, places the locate marker, then calls POST /check-point
   * and displays the coverage result inline in the coord bar.
   */
  checkPointCoverage(): void {
    const parsed = this.parseCoordInput();
    if (!parsed) return;
    const [lat, lon] = parsed;

    this.coordError = null;
    this.pointCheckResult.set(null);
    this.loadingPointCheck.set(true);

    // Move map immediately — don't wait for backend
    this.placeLocateMarker(lat, lon);
    this.map?.flyTo({ center: [lon, lat], zoom: 15 });

    this.analysisSvc.checkPoint(lat, lon).subscribe({
      next: result => {
        this.loadingPointCheck.set(false);
        this.pointCheckResult.set(result);
      },
      error: err => {
        this.loadingPointCheck.set(false);
        this.coordError = err?.error?.message ?? 'Coverage check failed.';
      }
    });
  }

  clearLocateMarker(): void {
    this.pointCheckResult.set(null);
    this.coordInput = '';
    this.coordError = null;
    (this.map?.getSource('locate-source') as any)?.setData({
      type: 'FeatureCollection', features: []
    });
  }

  private placeLocateMarker(lat: number, lon: number): void {
    (this.map?.getSource('locate-source') as any)?.setData({
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        properties: { latitude: lat, longitude: lon },
        geometry: { type: 'Point', coordinates: [lon, lat] }
      }]
    });
  }

  /** Parses coordInput into [lat, lon]. Sets coordError and returns null on failure. */
  private parseCoordInput(): [number, number] | null {
    const raw = this.coordInput.trim();
    if (!raw) {
      this.coordError = 'Enter coordinates to locate (e.g. 36.8065, 10.1815).';
      return null;
    }

    // Split on comma, space, or both
    const parts = raw.split(/[\s,]+/).map(p => p.trim()).filter(Boolean);
    if (parts.length !== 2) {
      this.coordError = 'Enter coordinates as "latitude, longitude" (e.g. 36.8065, 10.1815).';
      return null;
    }

    const lat = parseFloat(parts[0]);
    const lon = parseFloat(parts[1]);

    if (isNaN(lat) || isNaN(lon)) {
      this.coordError = 'Coordinates must be valid numbers.';
      return null;
    }
    if (lat < -90 || lat > 90) {
      this.coordError = 'Latitude must be between −90 and 90.';
      return null;
    }
    if (lon < -180 || lon > 180) {
      this.coordError = 'Longitude must be between −180 and 180.';
      return null;
    }

    this.coordError = null;
    return [lat, lon];
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  techLabel(tech: CoverageTechnology): string {
    return tech === 'FOUR_G' ? '4G' : '5G';
  }

  typeLabel(type: CoverageLayerType): string {
    return type === 'COVERAGE' ? 'Coverage' : 'WS';
  }

  decisionBadgeClass(decision: string): string {
    if (decision?.includes('4G and 5G')) return 'badge-dual';
    if (decision?.includes('4G only'))   return 'badge-4g';
    if (decision?.includes('5G only'))   return 'badge-5g';
    return 'badge-outside';
  }

  layerColor(tech: CoverageTechnology, type: CoverageLayerType): string {
    return LAYER_COLORS[layerColorKey(tech, type)] || '#888';
  }
}
