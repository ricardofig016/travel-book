import { Injectable } from '@angular/core';
import {
  Position,
  CountryShape,
  CapitalDot,
  GridPaths,
  GeoJsonFeatureCollection,
  GeoJsonProperties,
} from './models';
import { CountryCapitalCity, CountryIsoLookup } from '../data/supabase/models';

/**
 * Processes GeoJSON features into map-renderable shapes
 * and handles SVG path generation and projection math
 */
@Injectable({ providedIn: 'root' })
export class GeoProcessorService {
  private readonly mapWidth = 1200;
  private readonly mapHeight = 600;

  /**
   * Build countries from GeoJSON features with ISO lookup
   */
  buildCountries(
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

  /**
   * Build grid paths (meridians and parallels) for map background
   */
  buildGridPaths(): GridPaths {
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

  /**
   * Build a rendered capital dot from capital city data
   */
  buildCapitalDot(capital: CountryCapitalCity | null): CapitalDot | null {
    if (!capital) return null;

    const [x, y] = this.projectPoint([capital.longitude, capital.latitude]);
    return {
      name: capital.name,
      x,
      y,
    };
  }

  /**
   * Convert coordinates to SVG path string
   */
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

  /**
   * Project longitude/latitude to canvas coordinates
   */
  private projectPoint(point: Position): Position {
    const [lon, lat] = point;
    const px = ((lon + 180) / 360) * (this.mapWidth - 40) + 20;
    const py = ((90 - lat) / 180) * (this.mapHeight - 40) + 20;
    return [px, py];
  }

  /**
   * Resolve ISO2 code from GeoJSON properties with lookup fallback
   */
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

  /**
   * Normalize and validate ISO2 code
   */
  private normalizeIso2(value?: string | null): string | null {
    const normalized = value?.trim().toUpperCase();
    if (!normalized || !/^[A-Z]{2}$/.test(normalized)) return null;
    return normalized;
  }

  /**
   * Normalize and validate ISO3 code
   */
  private normalizeIso3(value?: string | null): string | null {
    const normalized = value?.trim().toUpperCase();
    if (!normalized || !/^[A-Z]{3}$/.test(normalized)) return null;
    return normalized;
  }
}
