import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { SupabaseService } from '../data/supabase.service';
import { GeoJsonFeatureCollection } from './models';
import { CountryIsoLookup } from '../data/supabase/models';

/**
 * Loads map data: GeoJSON, home country, visited metadata, and land area stats
 */
@Injectable({ providedIn: 'root' })
export class MapDataService {
  private http = inject(HttpClient);
  private supabase = inject(SupabaseService);

  /**
   * Load GeoJSON features and country ISO lookup simultaneously
   */
  async loadMapData(): Promise<{
    geojson: GeoJsonFeatureCollection;
    countryLookup: CountryIsoLookup | undefined;
  }> {
    try {
      const [geojson, countryLookup] = await Promise.all([
        firstValueFrom(
          this.http.get<GeoJsonFeatureCollection>(
            'assets/data/geo/visvalingam-weighted_1.8pct_keepshapes_clean.geojson',
          ),
        ),
        this.supabase.getCountryIsoLookup(),
      ]);

      return { geojson, countryLookup };
    } catch (error) {
      console.error('Failed to load GeoJSON or country lookup:', error);
      throw error;
    }
  }

  /**
   * Load user's home country ISO2 code
   */
  async loadHomeCountryIso2(): Promise<string | null> {
    try {
      const profile = await this.supabase.getUserProfile();
      if (!profile?.home_city_id) {
        return null;
      }

      return await this.supabase.getCountryIso2ByCityId(profile.home_city_id);
    } catch (err) {
      console.error('Failed to load user home country', err);
      return null;
    }
  }

  /**
   * Load visited countries and land area statistics for a book
   */
  async loadVisitedMetadata(bookId: string | null): Promise<{
    iso2s: string[];
    visitedPercent: number;
    visitedArea: number;
    markerCount: number;
    totalArea: number;
  } | null> {
    if (!bookId) {
      return null;
    }

    try {
      const [iso2s, areaStats, markerCount] = await Promise.all([
        this.supabase.getVisitedCountryIso2s(bookId),
        this.supabase.getBookVisitedLandAreaStats(bookId),
        this.supabase.getBookMarkerCount(bookId),
      ]);

      return {
        iso2s,
        visitedPercent: areaStats.visitedPercent,
        visitedArea: areaStats.visitedArea,
        markerCount,
        totalArea: areaStats.totalArea,
      };
    } catch (err) {
      console.error('Failed to load visited metadata', err);
      return null;
    }
  }

  /**
   * Load total world land area
   */
  async loadTotalLandArea(): Promise<number> {
    try {
      return await this.supabase.getTotalLandArea();
    } catch (err) {
      console.error('Failed to load total land area', err);
      return 0;
    }
  }
}
