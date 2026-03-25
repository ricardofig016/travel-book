import { HttpClient } from '@angular/common/http';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  OnDestroy,
  OnInit,
  signal,
  ViewChild,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { BookStateService } from '../../services/data/book-state.service';
import { SupabaseService } from '../../services/data/supabase.service';
import {
  BookCountryMarkerSummary,
  CountryCapitalCity,
  CountryMetadata,
  CountryIsoLookup,
} from '../../services/data/supabase/models';

type Position = [number, number];

interface GeoJsonFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJsonFeature[];
}

interface GeoJsonFeature {
  type: 'Feature';
  properties?: GeoJsonProperties;
  geometry: GeoJsonGeometry | null;
}

interface GeoJsonProperties {
  name?: string;
  'ISO3166-1-Alpha-3'?: string;
  'ISO3166-1-Alpha-2'?: string;
}

interface CountryShape {
  id: string;
  name: string;
  iso2: string;
  iso3: string;
  parts: number;
  paths: string[];
}

interface EmptyMarkerSummary extends BookCountryMarkerSummary {}

interface CapitalDot {
  name: string;
  x: number;
  y: number;
}

type GeoJsonGeometry =
  | { type: 'Polygon'; coordinates: Position[][] }
  | { type: 'MultiPolygon'; coordinates: Position[][][] };

