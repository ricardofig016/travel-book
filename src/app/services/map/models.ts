/**
 * Map-specific domain models and types
 */

export type Position = [number, number];

export interface GeoJsonFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJsonFeature[];
}

export interface GeoJsonFeature {
  type: 'Feature';
  properties?: GeoJsonProperties;
  geometry: GeoJsonGeometry | null;
}

export interface GeoJsonProperties {
  name?: string;
  'ISO3166-1-Alpha-3'?: string;
  'ISO3166-1-Alpha-2'?: string;
}

export type GeoJsonGeometry =
  | { type: 'Polygon'; coordinates: Position[][] }
  | { type: 'MultiPolygon'; coordinates: Position[][][] };

export interface CountryShape {
  id: string;
  name: string;
  iso2: string;
  iso3: string;
  parts: number;
  paths: string[];
}

export interface CapitalDot {
  name: string;
  x: number;
  y: number;
}

export interface GridPaths {
  meridians: string[];
  parallels: string[];
}
