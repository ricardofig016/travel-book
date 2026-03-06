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
  geometry: GeoJsonGeometry | null;
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

  protected readonly mapWidth = 1200;
  protected readonly mapHeight = 600;
  protected readonly minZoom = 0.6;
  protected readonly maxZoom = 6;
  protected readonly zoomStep = 0.2;

  protected readonly paths = signal<string[]>([]);
  protected readonly gridPaths = signal<{
    meridians: string[];
    parallels: string[];
  }>({ meridians: [], parallels: [] });
  protected readonly zoom = signal(1);
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
    this.zoom.set(1);
  }

  resetView(): void {
    this.zoom.set(1);
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
      this.paths.set(this.buildPaths(data));
      this.gridPaths.set(this.buildGridPaths());
    } catch (error) {
      console.error('Failed to load countries GeoJSON for map preview', error);
      this.paths.set([]);
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

  private buildPaths(collection: GeoJsonFeatureCollection): string[] {
    const project = (point: Position): Position => {
      const [lon, lat] = point;
      const px = ((lon + 180) / 360) * (this.mapWidth - 40) + 20;
      const py = ((90 - lat) / 180) * (this.mapHeight - 40) + 20;
      return [px, py];
    };

    const paths: string[] = [];
    for (const feature of collection.features) {
      if (!feature.geometry) {
        continue;
      }

      if (feature.geometry.type === 'Polygon') {
        const path = this.buildPolygonPath(
          feature.geometry.coordinates,
          project,
        );
        if (path) {
          paths.push(path);
        }
      }

      if (feature.geometry.type === 'MultiPolygon') {
        for (const polygon of feature.geometry.coordinates) {
          const path = this.buildPolygonPath(polygon, project);
          if (path) {
            paths.push(path);
          }
        }
      }
    }

    return paths;
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
