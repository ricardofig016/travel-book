import { Injectable } from '@angular/core';
import { SupabaseClient } from '@supabase/supabase-js';

import { BookCountryMarkerSummary, BookVisitedLandAreaStats } from './models';

@Injectable({ providedIn: 'root' })
export class SupabaseStatsService {
  async getBookVisitedLandAreaStats(
    client: SupabaseClient,
    bookId: string,
  ): Promise<BookVisitedLandAreaStats> {
    try {
      const { data: markerRows, error: markersError } = await client
        .from('markers')
        .select('cities(country_id)')
        .eq('book_id', bookId)
        .eq('visited', true);

      if (markersError) {
        console.error(
          'Error fetching visited marker country ids:',
          markersError,
        );
        return { visitedArea: 0, totalArea: 0, visitedPercent: 0 };
      }

      const visitedCountryIds = new Set<string>();
      for (const marker of markerRows ?? []) {
        const countryId = (
          marker as { cities?: { country_id?: string | null } | null }
        )?.cities?.country_id;

        if (countryId) visitedCountryIds.add(countryId);
      }

      let visitedArea = 0;
      if (visitedCountryIds.size > 0) {
        const { data: visitedCountries, error: visitedCountriesError } =
          await client
            .from('countries')
            .select('area')
            .in('id', Array.from(visitedCountryIds));

        if (visitedCountriesError) {
          console.error(
            'Error fetching visited country areas:',
            visitedCountriesError,
          );
          return { visitedArea: 0, totalArea: 0, visitedPercent: 0 };
        }

        visitedArea = (visitedCountries ?? []).reduce((sum, row) => {
          const area = Number((row as { area?: number | string | null }).area);
          if (!Number.isFinite(area) || area <= 0) return sum;

          return sum + area;
        }, 0);
      }

      const { data: allCountries, error: allCountriesError } = await client
        .from('countries')
        .select('area');

      if (allCountriesError) {
        console.error('Error fetching total country area:', allCountriesError);
        return { visitedArea: 0, totalArea: 0, visitedPercent: 0 };
      }

      const totalArea = (allCountries ?? []).reduce((sum, row) => {
        const area = Number((row as { area?: number | string | null }).area);
        if (!Number.isFinite(area) || area <= 0) return sum;

        return sum + area;
      }, 0);

      if (totalArea <= 0)
        return { visitedArea, totalArea: 0, visitedPercent: 0 };

      const visitedPercent = (visitedArea / totalArea) * 100;
      return {
        visitedArea,
        totalArea,
        visitedPercent,
      };
    } catch (err) {
      console.error('Exception calculating visited land area stats:', err);
      return { visitedArea: 0, totalArea: 0, visitedPercent: 0 };
    }
  }

  async getTotalLandArea(client: SupabaseClient): Promise<number> {
    try {
      const { data, error } = await client.from('countries').select('area');

      if (error) {
        console.error('Error fetching total land area:', error);
        return 0;
      }

      return (data ?? []).reduce((sum, row) => {
        const area = Number((row as { area?: number | string | null }).area);
        if (!Number.isFinite(area) || area <= 0) return sum;

        return sum + area;
      }, 0);
    } catch (err) {
      console.error('Exception fetching total land area:', err);
      return 0;
    }
  }

  async getBookMarkerCount(
    client: SupabaseClient,
    bookId: string,
  ): Promise<number> {
    try {
      const { count, error } = await client
        .from('markers')
        .select('id', { count: 'exact', head: true })
        .eq('book_id', bookId);

      if (error) {
        console.error('Error fetching marker count for book:', error);
        return 0;
      }

      return count ?? 0;
    } catch (err) {
      console.error('Exception fetching marker count for book:', err);
      return 0;
    }
  }

  async getBookCountryMarkerSummary(
    client: SupabaseClient,
    bookId: string,
    iso2: string,
  ): Promise<BookCountryMarkerSummary> {
    const normalizedIso2 = iso2.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(normalizedIso2)) return this.emptyMarkerSummary();

    try {
      const { data, error } = await client
        .from('markers')
        .select('visited, favorite, want, cities(name, countries(iso_code_2))')
        .eq('book_id', bookId);

      if (error) {
        console.error('Error fetching markers for country summary:', error);
        return this.emptyMarkerSummary();
      }

      const filtered = (data ?? []).filter((marker) => {
        const markerIso2 = (
          marker as {
            cities?: {
              countries?: { iso_code_2?: string | null } | null;
            } | null;
          }
        )?.cities?.countries?.iso_code_2;

        return markerIso2?.toUpperCase() === normalizedIso2;
      });

      const markerCities = Array.from(
        new Set(
          filtered
            .map(
              (marker) =>
                (marker as { cities?: { name?: string | null } | null })?.cities
                  ?.name ?? null,
            )
            .filter((name): name is string => Boolean(name)),
        ),
      );

      return {
        markerCount: filtered.length,
        visitedCount: filtered.filter((marker) => marker.visited).length,
        favoriteCount: filtered.filter((marker) => marker.favorite).length,
        wantCount: filtered.filter((marker) => marker.want).length,
        markerCities,
      };
    } catch (err) {
      console.error('Exception fetching marker summary for country:', err);
      return this.emptyMarkerSummary();
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
