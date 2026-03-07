import { HttpClient } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

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
export class WorldMapComponent implements OnInit {
  private router = inject(Router);
  private http = inject(HttpClient);
  private readonly hoverDebugEnabled = true;

  protected readonly mapWidth = 1200;
  protected readonly mapHeight = 600;
  protected readonly minZoom = 1;
  protected readonly maxZoom = 12;
  protected readonly zoomStep = 0.2;
  protected readonly defaultZoom = 2;

  protected readonly countries = signal<CountryShape[]>([]);
  protected readonly gridPaths = signal<{
    meridians: string[];
    parallels: string[];
  }>({ meridians: [], parallels: [] });
  protected readonly hoveredCountryId = signal<string | null>(null);
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
  protected readonly selectedTransform = signal<string>('original');
  protected readonly availableTransforms = signal<string[]>(['original']);
  protected readonly mapTransform = computed(
    () => `translate(${this.panX()}px, ${this.panY()}px) scale(${this.zoom()})`,
  );
  protected readonly viewBox = computed(
    () => `0 0 ${this.mapWidth} ${this.mapHeight}`,
  );

  private activePointerId: number | null = null;
  private lastPointerX = 0;
  private lastPointerY = 0;

  ngOnInit(): void {
    void this.loadMap();
    void this.loadAvailableTransforms();
  }

  navigatePrev(): void {
    this.router.navigate(['/index']);
  }

  navigateNext(): void {
    this.router.navigate(['/album']);
  }

  zoomIn(): void {
    this.setZoom(this.zoom() + this.zoomStep);
  }

  zoomOut(): void {
    this.setZoom(this.zoom() - this.zoomStep);
  }

  resetZoom(): void {
    this.zoom.set(this.defaultZoom);
  }

  resetView(): void {
    this.zoom.set(this.defaultZoom);
    this.panX.set(0);
    this.panY.set(0);
  }

  onTransformChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.selectedTransform.set(select.value);
    void this.loadMap();
  }

  onWheel(event: WheelEvent): void {
    event.preventDefault();
    this.setZoom(
      this.zoom() + (event.deltaY < 0 ? this.zoomStep : -this.zoomStep),
    );
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

    this.panX.set(this.panX() + dx);
    this.panY.set(this.panY() + dy);

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
  }

  private async loadAvailableTransforms(): Promise<void> {
    // Manually list available transformations
    // Add new transformation filenames here as you create them
    const transforms = [
      'original',
      'dp_15pct',
      'dp_5pct',
      'dp_1pct',
      'visvalingam_15pct',
      'visvalingam_5pct',
      'visvalingam_1pct',
      'visvalingam-weighted_15pct',
      'visvalingam-weighted_5pct',
      'visvalingam-weighted_5pct_keepshapes_clean',
      'visvalingam-weighted_2pct_keepshapes_clean',
      'visvalingam-weighted_1.5pct_keepshapes_clean',
      'visvalingam-weighted_1pct_keepshapes_clean',
      'default_1.5pct_keepshapes_clean',
      'dp-planar_1.5pct_keepshapes_clean',
    ];
    this.availableTransforms.set(transforms);
  }

  private async loadMap(): Promise<void> {
    try {
      const transform = this.selectedTransform();
      const path =
        transform === 'original'
          ? 'assets/data/geo/countries.geojson'
          : `assets/data/geo/transformed/${transform}.geojson`;

      const data = await firstValueFrom(
        this.http.get<GeoJsonFeatureCollection>(path),
      );
      this.countries.set(this.buildCountries(data));
      this.gridPaths.set(this.buildGridPaths());
    } catch (error) {
      console.error('Failed to load countries GeoJSON for map preview', error);
      this.countries.set([]);
    }
  }

  private buildGridPaths(): { meridians: string[]; parallels: string[] } {
    const meridians: string[] = [];
    const parallels: string[] = [];

    const project = (point: Position): Position => {
      const [lon, lat] = point;
      const px = ((lon + 180) / 360) * (this.mapWidth - 40) + 20;
      const py = ((90 - lat) / 180) * (this.mapHeight - 40) + 20;
      return [px, py];
    };

    // Meridians (vertical lines) every 15° of longitude
    for (let lon = -180; lon <= 180; lon += 15) {
      const [x1] = project([lon, -90]);
      const [x2] = project([lon, 90]);
      meridians.push(`M ${x1} 580 L ${x2} 20`);
    }

    // Parallels (horizontal lines) every 15° of latitude
    for (let lat = -90; lat <= 90; lat += 15) {
      const [x1, y1] = project([-180, lat]);
      const [x2, y2] = project([180, lat]);
      parallels.push(`M ${x1} ${y1} L ${x2} ${y2}`);
    }

    return { meridians, parallels };
  }

  private buildCountries(collection: GeoJsonFeatureCollection): CountryShape[] {
    const project = (point: Position): Position => {
      const [lon, lat] = point;
      const px = ((lon + 180) / 360) * (this.mapWidth - 40) + 20;
      const py = ((90 - lat) / 180) * (this.mapHeight - 40) + 20;
      return [px, py];
    };

    const countries: CountryShape[] = [];
    let uniqueIndex = 0;

    for (const [index, feature] of collection.features.entries()) {
      if (!feature.geometry) {
        continue;
      }

      const countryPaths: string[] = [];

      if (feature.geometry.type === 'Polygon') {
        const path = this.buildPolygonPath(
          feature.geometry.coordinates,
          project,
        );
        if (path) {
          countryPaths.push(path);
        }
      }

      if (feature.geometry.type === 'MultiPolygon') {
        for (const polygon of feature.geometry.coordinates) {
          const path = this.buildPolygonPath(polygon, project);
          if (path) {
            countryPaths.push(path);
          }
        }
      }

      if (countryPaths.length === 0) {
        continue;
      }

      const baseId =
        feature.properties?.['ISO3166-1-Alpha-3'] ??
        feature.properties?.['ISO3166-1-Alpha-2'] ??
        feature.properties?.name ??
        `country-${index}`;

      countries.push({
        id: `${baseId}-${uniqueIndex++}`,
        name: feature.properties?.name ?? baseId,
        iso2: feature.properties?.['ISO3166-1-Alpha-2'] ?? 'N/A',
        iso3: feature.properties?.['ISO3166-1-Alpha-3'] ?? 'N/A',
        parts: countryPaths.length,
        paths: countryPaths,
      });
    }

    return countries;
  }

  private buildPolygonPath(
    rings: Position[][],
    project: (point: Position) => Position,
  ): string {
    const commands: string[] = [];
    for (const ring of rings) {
      if (ring.length < 2) {
        continue;
      }

      const projected = ring.map(project);
      commands.push(`M ${projected[0][0]} ${projected[0][1]}`);
      for (let index = 1; index < projected.length; index += 1) {
        commands.push(`L ${projected[index][0]} ${projected[index][1]}`);
      }
      commands.push('Z');
    }

    return commands.join(' ');
  }
}
