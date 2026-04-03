export interface AlbumCountryIndexItem {
  countryId: string;
  countryName: string;
  countrySlug: string;
  isoCode2: string;
  flagEmoji: string | null;
  markerCount: number;
  visitedCount: number;
  favoriteCount: number;
  wantCount: number;
  cityCount: number;
}

export interface AlbumCountryMetadata {
  id: string;
  name: string;
  slug: string;
  nativeName: string | null;
  isoCode2: string;
  isoCode3: string;
  population: number | null;
  area: number | null;
  flagEmoji: string | null;
}

export interface AlbumCountryBookInfo {
  markerCount: number;
  visitedCount: number;
  favoriteCount: number;
  wantCount: number;
  cityCount: number;
  photoCount: number;
}

export interface AlbumCountryCityItem {
  markerId: string;
  markerIdTail: string;
  cityId: string;
  cityName: string;
  citySlug: string;
  adminName: string | null;
  visited: boolean;
  favorite: boolean;
  want: boolean;
  photoCount: number;
}

export interface AlbumTriedDishItem {
  dishId: string;
  name: string;
  category: string | null;
  rating: number | null;
  imageUrl: string | null;
}

export interface AlbumCountryDishItem {
  dishId: string;
  name: string;
  category: string | null;
  location: string | null;
  tasteAtlasUrl: string | null;
  rating: number | null;
  imageUrl: string | null;
  isTried: boolean;
}

export interface AlbumCountryPageData {
  country: AlbumCountryMetadata;
  bookInfo: AlbumCountryBookInfo;
  cities: AlbumCountryCityItem[];
  dishes: AlbumCountryDishItem[];
}

export interface AlbumMarkerVisit {
  id: string;
  startDate: string;
  endDate: string;
}

export interface AlbumPhoto {
  id: string;
  url: string;
  publicId: string;
  dateTaken: string | null;
  caption: string | null;
}

export interface AlbumCityMarkerData {
  markerId: string;
  markerIdTail: string;
  country: AlbumCountryMetadata;
  city: {
    id: string;
    name: string;
    slug: string;
    adminName: string | null;
  };
  status: {
    visited: boolean;
    favorite: boolean;
    want: boolean;
  };
  notes: string | null;
  companions: string[];
  activities: string[];
  visits: AlbumMarkerVisit[];
  photos: AlbumPhoto[];
}
