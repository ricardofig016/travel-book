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

export interface HomeCityDisplay {
  cityName: string;
  countryName: string;
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
  name_ascii: string;
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

export interface MarkerVisitPeriod {
  id: string;
  startDate: string;
  endDate: string;
}

export interface MarkerMutationInput {
  visited: boolean;
  favorite: boolean;
  want: boolean;
  notes: string | null;
  companions: string[];
  activities: string[];
  visits: Array<{
    startDate: string;
    endDate: string;
  }>;
}

export interface MarkerFullDetail {
  id: string;
  bookId: string;
  cityId: string;
  cityName: string;
  visited: boolean;
  favorite: boolean;
  want: boolean;
  notes: string | null;
  companions: string[];
  activities: string[];
  visits: MarkerVisitPeriod[];
  photoCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AlbumMarkerCountryRow {
  id?: string | null;
  visited?: boolean | null;
  favorite?: boolean | null;
  want?: boolean | null;
  notes?: string | null;
  companions?: string[] | null;
  activities?: string[] | null;
  photos?: Array<{
    id?: string | null;
    url?: string | null;
    public_id?: string | null;
    date_taken?: string | null;
    caption?: string | null;
  }> | null;
  marker_visits?: Array<{
    id?: string | null;
    start_date?: string | null;
    end_date?: string | null;
  }> | null;
  cities?: {
    id?: string | null;
    name?: string | null;
    admin_name?: string | null;
    countries?: {
      id?: string | null;
      name?: string | null;
      native_name?: string | null;
      iso_code_2?: string | null;
      iso_code_3?: string | null;
      population?: number | string | null;
      area?: number | string | null;
      flag_emoji?: string | null;
    } | null;
  } | null;
}

export interface AlbumBookTriedDishRow {
  dish_id?: string | null;
  dishes?: {
    id?: string | null;
    name?: string | null;
    category?: string | null;
    rating?: number | string | null;
    image_url?: string | null;
  } | null;
}

export interface AlbumCountryDishRow {
  id?: string | null;
  name?: string | null;
  category?: string | null;
  location?: string | null;
  tasteatlas_url?: string | null;
  rating?: number | string | null;
  image_url?: string | null;
  country_id?: string | null;
}

export interface AlbumPhotoMutationInput {
  markerId: string;
  url: string;
  publicId: string;
  dateTaken: string | null;
  caption: string | null;
}

export interface AlbumPhotoUpdateInput {
  markerId: string;
  photoId: string;
  url?: string | null;
  publicId?: string | null;
  dateTaken: string | null;
  caption: string | null;
}

export interface AlbumPhotoRow {
  id: string;
  url: string;
  public_id: string;
  date_taken: string | null;
  caption: string | null;
}
