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
  CoverageAnalysisResult,
  CoverageAnalysisSummary,
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

interface LayerVisibility {
  coverage4G: boolean;
  coverage5G: boolean;
  ws4G: boolean;
  ws5G: boolean;
  cases: boolean;
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

  // ── Coverage state ────────────────────────────────────────────────────────────
  readonly layers          = signal<CoverageLayerSummary[]>([]);
  readonly analysisResults = signal<CoverageAnalysisResult[]>([]);
  readonly summary         = signal<CoverageAnalysisSummary | null>(null);
  readonly selectedResult  = signal<CoverageAnalysisResult | null>(null);

  readonly loadingLayers   = signal(false);
  readonly loadingUpload   = signal(false);
  readonly loadingAnalysis = signal(false);
  readonly mapError        = signal<string | null>(null);
  readonly uploadError     = signal<string | null>(null);
  readonly uploadSuccess   = signal<string | null>(null);
  readonly analysisError   = signal<string | null>(null);

  readonly visibility = signal<LayerVisibility>({
    coverage4G: true,
    coverage5G: true,
    ws4G: true,
    ws5G: true,
    cases: true
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
   * Coverage polygon layers and cases-layer are added BEFORE these via beforeId so
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

    if (key === 'cases' && this.map?.getLayer('cases-layer')) {
      this.map.setLayoutProperty('cases-layer', 'visibility', this.visibility().cases ? 'visible' : 'none');
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

  // ── Analysis ──────────────────────────────────────────────────────────────────

  runAnalysis(): void {
    this.analysisError.set(null);
    this.loadingAnalysis.set(true);

    this.analysisSvc.runAnalysis().subscribe({
      next: sum => {
        this.summary.set(sum);
        this.loadingAnalysis.set(false);
        this.fetchResults();
      },
      error: err => {
        this.loadingAnalysis.set(false);
        this.analysisError.set(err?.error?.message ?? 'Analysis failed.');
      }
    });
  }

  private fetchResults(): void {
    this.analysisSvc.getAllResults().subscribe({
      next: results => {
        this.analysisResults.set(results);
        this.plotCaseMarkers(results);
      }
    });
  }

  private plotCaseMarkers(results: CoverageAnalysisResult[]): void {
    if (!this.map) return;

    if (this.map.getLayer('cases-layer')) this.map.removeLayer('cases-layer');
    if (this.map.getSource('cases-src'))  this.map.removeSource('cases-src');

    const features = results
      .filter(r => r.latitude != null && r.longitude != null)
      .map(r => ({
        type: 'Feature' as const,
        properties: {
          id: r.id,
          crmCase: r.crmCase,
          caseType: r.caseType,
          decision: r.decision,
          color: r.inside4G || r.inside5G ? '#4CAF50' : '#F44336'
        },
        geometry: {
          type: 'Point' as const,
          coordinates: [r.longitude, r.latitude]
        }
      }));

    this.map.addSource('cases-src', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features }
    });

    // Insert below selected-case-layer so selection marker stays on top
    this.map.addLayer({
      id: 'cases-layer',
      type: 'circle',
      source: 'cases-src',
      paint: {
        'circle-radius': 5,
        'circle-color': ['get', 'color'],
        'circle-stroke-width': 1.5,
        'circle-stroke-color': '#fff',
        'circle-opacity': 0.85
      }
    }, 'selected-case-layer');

    this.map.on('click', 'cases-layer', (e: any) => {
      const props = e.features?.[0]?.properties;
      if (!props) return;
      const match = this.analysisResults().find(r => r.id === props['id']);
      if (match) this.selectResult(match);
    });

    this.map.on('mouseenter', 'cases-layer', () => {
      if (this.map) this.map.getCanvas().style.cursor = 'pointer';
    });
    this.map.on('mouseleave', 'cases-layer', () => {
      if (this.map) this.map.getCanvas().style.cursor = '';
    });

    if (!this.visibility().cases) {
      this.map.setLayoutProperty('cases-layer', 'visibility', 'none');
    }
  }

  // ── Selection ─────────────────────────────────────────────────────────────────

  /**
   * Selects a case from the results table or map click:
   * - Updates the right-panel detail view
   * - Flies the map to the case coordinates at zoom 14
   * - Moves the gold selected-case-layer marker to the case position
   */
  selectResult(result: CoverageAnalysisResult): void {
    this.selectedResult.set(result);

    if (this.map && result.longitude != null && result.latitude != null) {
      this.map.flyTo({ center: [result.longitude, result.latitude], zoom: 14 });

      (this.map.getSource('selected-case-source') as any)?.setData({
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          properties: { crmCase: result.crmCase },
          geometry: { type: 'Point', coordinates: [result.longitude, result.latitude] }
        }]
      });
    }
  }

  clearSelection(): void {
    this.selectedResult.set(null);
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
