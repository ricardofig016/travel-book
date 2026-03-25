import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../data/supabase.service';
import {
  BookCountryMarkerSummary,
  CountryCapitalCity,
  CountryMetadata,
} from '../data/supabase/models';

/**
 * Caches country metadata, capitals, and marker summaries with in-flight deduplication
 */
@Injectable({ providedIn: 'root' })
export class MetadataCacheService {
  private supabase = inject(SupabaseService);

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

  /**
   * Get country metadata with caching and deduplication
   */
  async getCountryMetadata(iso2: string): Promise<CountryMetadata | null> {
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

  /**
   * Get country capital with caching and deduplication
   */
  async getCountryCapital(iso2: string): Promise<CountryCapitalCity | null> {
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

  /**
   * Get book country marker summary with caching and deduplication
   */
  async getBookCountryMarkerSummary(
    bookId: string | null,
    iso2: string,
  ): Promise<BookCountryMarkerSummary> {
    if (!bookId) return this.emptyMarkerSummary();

    const key = this.getMarkerSummaryCacheKey(bookId, iso2);
    if (!key) return this.emptyMarkerSummary();

    if (this.markerSummaryCache.has(key))
      return this.markerSummaryCache.get(key) ?? this.emptyMarkerSummary();

    const inFlightRequest = this.markerSummaryInFlight.get(key);
    if (inFlightRequest) return inFlightRequest;

    const request = this.supabase
      .getBookCountryMarkerSummary(bookId, iso2)
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

  /**
   * Get cached metadata without making a request
   */
  getMetadataFromCache(iso2: string): CountryMetadata | null | undefined {
    return this.countryMetadataCache.get(iso2);
  }

  /**
   * Get cached capital without making a request
   */
  getCapitalFromCache(iso2: string): CountryCapitalCity | null | undefined {
    return this.countryCapitalCache.get(iso2);
  }

  /**
   * Get cached marker summary without making a request
   */
  getMarkerSummaryFromCache(
    bookId: string | null,
    iso2: string,
  ): BookCountryMarkerSummary | undefined {
    const key = this.getMarkerSummaryCacheKey(bookId, iso2);
    if (!key) return undefined;
    return this.markerSummaryCache.get(key);
  }

  /**
   * Generate cache key for marker summary
   */
  private getMarkerSummaryCacheKey(
    bookId: string | null,
    iso2: string,
  ): string | null {
    return bookId ? `${bookId}:${iso2}` : null;
  }

  /**
   * Get empty marker summary as default
   */
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
