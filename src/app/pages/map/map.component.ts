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
  Signal,
  ViewChild,
} from '@angular/core';
import { BookStateService } from '../../services/data/book-state.service';
import {
  BookCountryMarkerSummary,
  CountryMetadata,
} from '../../services/data/supabase/models';
import { CountryShape, CapitalDot, GridPaths } from '../../services/map/models';
import { GeoProcessorService } from '../../services/map/geo-processor.service';
import { MapViewportService } from '../../services/map/map-viewport.service';
import { MapDataService } from '../../services/map/map-data.service';
import { MetadataCacheService } from '../../services/map/metadata-cache.service';
import { FlagIconComponent } from '../../shared/flag-icon/flag-icon.component';

@Component({
  selector: 'app-world-map',
  standalone: true,
  imports: [FlagIconComponent],
  templateUrl: './map.component.html',
  styleUrl: './map.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorldMapComponent implements OnInit, AfterViewInit, OnDestroy {
  private static readonly HOVERED_COUNTRY_FILL = '#f2af55';
  private static readonly HOME_COUNTRY_FILL = '#7fcf6e';
  private static readonly VISITED_COUNTRY_FILL = '#8fa8ff';
  private static readonly DEFAULT_COUNTRY_FILL = 'transparent';

  @ViewChild('mapCanvas') mapCanvas!: ElementRef<HTMLDivElement>;

  private bookState = inject(BookStateService);
  private geoProcessor = inject(GeoProcessorService);
  private viewport = inject(MapViewportService);
  private mapData = inject(MapDataService);
  private metadataCache = inject(MetadataCacheService);
  private readonly hoverDebugEnabled = true;
  private boundWheelHandler: ((event: WheelEvent) => void) | null = null;

  private hoveredMetadataRequestId = 0;
  private homeMetadataRequestId = 0;

  protected readonly countries = signal<CountryShape[]>([]);
  protected readonly gridPaths = signal<GridPaths>({
    meridians: [],
    parallels: [],
  });
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

  protected get zoom(): Signal<number> {
    return this.viewport.zoom;
  }

  protected get panX(): Signal<number> {
    return this.viewport.panX;
  }

  protected get panY(): Signal<number> {
    return this.viewport.panY;
  }

  protected get isDragging(): Signal<boolean> {
    return this.viewport.isDragging;
  }

  protected readonly mapWidth = this.viewport.mapWidth;
  protected readonly mapHeight = this.viewport.mapHeight;

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
    if (!iso2) return null;
    return this.countries().find((country) => country.iso2 === iso2) ?? null;
  });

  protected readonly hoveredCountry = computed(() => {
    const hoveredId = this.hoveredCountryId();
    if (!hoveredId) return null;
    return this.countries().find((country) => country.id === hoveredId) ?? null;
  });

  protected readonly mapTransform = computed(() => {
    const zoom = this.zoom();
    const panX = this.panX();
    const panY = this.panY();
    return `translate(${panX}px, ${panY}px) scale(${zoom})`;
  });

  protected readonly viewBox = computed(
    () => `0 0 ${this.mapWidth} ${this.mapHeight}`,
  );

  constructor() {
    // Load data when selected book changes
    effect(() => {
      const bookId = this.bookState.selectedBook()?.id ?? null;
      void this.loadBookVisitedMetadata(bookId);
    });

    // Load home country metadata when it changes
    effect(() => {
      const iso2 = this.homeCountryIso2();
      void this.loadHomeCountryMetadata(iso2);
    });

    // Load hovered country metadata when it or the book changes
    effect(() => {
      const hoveredIso2 = this.hoveredCountry()?.iso2 ?? null;
      const bookId = this.bookState.selectedBook()?.id ?? null;
      void this.loadHoveredCountryMetadata(hoveredIso2, bookId);
    });
  }

  ngOnInit(): void {
    void this.loadInitialData();
  }

  private async loadInitialData(): Promise<void> {
    try {
      const [{ geojson, countryLookup }, totalArea, homeIso2] =
        await Promise.all([
          this.mapData.loadMapData(),
          this.mapData.loadTotalLandArea(),
          this.mapData.loadHomeCountryIso2(),
        ]);

      this.countries.set(
        this.geoProcessor.buildCountries(geojson, countryLookup),
      );
      this.gridPaths.set(this.geoProcessor.buildGridPaths());
      this.totalLandAreaSqKm.set(totalArea);
      this.homeCountryIso2.set(homeIso2);
    } catch (error) {
      console.error('Failed to load initial map data', error);
    }
  }

  ngAfterViewInit(): void {
    // Initialize viewport with canvas element
    this.viewport.setMapCanvas(this.mapCanvas);

    // Create and bind the wheel handler
    this.boundWheelHandler = this.viewport.createWheelHandler();

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
    this.viewport.zoomIn();
  }

  zoomOut(): void {
    this.viewport.zoomOut();
  }

  resetView(): void {
    this.viewport.resetView();
  }

  onPointerDown(event: PointerEvent): void {
    this.viewport.onPointerDown(event);
  }

  onPointerMove(event: PointerEvent): void {
    this.viewport.onPointerMove(event);
  }

  onPointerUp(event: PointerEvent): void {
    this.viewport.onPointerUp(event);
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

  private setHoveredCountry(countryId: string | null, source: string): void {
    const previous = this.hoveredCountryId();
    if (previous === countryId) return;

    this.hoveredCountryId.set(countryId);

    if (!this.hoverDebugEnabled) return;

    const previousName = this.getCountryName(previous);
    const nextName = this.getCountryName(countryId);
    console.debug(
      `[WorldMap hover] ${source}: ${previousName} (${previous ?? 'none'}) -> ${nextName} (${countryId ?? 'none'})`,
    );
  }

  private getCountryName(countryId: string | null): string {
    if (!countryId) return 'none';
    const match = this.countries().find((country) => country.id === countryId);
    return match?.name ?? 'unknown';
  }

  private normalizeIso2(value?: string | null): string | null {
    const normalized = value?.trim().toUpperCase();
    if (!normalized || !/^[A-Z]{2}$/.test(normalized)) return null;
    return normalized;
  }

  private async loadBookVisitedMetadata(bookId: string | null): Promise<void> {
    if (!bookId) {
      this.visitedCountryIso2s.set(new Set());
      this.visitedLandAreaPercent.set(0);
      this.visitedLandAreaSqKm.set(0);
      this.bookMarkerCount.set(0);
      return;
    }

    try {
      const result = await this.mapData.loadVisitedMetadata(bookId);
      if (!result) {
        this.visitedCountryIso2s.set(new Set());
        this.visitedLandAreaPercent.set(0);
        this.visitedLandAreaSqKm.set(0);
        this.bookMarkerCount.set(0);
        return;
      }

      this.visitedCountryIso2s.set(new Set(result.iso2s));
      this.visitedLandAreaPercent.set(result.visitedPercent);
      this.visitedLandAreaSqKm.set(result.visitedArea);
      this.bookMarkerCount.set(result.markerCount);
      if (result.totalArea > 0) this.totalLandAreaSqKm.set(result.totalArea);
    } catch (err) {
      console.error('Failed to load visited metadata', err);
      this.visitedCountryIso2s.set(new Set());
      this.visitedLandAreaPercent.set(0);
      this.visitedLandAreaSqKm.set(0);
      this.bookMarkerCount.set(0);
    }
  }

  private async loadHomeCountryMetadata(iso2: string | null): Promise<void> {
    const requestId = ++this.homeMetadataRequestId;
    const normalizedIso2 = this.normalizeIso2(iso2);
    if (!normalizedIso2) {
      this.homeCountryMetadata.set(null);
      return;
    }

    try {
      const metadata =
        await this.metadataCache.getCountryMetadata(normalizedIso2);
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
    const normalizedIso2 = this.normalizeIso2(iso2);

    if (!normalizedIso2) {
      this.hoveredCountryMetadata.set(null);
      this.hoveredCountryMarkerSummary.set(this.emptyMarkerSummary());
      this.hoveredCapitalDot.set(null);
      return;
    }

    // Set cached values immediately
    const cachedMetadata =
      this.metadataCache.getMetadataFromCache(normalizedIso2);
    const cachedCapital =
      this.metadataCache.getCapitalFromCache(normalizedIso2);
    const cachedMarkerSummary = this.metadataCache.getMarkerSummaryFromCache(
      bookId,
      normalizedIso2,
    );

    if (cachedMetadata !== undefined)
      this.hoveredCountryMetadata.set(cachedMetadata);
    if (cachedCapital !== undefined)
      this.hoveredCapitalDot.set(
        this.geoProcessor.buildCapitalDot(cachedCapital),
      );
    if (cachedMarkerSummary !== undefined)
      this.hoveredCountryMarkerSummary.set(cachedMarkerSummary);

    try {
      const [metadata, markerSummary, capitalCity] = await Promise.all([
        this.metadataCache.getCountryMetadata(normalizedIso2),
        this.metadataCache.getBookCountryMarkerSummary(bookId, normalizedIso2),
        this.metadataCache.getCountryCapital(normalizedIso2),
      ]);

      if (requestId !== this.hoveredMetadataRequestId) return;

      this.hoveredCountryMetadata.set(metadata);
      this.hoveredCountryMarkerSummary.set(markerSummary);
      this.hoveredCapitalDot.set(
        this.geoProcessor.buildCapitalDot(capitalCity),
      );
    } catch (err) {
      console.error('Failed to load hovered country metadata', err);
      if (requestId !== this.hoveredMetadataRequestId) return;

      this.hoveredCountryMetadata.set(null);
      this.hoveredCountryMarkerSummary.set(this.emptyMarkerSummary());
      this.hoveredCapitalDot.set(null);
    }
  }

  private emptyMarkerSummary(): BookCountryMarkerSummary {
    return {
      markerCount: 0,
      visitedCount: 0,
      favoriteCount: 0,
      wantCount: 0,
      markerCities: [],
    };
  }
}
