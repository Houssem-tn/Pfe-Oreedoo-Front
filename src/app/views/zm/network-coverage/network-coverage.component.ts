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
  FullscreenControl,
  GeoJSONSource,
  Map as MapLibreMap,
  NavigationControl,
  Popup,
  setRTLTextPlugin
} from 'maplibre-gl';
import { Subscription } from 'rxjs';
import { finalize } from 'rxjs/operators';

import { MAP_STYLE_URL } from '../../../core/map/map.config';
import { AuthStore } from '../../../core/auth/auth.store';
import { CoverageService } from '../../../core/coverage/coverage.service';
import { CoverageAnalysisService } from '../../../core/coverage/coverage-analysis.service';
import {
  CoverageAnalyticsPoint,
  CoverageLayerDetail,
  CoverageLayerSummary,
  CoveragePointFeature,
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

/** Clustering configuration for the activation points source. */
const CLUSTER_RADIUS = 50;
const CLUSTER_MAX_ZOOM = 14;

/** Rows rendered per page in the results table — keeps the DOM light with 50K+ points. */
const TABLE_PAGE_SIZE = 50;

/** Zoom used when focusing a single point (search / row click) — above CLUSTER_MAX_ZOOM so it is unclustered. */
const FOCUS_ZOOM = 15;

/** MapLibre source + layer ids for the clustered activation points. */
const SRC_POINTS      = 'activation-mes-points';
const LAYER_CLUSTERS  = 'clusters';
const LAYER_CLUSTER_COUNT = 'cluster-count';
const LAYER_POINTS    = 'unclustered-point';

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
  /** All MES points, loaded once and kept in memory; MapLibre clusters them client-side. */
  readonly points        = signal<CoverageAnalyticsPoint[]>([]);
  readonly selectedPoint = signal<CoverageAnalyticsPoint | null>(null);
  readonly totalPoints   = signal(0);
  readonly capped        = signal(false);
  readonly hasStudy      = signal(true);

  readonly loadingPoints = signal(false);
  readonly pointsError   = signal<string | null>(null);
  readonly pointsLoaded  = signal(false);

  // ── Results table pagination (never renders all 50K+ rows at once) ──────────────
  readonly tablePage  = signal(0);
  readonly pageSize   = TABLE_PAGE_SIZE;
  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.points().length / this.pageSize)));
  readonly pagedPoints = computed(() => {
    const start = this.tablePage() * this.pageSize;
    return this.points().slice(start, start + this.pageSize);
  });

  // ── MSISDN search ───────────────────────────────────────────────────────────────
  msisdnInput = '';
  readonly loadingSearch = signal(false);
  readonly searchError   = signal<string | null>(null);
  readonly searchResults = signal<CoverageAnalyticsPoint[]>([]);

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
  private pointsLayersReady = false;
  private popup: Popup | null = null;

  /** One-time resize after the summary/table appear and shrink the map area. */
  private firstPointsLoaded = false;

  /** Active point-load / search subscriptions — cancelled before a new one starts. */
  private pointsSub?: Subscription;
  private searchSub?: Subscription;

  // ── Lifecycle ─────────────────────────────────────────────────────────────────

  ngAfterViewInit(): void {
    setTimeout(() => this.initMap(), 0);
  }

  ngOnDestroy(): void {
    this.pointsSub?.unsubscribe();
    this.searchSub?.unsubscribe();
    this.popup?.remove();
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
      this.map.addControl(new FullscreenControl(), 'top-right');

      this.map.on('load', () => {
        this.map?.resize();
        this.initOverlaySources();
        this.initPointsLayers();
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
   *  - selected-case-source / selected-case-layer  (gold ring — updated on row/point click)
   *  - locate-source / locate-layer               (magenta dot — updated on coord locate)
   *
   * Coverage polygon layers and the clustered points layers are added BEFORE these via
   * beforeId so these overlays always render on top.
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

    if (key === 'points') {
      this.setPointsVisibility(this.visibility().points);
    }
  }

  private setPointsVisibility(visible: boolean): void {
    if (!this.map) return;
    const value = visible ? 'visible' : 'none';
    for (const id of [LAYER_CLUSTERS, LAYER_CLUSTER_COUNT, LAYER_POINTS]) {
      if (this.map.getLayer(id)) this.map.setLayoutProperty(id, 'visibility', value);
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
   * Adds the clustered activation-points source + its three layers (cluster circles,
   * cluster count labels, individual points) once, and binds the click/hover handlers.
   * The source starts empty; {@link loadActivationPoints} fills it once with all MES points.
   */
  private initPointsLayers(): void {
    if (!this.map || this.pointsLayersReady) return;

    this.map.addSource(SRC_POINTS, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
      cluster: true,
      clusterRadius: CLUSTER_RADIUS,
      clusterMaxZoom: CLUSTER_MAX_ZOOM
    });

    // Cluster circles — size + color step up with the number of points.
    this.map.addLayer({
      id: LAYER_CLUSTERS,
      type: 'circle',
      source: SRC_POINTS,
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': ['step', ['get', 'point_count'], '#42A5F5', 100, '#1E88E5', 750, '#1565C0'],
        'circle-radius': ['step', ['get', 'point_count'], 15, 100, 20, 750, 28],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#fff',
        'circle-opacity': 0.9
      }
    }, 'selected-case-layer');

    // Cluster count labels.
    this.map.addLayer({
      id: LAYER_CLUSTER_COUNT,
      type: 'symbol',
      source: SRC_POINTS,
      filter: ['has', 'point_count'],
      layout: {
        'text-field': ['get', 'point_count_abbreviated'],
        'text-font': ['Noto Sans Bold', 'Noto Sans Regular'],
        'text-size': 12
      },
      paint: { 'text-color': '#ffffff' }
    }, 'selected-case-layer');

    // Individual (unclustered) points.
    this.map.addLayer({
      id: LAYER_POINTS,
      type: 'circle',
      source: SRC_POINTS,
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-radius': 6,
        'circle-color': ACTIVATION_MARKER_COLOR,
        'circle-stroke-width': 1.5,
        'circle-stroke-color': '#fff',
        'circle-opacity': 0.9
      }
    }, 'selected-case-layer');

    this.bindPointHandlers();
    this.setPointsVisibility(this.visibility().points);
    this.pointsLayersReady = true;
  }

  /**
   * Loads ALL activation (SOURCE = MES) markers ONCE and hands them to the clustered
   * MapLibre source. There is no per-move / per-zoom backend call: clustering and
   * unclustering happen entirely client-side, so panning/zooming never reloads data and
   * the map cannot get stuck in a refresh loop. Called on first map load and by the manual
   * "Reload Activation (MES)" button.
   */
  loadActivationPoints(): void {
    this.pointsError.set(null);
    this.clearSelection();

    // Cancel any in-flight load so we never run duplicate concurrent requests.
    this.pointsSub?.unsubscribe();
    this.loadingPoints.set(true);

    this.pointsSub = this.analysisSvc.getAllAnalyticsPoints('MES').pipe(
      finalize(() => this.loadingPoints.set(false))   // loading always stops, success or fail
    ).subscribe({
      next: res => this.applyPointsResponse(res.features, res.studyId, res.totalMatching, res.capped),
      error: err => {
        this.pointsLoaded.set(true);
        this.pointsError.set(err?.error?.message ?? 'Failed to load activation coverage data.');
      }
    });
  }

  private applyPointsResponse(
    features: CoveragePointFeature[],
    studyId: string | null,
    totalMatching: number,
    capped: boolean
  ): void {
    this.pointsLoaded.set(true);
    this.pointsError.set(null);
    this.hasStudy.set(studyId != null);
    this.totalPoints.set(totalMatching);
    this.capped.set(capped);
    this.points.set(features.map(f => f.properties));
    this.tablePage.set(0);

    // Update ONLY the existing source's data — the source is never removed/re-added, and
    // setData does not move the camera, so it triggers no reload.
    const src = this.map?.getSource(SRC_POINTS) as GeoJSONSource | undefined;
    src?.setData({ type: 'FeatureCollection', features: features as any });

    // The first load reveals the summary bar + table, which shrink the map area; fix the
    // canvas size once after the DOM has re-rendered. No moveend listener exists, so this
    // resize cannot cause a reload.
    if (!this.firstPointsLoaded) {
      this.firstPointsLoaded = true;
      setTimeout(() => this.map?.resize(), 0);
    }
  }

  // ── Results table pagination ────────────────────────────────────────────────────

  prevPage(): void {
    if (this.tablePage() > 0) this.tablePage.update(p => p - 1);
  }

  nextPage(): void {
    if (this.tablePage() < this.totalPages() - 1) this.tablePage.update(p => p + 1);
  }

  // ── MSISDN search ─────────────────────────────────────────────────────────────

  /**
   * Searches MES analytics rows by MSISDN via the backend and locates the match on the map.
   * Does NOT reload the MES point set. 0 matches → message; 1 → focus it; many → a small
   * chooser list (see {@link focusSearchResult}).
   */
  searchByMsisdn(): void {
    const msisdn = this.msisdnInput.trim();
    this.searchError.set(null);
    this.searchResults.set([]);
    if (!msisdn) {
      this.searchError.set('Enter an MSISDN to search.');
      return;
    }

    this.searchSub?.unsubscribe();
    this.loadingSearch.set(true);
    this.searchSub = this.analysisSvc.searchByMsisdn('MES', msisdn).pipe(
      finalize(() => this.loadingSearch.set(false))
    ).subscribe({
      next: results => {
        if (results.length === 0) {
          this.searchError.set('No MES point found for this MSISDN.');
        } else if (results.length === 1) {
          this.focusSearchResult(results[0]);
        } else {
          this.searchResults.set(results);   // multiple rows → let the user pick one
        }
      },
      error: err => this.searchError.set(err?.error?.message ?? 'MSISDN search failed.')
    });
  }

  /** Focuses a search result: flies to it (zoom 15, unclustered), highlights it, opens details + popup. */
  focusSearchResult(p: CoverageAnalyticsPoint): void {
    this.searchResults.set([]);
    this.searchError.set(null);
    this.selectPoint(p, true, FOCUS_ZOOM);
    if (this.map && p.longitude != null && p.latitude != null) {
      this.showPointPopup([p.longitude, p.latitude], p);
    }
  }

  clearSearch(): void {
    this.msisdnInput = '';
    this.searchError.set(null);
    this.searchResults.set([]);
  }

  /**
   * Binds cluster + point interactions once — the source data is swapped in place on reload:
   *  - click a cluster → zoom to its expansion level
   *  - click a point   → popup with the technical fields + right-panel detail
   */
  private bindPointHandlers(): void {
    if (!this.map) return;

    // Cluster click → expand.
    this.map.on('click', LAYER_CLUSTERS, (e: any) => {
      if (!this.map) return;
      const feats = this.map.queryRenderedFeatures(e.point, { layers: [LAYER_CLUSTERS] });
      const clusterId = feats[0]?.properties?.['cluster_id'];
      if (clusterId == null) return;
      const src = this.map.getSource(SRC_POINTS) as GeoJSONSource;
      src.getClusterExpansionZoom(clusterId).then(zoom => {
        const coords = (feats[0].geometry as any).coordinates;
        this.map?.easeTo({ center: coords, zoom });
      }).catch(() => { /* ignore expansion errors */ });
    });

    // Individual point click → popup + selection (no fly; the user clicked what they see).
    this.map.on('click', LAYER_POINTS, (e: any) => {
      const feature = e.features?.[0];
      if (!feature) return;
      const point = feature.properties as CoverageAnalyticsPoint;
      const coords = (feature.geometry as any).coordinates as [number, number];
      this.showPointPopup(coords, point);
      this.selectPoint(point, false);
    });

    // Pointer cursor over interactive layers.
    for (const id of [LAYER_CLUSTERS, LAYER_POINTS]) {
      this.map.on('mouseenter', id, () => {
        if (this.map) this.map.getCanvas().style.cursor = 'pointer';
      });
      this.map.on('mouseleave', id, () => {
        if (this.map) this.map.getCanvas().style.cursor = '';
      });
    }
  }

  private showPointPopup(coords: [number, number], p: CoverageAnalyticsPoint): void {
    if (!this.map) return;
    if (!this.popup) {
      this.popup = new Popup({ closeButton: true, closeOnClick: true, maxWidth: '280px' });
    }
    this.popup.setLngLat(coords).setHTML(this.buildPopupHtml(p)).addTo(this.map);
  }

  private buildPopupHtml(p: CoverageAnalyticsPoint): string {
    const esc = (v: unknown) =>
      (v == null || v === '')
        ? '—'
        : String(v).replace(/[&<>"']/g, c =>
            ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]);
    const num = (v: number | null | undefined) => (v == null ? '—' : Number(v).toFixed(2));
    const row = (label: string, value: string) =>
      `<div class="mc-popup__row"><span>${label}</span><b>${value}</b></div>`;

    return `<div class="mc-popup">
      <div class="mc-popup__title">${esc(p.caseCrm)}</div>
      ${row('MSISDN', esc(p.msisdn))}
      ${row('Governorate', esc(p.governorate))}
      ${row('Delegation', esc(p.delegation))}
      ${row('Locality', esc(p.locality))}
      ${row('DEBIT_DL', num(p.debitDl))}
      ${row('DEBIT_UL', num(p.debitUl))}
      ${row('RSRP', num(p.rsrp))}
      ${row('RSRQ', num(p.rsrq))}
      ${row('SINR', num(p.sinr))}
    </div>`;
  }

  // ── Selection ─────────────────────────────────────────────────────────────────

  /**
   * Selects a point from the results table, a map click, or an MSISDN search:
   * - Updates the right-panel detail view
   * - Moves the gold selected-case-layer marker to the point (highlight, renders above clusters)
   * - Optionally flies the map to the point (table/search fly; map clicks stay put)
   */
  selectPoint(point: CoverageAnalyticsPoint, fly = true, zoom = 14): void {
    this.selectedPoint.set(point);
    this.setSelectedMarker(point);

    if (fly && this.map && point.longitude != null && point.latitude != null) {
      this.map.flyTo({ center: [point.longitude, point.latitude], zoom });
    }
  }

  /** Highlights the point with the gold selected-case marker (empty features clears it). */
  private setSelectedMarker(point: CoverageAnalyticsPoint | null): void {
    const features = (point && point.longitude != null && point.latitude != null)
      ? [{
          type: 'Feature',
          properties: { crmCase: point.caseCrm },
          geometry: { type: 'Point', coordinates: [point.longitude, point.latitude] }
        }]
      : [];
    (this.map?.getSource('selected-case-source') as any)?.setData({
      type: 'FeatureCollection', features
    });
  }

  clearSelection(): void {
    this.selectedPoint.set(null);
    this.popup?.remove();
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