@Component({
  selector: 'app-world-map',
  standalone: true,
  imports: [],
  templateUrl: './world-map.component.html',
  styleUrl: './world-map.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorldMapComponent implements OnInit, AfterViewInit, OnDestroy {
  private static readonly HOVERED_COUNTRY_FILL = '#f2af55';
  private static readonly HOME_COUNTRY_FILL = '#7fcf6e';
  private static readonly VISITED_COUNTRY_FILL = '#8fa8ff';
  private static readonly DEFAULT_COUNTRY_FILL = 'transparent';

  @ViewChild('mapCanvas') mapCanvas!: ElementRef<HTMLDivElement>;
  private http = inject(HttpClient);
  private supabase = inject(SupabaseService);
  private bookState = inject(BookStateService);
  private readonly hoverDebugEnabled = true;
  private boundWheelHandler: ((event: WheelEvent) => void) | null = null;

  protected readonly mapWidth = 1200;
  protected readonly mapHeight = 600;
  protected readonly minZoom = 1;
  protected readonly maxZoom = 15;
  protected readonly zoomStep = 0.2;
  protected readonly ctrlZoomMultiplier = 3;
  protected readonly defaultZoom = 2;

  protected readonly countries = signal<CountryShape[]>([]);
  protected readonly gridPaths = signal<{
    meridians: string[];
    parallels: string[];
  }>({ meridians: [], parallels: [] });
  protected readonly hoveredCountryId = signal<string | null>(null);
  protected readonly homeCountryIso2 = signal<string | null>(null);
  protected readonly visitedCountryIso2s = signal<Set<string>>(new Set());
  protected readonly visitedLandAreaPercent = signal(0);
  protected readonly visitedLandAreaSqKm = signal(0);
  protected readonly totalLandAreaSqKm = signal(0);
  protected readonly bookMarkerCount = signal(0);
  protected readonly homeCountryMetadata = signal<CountryMetadata | null>(null);
  protected readonly hoveredCountryMetadata = signal<CountryMetadata | null>(
    null,
  );
  protected readonly hoveredCountryMarkerSummary =
    signal<BookCountryMarkerSummary>(this.emptyMarkerSummary());
  protected readonly hoveredCapitalDot = signal<CapitalDot | null>(null);
  protected readonly visitedLandAreaLabel = computed(
    () => `${this.visitedLandAreaPercent().toFixed(2)}%`,
  );
  protected readonly homeCountryVisited = computed(() => {
    const homeIso2 = this.homeCountryMetadata()?.iso_code_2;
    if (!homeIso2) return false;

    return this.visitedCountryIso2s().has(homeIso2);
  });
  protected readonly homeCountryWorldAreaPercent = computed(() => {
    const homeArea = this.homeCountryMetadata()?.area;
    const totalArea = this.totalLandAreaSqKm();
    if (!homeArea || totalArea <= 0) return 0;

    return (homeArea / totalArea) * 100;
  });
  protected readonly hoveredCountryWorldAreaPercent = computed(() => {
    const hoveredArea = this.hoveredCountryMetadata()?.area;
    const totalArea = this.totalLandAreaSqKm();
    if (!hoveredArea || totalArea <= 0) return 0;

    return (hoveredArea / totalArea) * 100;
  });
  protected readonly hoveredMarkerCitiesLabel = computed(() => {
    const cities = this.hoveredCountryMarkerSummary().markerCities;
    if (cities.length === 0) return 'None';

    const visibleCount = 6;
    const visible = cities.slice(0, visibleCount).join(', ');
    if (cities.length <= visibleCount) return visible;

    return `${visible} +${cities.length - visibleCount} more`;
  });
  protected readonly homeCountry = computed(() => {
    const iso2 = this.homeCountryIso2();
    if (!iso2) {
      return null;
    }

    return this.countries().find((country) => country.iso2 === iso2) ?? null;
  });
  protected readonly hoveredCountry = computed(() => {
    const hoveredId = this.hoveredCountryId();
    if (!hoveredId) {
      return null;
    }

    return this.countries().find((country) => country.id === hoveredId) ?? null;
  });
  protected readonly zoom = signal(this.defaultZoom);
  protected readonly panX = signal(0);
  protected readonly panY = signal(0);
  protected readonly isDragging = signal(false);
  protected readonly mapTransform = computed(
    () => `translate(${this.panX()}px, ${this.panY()}px) scale(${this.zoom()})`,
  );
  protected readonly viewBox = computed(
    () => `0 0 ${this.mapWidth} ${this.mapHeight}`,
  );

  private activePointerId: number | null = null;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private hoveredMetadataRequestId = 0;
  private homeMetadataRequestId = 0;
  private countryMetadataCache = new Map<string, CountryMetadata | null>();
  private countryMetadataInFlight = new Map<
    string,
    Promise<CountryMetadata | null>
  >();
  private countryCapitalCache = new Map<string, CountryCapitalCity | null>();
  private countryCapitalInFlight = new Map<
    string,
    Promise<CountryCapitalCity | null>
  >();
  private markerSummaryCache = new Map<string, BookCountryMarkerSummary>();
  private markerSummaryInFlight = new Map<
    string,
    Promise<BookCountryMarkerSummary>
  >();

  constructor() {
    effect(() => {
      const bookId = this.bookState.selectedBook()?.id ?? null;
      void this.loadVisitedMetadata(bookId);
    });

    effect(() => {
      const iso2 = this.homeCountryIso2();
      void this.loadHomeCountryMetadata(iso2);
    });

    effect(() => {
      const hoveredIso2 = this.hoveredCountry()?.iso2 ?? null;
      const bookId = this.bookState.selectedBook()?.id ?? null;
      void this.loadHoveredCountryMetadata(hoveredIso2, bookId);
    });
  }

  ngOnInit(): void {
    void this.loadMap();
    void this.loadTotalLandArea();
    void this.loadHomeCountry();
  }

  ngAfterViewInit(): void {
    // Create and bind the wheel handler
    this.boundWheelHandler = (event: WheelEvent) => {
      event.preventDefault();

      // Get pointer position relative to canvas element
      const canvasRect = this.mapCanvas.nativeElement.getBoundingClientRect();
      const pointerX = event.clientX - canvasRect.left;
      const pointerY = event.clientY - canvasRect.top;

      // Canvas/SVG center (transform-origin is center center)
      const centerX = canvasRect.width / 2;
      const centerY = canvasRect.height / 2;

      // Calculate which point in the original SVG space is under the cursor
      // Transform: translate(panX, panY) scale(zoom) with origin at center
      // Screen position = (svgPoint - center) * zoom + pan + center
      // Therefore: svgPoint = (screenPos - pan - center) / zoom + center
      const oldZoom = this.zoom();
      const oldPanX = this.panX();
      const oldPanY = this.panY();
      const svgPointX = (pointerX - oldPanX - centerX) / oldZoom + centerX;
      const svgPointY = (pointerY - oldPanY - centerY) / oldZoom + centerY;

      // Apply zoom
      const zoomDirection = event.deltaY < 0 ? 1 : -1;
      const zoomAmount = event.ctrlKey
        ? this.zoomStep * this.ctrlZoomMultiplier
        : this.zoomStep;
      const newZoom = Math.min(
        this.maxZoom,
        Math.max(this.minZoom, oldZoom + zoomDirection * zoomAmount),
      );
      this.zoom.set(Number(newZoom.toFixed(2)));

      // Calculate new pan to keep svgPoint at the same screen position
      // pointerX = (svgPointX - centerX) * newZoom + newPanX + centerX
      // newPanX = pointerX - (svgPointX - centerX) * newZoom - centerX
      const newPanX = pointerX - (svgPointX - centerX) * newZoom - centerX;
      const newPanY = pointerY - (svgPointY - centerY) * newZoom - centerY;
      const clampedPan = this.clampPan(newPanX, newPanY, newZoom);
      this.panX.set(clampedPan.x);
      this.panY.set(clampedPan.y);
    };

    // Attach with { passive: false } to allow preventDefault()
    this.mapCanvas.nativeElement.addEventListener(
      'wheel',
      this.boundWheelHandler,
      { passive: false },
    );
  }

  ngOnDestroy(): void {
    // Clean up the event listener
    if (this.boundWheelHandler && this.mapCanvas?.nativeElement) {
      this.mapCanvas.nativeElement.removeEventListener(
        'wheel',
        this.boundWheelHandler,
      );
    }
  }

  zoomIn(): void {
    this.setZoom(this.zoom() + this.zoomStep);
  }

  zoomOut(): void {
    this.setZoom(this.zoom() - this.zoomStep);
  }

  resetView(): void {
    this.zoom.set(this.defaultZoom);
    this.panX.set(0);
    this.panY.set(0);
  }

  onPointerDown(event: PointerEvent): void {
    if (event.button !== 0) {
      return;
    }

    this.activePointerId = event.pointerId;
    this.lastPointerX = event.clientX;
    this.lastPointerY = event.clientY;
    this.isDragging.set(true);
    event.preventDefault();
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.isDragging() || this.activePointerId !== event.pointerId) {
      return;
    }

    const dx = event.clientX - this.lastPointerX;
    const dy = event.clientY - this.lastPointerY;

    const clampedPan = this.clampPan(this.panX() + dx, this.panY() + dy);
    this.panX.set(clampedPan.x);
    this.panY.set(clampedPan.y);

    this.lastPointerX = event.clientX;
    this.lastPointerY = event.clientY;
    event.preventDefault();
  }

  onPointerUp(event: PointerEvent): void {
    if (this.activePointerId !== event.pointerId) {
      return;
    }

    this.activePointerId = null;
    this.isDragging.set(false);
  }

  onSvgPointerMove(event: PointerEvent): void {
    if (this.isDragging()) {
      this.setHoveredCountry(null, 'dragging');
      return;
    }

    const target = event.target as SVGElement;
    const pathElement = target.closest('path');
    if (!pathElement) {
      this.setHoveredCountry(null, 'no-path-target');
      return;
    }

    const group = pathElement.closest(
      '[data-country-id]',
    ) as SVGGElement | null;
    if (!group) {
      this.setHoveredCountry(null, 'non-country-path');
      return;
    }

    const countryId = group.getAttribute('data-country-id');
    this.setHoveredCountry(countryId, 'country-path');
  }

  onSvgPointerLeave(): void {
    this.setHoveredCountry(null, 'svg-leave');
  }

  protected getCountryFill(country: CountryShape): string {
    if (this.hoveredCountryId() === country.id)
      return WorldMapComponent.HOVERED_COUNTRY_FILL;

    if (this.homeCountryIso2() === country.iso2)
      return WorldMapComponent.HOME_COUNTRY_FILL;

    if (this.visitedCountryIso2s().has(country.iso2))
      return WorldMapComponent.VISITED_COUNTRY_FILL;

    return WorldMapComponent.DEFAULT_COUNTRY_FILL;
  }

  private setHoveredCountry(countryId: string | null, source: string): void {
    const previous = this.hoveredCountryId();
    if (previous === countryId) {
      return;
    }

    this.hoveredCountryId.set(countryId);

    if (!this.hoverDebugEnabled) {
      return;
    }

    const previousName = this.getCountryName(previous);
    const nextName = this.getCountryName(countryId);
    console.debug(
      `[WorldMap hover] ${source}: ${previousName} (${previous ?? 'none'}) -> ${nextName} (${countryId ?? 'none'})`,
    );
  }

  private getCountryName(countryId: string | null): string {
    if (!countryId) {
      return 'none';
    }

    const match = this.countries().find((country) => country.id === countryId);
    return match?.name ?? 'unknown';
  }

  private setZoom(value: number): void {
    const next = Math.min(this.maxZoom, Math.max(this.minZoom, value));
    this.zoom.set(Number(next.toFixed(2)));

    const clampedPan = this.clampPan(this.panX(), this.panY(), next);
    this.panX.set(clampedPan.x);
    this.panY.set(clampedPan.y);
  }

  private clampPan(
    x: number,
    y: number,
    zoomValue = this.zoom(),
  ): { x: number; y: number } {
    if (!this.mapCanvas?.nativeElement) {
      return { x, y };
    }

    const canvasRect = this.mapCanvas.nativeElement.getBoundingClientRect();
    const maxPanX = Math.max(
      0,
      (canvasRect.width * zoomValue - canvasRect.width) / 2,
    );
    const maxPanY = Math.max(
      0,
      (canvasRect.height * zoomValue - canvasRect.height) / 2,
    );

    return {
      x: Math.min(maxPanX, Math.max(-maxPanX, x)),
      y: Math.min(maxPanY, Math.max(-maxPanY, y)),
    };
  }

  private async loadMap(): Promise<void> {
    try {
      const [data, countryLookup] = await Promise.all([
        firstValueFrom(
          this.http.get<GeoJsonFeatureCollection>(
            'assets/data/geo/visvalingam-weighted_1.8pct_keepshapes_clean.geojson',
          ),
        ),
        this.supabase.getCountryIsoLookup(),
      ]);

      this.countries.set(this.buildCountries(data, countryLookup));
      this.gridPaths.set(this.buildGridPaths());
    } catch (error) {
      console.error('Failed to load countries GeoJSON for map preview', error);
      this.countries.set([]);
    }
  }

  private normalizeIso2(value?: string): string | null {
    const normalized = value?.trim().toUpperCase();
    if (!normalized || !/^[A-Z]{2}$/.test(normalized)) return null;

    return normalized;
  }

  private normalizeIso3(value?: string): string | null {
    const normalized = value?.trim().toUpperCase();
    if (!normalized || !/^[A-Z]{3}$/.test(normalized)) return null;

    return normalized;
  }

  private resolveIso2FromLookup(
    properties?: GeoJsonProperties,
    countryLookup?: CountryIsoLookup,
  ): string {
    if (!countryLookup)
      return this.normalizeIso2(properties?.['ISO3166-1-Alpha-2']) ?? 'N/A';

    const iso3 = this.normalizeIso3(properties?.['ISO3166-1-Alpha-3']);
    if (iso3 && countryLookup.byIso3[iso3]) return countryLookup.byIso3[iso3];

    const iso2 = this.normalizeIso2(properties?.['ISO3166-1-Alpha-2']);
    if (iso2 && countryLookup.byIso2[iso2]) return countryLookup.byIso2[iso2];

    const name = properties?.name?.trim().toLowerCase();
    if (name && countryLookup.byName[name]) return countryLookup.byName[name];

    return iso2 ?? 'N/A';
  }

  private buildCountries(
    collection: GeoJsonFeatureCollection,
    countryLookup?: CountryIsoLookup,
  ): CountryShape[] {
    const countries: CountryShape[] = [];
    let uniqueIndex = 0;

    for (const [index, feature] of collection.features.entries()) {
      if (!feature.geometry) continue;

      const countryPaths: string[] = [];

      if (feature.geometry.type === 'Polygon') {
        const path = this.buildPolygonPath(
          feature.geometry.coordinates,
          (point) => this.projectPoint(point),
        );
        if (path) countryPaths.push(path);
      }

      if (feature.geometry.type === 'MultiPolygon') {
        for (const polygon of feature.geometry.coordinates) {
          const path = this.buildPolygonPath(polygon, (point) =>
            this.projectPoint(point),
          );
          if (path) countryPaths.push(path);
        }
      }

      if (countryPaths.length === 0) continue;

      const baseId =
        feature.properties?.['ISO3166-1-Alpha-3'] ??
        feature.properties?.['ISO3166-1-Alpha-2'] ??
        feature.properties?.name ??
        `country-${index}`;

      countries.push({
        id: `${baseId}-${uniqueIndex++}`,
        name: feature.properties?.name ?? baseId,
        iso2: this.resolveIso2FromLookup(feature.properties, countryLookup),
        iso3: feature.properties?.['ISO3166-1-Alpha-3'] ?? 'N/A',
        parts: countryPaths.length,
        paths: countryPaths,
      });
    }

    return countries;
  }

  private async loadHomeCountry(): Promise<void> {
    try {
      const profile = await this.supabase.getUserProfile();
      if (!profile?.home_city_id) {
        this.homeCountryIso2.set(null);
        return;
      }

      const { data, error } = await this.supabase
        .getClient()
        .from('cities')
        .select('countries(iso_code_2)')
        .eq('id', profile.home_city_id)
        .single();

      if (error) {
        console.error('Failed to resolve home country from home city', error);
        this.homeCountryIso2.set(null);
        return;
      }

      const iso2 = (data as { countries?: { iso_code_2?: string } | null })
        ?.countries?.iso_code_2;
      this.homeCountryIso2.set(iso2?.toUpperCase() ?? null);
    } catch (err) {
      console.error('Failed to load user home country', err);
      this.homeCountryIso2.set(null);
    }
  }

  private async loadVisitedMetadata(bookId: string | null): Promise<void> {
    if (!bookId) {
      this.visitedCountryIso2s.set(new Set());
      this.visitedLandAreaPercent.set(0);
      this.visitedLandAreaSqKm.set(0);
      this.bookMarkerCount.set(0);
      return;
    }

    try {
      const [iso2s, areaStats, markerCount] = await Promise.all([
        this.supabase.getVisitedCountryIso2s(bookId),
        this.supabase.getBookVisitedLandAreaStats(bookId),
        this.supabase.getBookMarkerCount(bookId),
      ]);

      this.visitedCountryIso2s.set(new Set(iso2s));
      this.visitedLandAreaPercent.set(areaStats.visitedPercent);
      this.visitedLandAreaSqKm.set(areaStats.visitedArea);
      this.bookMarkerCount.set(markerCount);
      if (areaStats.totalArea > 0)
        this.totalLandAreaSqKm.set(areaStats.totalArea);
    } catch (err) {
      console.error('Failed to load visited metadata', err);
      this.visitedCountryIso2s.set(new Set());
      this.visitedLandAreaPercent.set(0);
      this.visitedLandAreaSqKm.set(0);
      this.bookMarkerCount.set(0);
    }
  }

  private async loadTotalLandArea(): Promise<void> {
    try {
      const totalArea = await this.supabase.getTotalLandArea();
      this.totalLandAreaSqKm.set(totalArea);
    } catch (err) {
      console.error('Failed to load total land area', err);
      this.totalLandAreaSqKm.set(0);
    }
  }

  private async loadHomeCountryMetadata(iso2: string | null): Promise<void> {
    const requestId = ++this.homeMetadataRequestId;
    const normalizedIso2 = this.normalizeIso2(iso2 ?? undefined);
    if (!normalizedIso2) {
      this.homeCountryMetadata.set(null);
      return;
    }

    try {
      const metadata = await this.getCountryMetadataCached(normalizedIso2);
      if (requestId !== this.homeMetadataRequestId) return;

      this.homeCountryMetadata.set(metadata);
    } catch (err) {
      console.error('Failed to load home country metadata', err);
      if (requestId !== this.homeMetadataRequestId) return;

      this.homeCountryMetadata.set(null);
    }
  }

  private async loadHoveredCountryMetadata(
    iso2: string | null,
    bookId: string | null,
  ): Promise<void> {
    const requestId = ++this.hoveredMetadataRequestId;
    const normalizedIso2 = this.normalizeIso2(iso2 ?? undefined);

    if (!normalizedIso2) {
      this.hoveredCountryMetadata.set(null);
      this.hoveredCountryMarkerSummary.set(this.emptyMarkerSummary());
      this.hoveredCapitalDot.set(null);
      return;
    }

    const markerSummaryKey = this.getMarkerSummaryCacheKey(
      bookId,
      normalizedIso2,
    );
    if (this.countryMetadataCache.has(normalizedIso2))
      this.hoveredCountryMetadata.set(
        this.countryMetadataCache.get(normalizedIso2) ?? null,
      );
    else this.hoveredCountryMetadata.set(null);

    if (this.countryCapitalCache.has(normalizedIso2))
      this.hoveredCapitalDot.set(
        this.buildCapitalDot(
          this.countryCapitalCache.get(normalizedIso2) ?? null,
        ),
      );
    else this.hoveredCapitalDot.set(null);

    if (markerSummaryKey && this.markerSummaryCache.has(markerSummaryKey))
      this.hoveredCountryMarkerSummary.set(
        this.markerSummaryCache.get(markerSummaryKey) ??
          this.emptyMarkerSummary(),
      );
    else this.hoveredCountryMarkerSummary.set(this.emptyMarkerSummary());

    try {
      const [metadata, markerSummary, capitalCity] = await Promise.all([
        this.getCountryMetadataCached(normalizedIso2),
        this.getBookCountryMarkerSummaryCached(bookId, normalizedIso2),
        this.getCountryCapitalCached(normalizedIso2),
      ]);

      if (requestId !== this.hoveredMetadataRequestId) return;

      this.hoveredCountryMetadata.set(metadata);
      this.hoveredCountryMarkerSummary.set(markerSummary);
      this.hoveredCapitalDot.set(this.buildCapitalDot(capitalCity));
    } catch (err) {
      console.error('Failed to load hovered country metadata', err);
      if (requestId !== this.hoveredMetadataRequestId) return;

      this.hoveredCountryMetadata.set(null);
      this.hoveredCountryMarkerSummary.set(this.emptyMarkerSummary());
      this.hoveredCapitalDot.set(null);
    }
  }

  private getMarkerSummaryCacheKey(
    bookId: string | null,
    iso2: string,
  ): string | null {
    return bookId ? `${bookId}:${iso2}` : null;
  }

  private async getCountryMetadataCached(
    iso2: string,
  ): Promise<CountryMetadata | null> {
    if (this.countryMetadataCache.has(iso2))
      return this.countryMetadataCache.get(iso2) ?? null;

    const inFlightRequest = this.countryMetadataInFlight.get(iso2);
    if (inFlightRequest) return inFlightRequest;

    const request = this.supabase
      .getCountryMetadataByIso2(iso2)
      .then((metadata) => {
        this.countryMetadataCache.set(iso2, metadata);
        return metadata;
      })
      .finally(() => {
        this.countryMetadataInFlight.delete(iso2);
      });

    this.countryMetadataInFlight.set(iso2, request);
    return request;
  }

  private async getCountryCapitalCached(
    iso2: string,
  ): Promise<CountryCapitalCity | null> {
    if (this.countryCapitalCache.has(iso2))
      return this.countryCapitalCache.get(iso2) ?? null;

    const inFlightRequest = this.countryCapitalInFlight.get(iso2);
    if (inFlightRequest) return inFlightRequest;

    const request = this.supabase
      .getCountryCapitalByIso2(iso2)
      .then((capital) => {
        this.countryCapitalCache.set(iso2, capital);
        return capital;
      })
      .finally(() => {
        this.countryCapitalInFlight.delete(iso2);
      });

    this.countryCapitalInFlight.set(iso2, request);
    return request;
  }

  private async getBookCountryMarkerSummaryCached(
    bookId: string | null,
    iso2: string,
  ): Promise<BookCountryMarkerSummary> {
    const activeBookId = bookId;
    if (!activeBookId) return this.emptyMarkerSummary();

    const key = this.getMarkerSummaryCacheKey(activeBookId, iso2);
    if (!key) return this.emptyMarkerSummary();

    if (this.markerSummaryCache.has(key))
      return this.markerSummaryCache.get(key) ?? this.emptyMarkerSummary();

    const inFlightRequest = this.markerSummaryInFlight.get(key);
    if (inFlightRequest) return inFlightRequest;

    const request = this.supabase
      .getBookCountryMarkerSummary(activeBookId, iso2)
      .then((summary) => {
        this.markerSummaryCache.set(key, summary);
        return summary;
      })
      .finally(() => {
        this.markerSummaryInFlight.delete(key);
      });

    this.markerSummaryInFlight.set(key, request);
    return request;
  }

  protected formatPopulation(value: number | null | undefined): string {
    if (!value || value <= 0) return 'N/A';
    return value.toLocaleString();
  }

  protected formatArea(value: number | null | undefined): string {
    if (!value || value <= 0) return 'N/A';
    return `${Math.round(value).toLocaleString()} km²`;
  }

  protected formatPercent(value: number): string {
    if (!Number.isFinite(value) || value <= 0) return '0.00%';
    return `${value.toFixed(2)}%`;
  }

  private emptyMarkerSummary(): EmptyMarkerSummary {
    return {
      markerCount: 0,
      visitedCount: 0,
      favoriteCount: 0,
      wantCount: 0,
      markerCities: [],
    };
  }

  private buildGridPaths(): { meridians: string[]; parallels: string[] } {
    const meridians: string[] = [];
    const parallels: string[] = [];

    // Meridians (vertical lines) every 15° of longitude
    for (let lon = -180; lon <= 180; lon += 15) {
      const [x1] = this.projectPoint([lon, -90]);
      const [x2] = this.projectPoint([lon, 90]);
      meridians.push(`M ${x1} 580 L ${x2} 20`);
    }

    // Parallels (horizontal lines) every 15° of latitude
    for (let lat = -90; lat <= 90; lat += 15) {
      const [x1, y1] = this.projectPoint([-180, lat]);
      const [x2, y2] = this.projectPoint([180, lat]);
      parallels.push(`M ${x1} ${y1} L ${x2} ${y2}`);
    }

    return { meridians, parallels };
  }

  private buildPolygonPath(
    rings: Position[][],
    project: (point: Position) => Position,
  ): string {
    const commands: string[] = [];
    for (const ring of rings) {
      if (ring.length < 2) continue;

      const projected = ring.map(project);
      commands.push(`M ${projected[0][0]} ${projected[0][1]}`);
      for (let index = 1; index < projected.length; index += 1)
        commands.push(`L ${projected[index][0]} ${projected[index][1]}`);

      commands.push('Z');
    }

    return commands.join(' ');
  }

  private projectPoint(point: Position): Position {
    const [lon, lat] = point;
    const px = ((lon + 180) / 360) * (this.mapWidth - 40) + 20;
    const py = ((90 - lat) / 180) * (this.mapHeight - 40) + 20;
    return [px, py];
  }

  private buildCapitalDot(
    capital: CountryCapitalCity | null,
  ): CapitalDot | null {
    if (!capital) return null;

    const [x, y] = this.projectPoint([capital.longitude, capital.latitude]);
    return {
      name: capital.name,
      x,
      y,
    };
  }
}
