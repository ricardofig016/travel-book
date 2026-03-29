export interface SupabaseConnectionStatus {
  ok: boolean;
  error: string | null;
  countriesCount: number;
}

export interface Book {
  id: string;
  name: string;
  is_public: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  user_id: string;
  home_city_id: string | null;
  hide_demo_book: boolean;
  created_at: string;
  updated_at: string;
}

export interface CitySearchResult {
  id: string;
  name: string;
  country: string;
}

export interface UserLookupResult {
  user_id: string;
  email: string;
  name: string | null;
}

export interface CountryIsoLookup {
  byIso3: Record<string, string>;
  byIso2: Record<string, string>;
  byName: Record<string, string>;
}

export interface BookVisitedLandAreaStats {
  visitedArea: number;
  totalArea: number;
  visitedPercent: number;
}

export interface CountryMetadata {
  id: string;
  name: string;
  native_name: string | null;
  iso_code_2: string;
  iso_code_3: string;
  area: number | null;
  population: number | null;
  flag_emoji: string | null;
}

export interface BookCountryMarkerSummary {
  markerCount: number;
  visitedCount: number;
  favoriteCount: number;
  wantCount: number;
  markerCities: string[];
}

export interface CountryCapitalCity {
  name: string;
  latitude: number;
  longitude: number;
}

export interface CountryCity {
  id: string;
  name: string;
  population: number | null;
  latitude: number;
  longitude: number;
}

export interface CountryMarkerDetail {
  id: string;
  cityId: string;
  cityName: string;
  latitude: number;
  longitude: number;
  visited: boolean;
  favorite: boolean;
  want: boolean;
}

export interface CountryMarkerStatusPatch {
  visited?: boolean;
  favorite?: boolean;
  want?: boolean;
}
