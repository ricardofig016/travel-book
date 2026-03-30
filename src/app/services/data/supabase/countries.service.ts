import { Injectable } from '@angular/core';
import { SupabaseClient } from '@supabase/supabase-js';

import {
  CountryCapitalCity,
  CountryCity,
  CountryIsoLookup,
  CountryMarkerDetail,
  MarkerFullDetail,
  MarkerMutationInput,
  MarkerVisitPeriod,
  CountryMarkerStatusPatch,
  CountryMetadata,
} from './models';

@Injectable({ providedIn: 'root' })
export class SupabaseCountriesService {
  private toMarkerMutationPayload(input: MarkerMutationInput): {
    visited: boolean;
    favorite: boolean;
    want: boolean;
    notes: string | null;
    companions: string[];
    activities: string[];
  } {
    return {
      visited: input.visited,
      favorite: input.favorite,
      want: input.want,
      notes: input.notes,
      companions: input.companions,
      activities: input.activities,
    };
  }

  private normalizeMarkerVisits(
    visits: MarkerMutationInput['visits'],
  ): Array<{ start_date: string; end_date: string }> {
    return visits
      .map((visit) => ({
        start_date: visit.startDate,
        end_date: visit.endDate,
      }))
      .filter((visit) => Boolean(visit.start_date && visit.end_date));
  }

  private async replaceMarkerVisits(
    client: SupabaseClient,
    markerId: string,
    visits: MarkerMutationInput['visits'],
  ): Promise<boolean> {
    const { error: deleteError } = await client
      .from('marker_visits')
      .delete()
      .eq('marker_id', markerId);

    if (deleteError) {
      console.error('Error deleting marker visits:', deleteError);
      return false;
    }

    const normalizedVisits = this.normalizeMarkerVisits(visits);
    if (normalizedVisits.length === 0) return true;

    const { error: insertError } = await client.from('marker_visits').insert(
      normalizedVisits.map((visit) => ({
        marker_id: markerId,
        start_date: visit.start_date,
        end_date: visit.end_date,
      })),
    );

    if (insertError) {
      console.error('Error inserting marker visits:', insertError);
      return false;
    }

    return true;
  }

  private async mapMarkerFullDetailRow(
    client: SupabaseClient,
    markerId: string,
    bookId: string,
  ): Promise<MarkerFullDetail | null> {
    const { data, error } = await client
      .from('markers')
      .select(
        'id, book_id, city_id, visited, favorite, want, notes, companions, activities, created_at, updated_at, cities!inner(name), marker_visits(id, start_date, end_date)',
      )
      .eq('id', markerId)
      .eq('book_id', bookId)
      .single();

    if (error) {
      console.error('Error fetching marker detail:', error);
      return null;
    }

    const row = data as {
      id?: string;
      book_id?: string;
      city_id?: string;
      visited?: boolean;
      favorite?: boolean;
      want?: boolean;
      notes?: string | null;
      companions?: string[] | null;
      activities?: string[] | null;
      created_at?: string;
      updated_at?: string;
      cities?: { name?: string } | null;
      marker_visits?: Array<{
        id?: string;
        start_date?: string;
        end_date?: string;
      }> | null;
    } | null;

    if (
      !row?.id ||
      !row.book_id ||
      !row.city_id ||
      !row.created_at ||
      !row.updated_at ||
      !row.cities?.name
    )
      return null;

    const visits: MarkerVisitPeriod[] = (row.marker_visits ?? [])
      .map((visit) => {
        if (!visit.id || !visit.start_date || !visit.end_date) return null;
        return {
          id: visit.id,
          startDate: visit.start_date,
          endDate: visit.end_date,
        };
      })
      .filter((visit): visit is MarkerVisitPeriod => visit !== null)
      .sort((a, b) => a.startDate.localeCompare(b.startDate));

    return {
      id: row.id,
      bookId: row.book_id,
      cityId: row.city_id,
      cityName: row.cities.name,
      visited: row.visited ?? false,
      favorite: row.favorite ?? false,
      want: row.want ?? false,
      notes: row.notes ?? null,
      companions: row.companions ?? [],
      activities: row.activities ?? [],
      visits,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async getVisitedCountryIso2s(
    client: SupabaseClient,
    bookId: string,
  ): Promise<string[]> {
    try {
      const pageSize = 1000;
      let offset = 0;
      const allRows: Array<{
        cities?: { countries?: { iso_code_2?: string } | null } | null;
      }> = [];

      while (true) {
        const { data, error } = await client
          .from('markers')
          .select('cities(countries(iso_code_2))')
          .eq('book_id', bookId)
          .eq('visited', true)
          .range(offset, offset + pageSize - 1);

        if (error) {
          console.error('Error fetching visited countries:', error);
          return [];
        }

        const pageRows =
          (data as Array<{
            cities?: { countries?: { iso_code_2?: string } | null } | null;
          }> | null) ?? [];

        allRows.push(...pageRows);

        if (pageRows.length < pageSize) break;
        offset += pageSize;
      }

      const iso2s = new Set<string>();
      for (const marker of allRows) {
        const iso2 = marker?.cities?.countries?.iso_code_2;

        if (iso2) iso2s.add(iso2.toUpperCase());
      }

      return Array.from(iso2s);
    } catch (err) {
      console.error('Exception fetching visited countries:', err);
      return [];
    }
  }

  async getCountryIsoLookup(client: SupabaseClient): Promise<CountryIsoLookup> {
    try {
      const { data, error } = await client
        .from('countries')
        .select('name, iso_code_2, iso_code_3');

      if (error) {
        console.error('Error fetching country lookup:', error);
        return {
          byIso3: {},
          byIso2: {},
          byName: {},
        };
      }

      const byIso3: Record<string, string> = {};
      const byIso2: Record<string, string> = {};
      const byName: Record<string, string> = {};

      for (const row of (data ?? []) as Array<{
        name: string | null;
        iso_code_2: string | null;
        iso_code_3: string | null;
      }>) {
        const iso2 = row.iso_code_2?.trim().toUpperCase();
        if (!iso2 || !/^[A-Z]{2}$/.test(iso2)) continue;

        byIso2[iso2] = iso2;

        const iso3 = row.iso_code_3?.trim().toUpperCase();
        if (iso3 && /^[A-Z]{3}$/.test(iso3)) byIso3[iso3] = iso2;

        const name = row.name?.trim().toLowerCase();
        if (name) byName[name] = iso2;
      }

      return {
        byIso3,
        byIso2,
        byName,
      };
    } catch (err) {
      console.error('Exception fetching country lookup:', err);
      return {
        byIso3: {},
        byIso2: {},
        byName: {},
      };
    }
  }

  async getCountryMetadataByIso2(
    client: SupabaseClient,
    iso2: string,
  ): Promise<CountryMetadata | null> {
    const normalizedIso2 = iso2.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(normalizedIso2)) return null;

    try {
      const { data, error } = await client
        .from('countries')
        .select(
          'id, name, native_name, iso_code_2, iso_code_3, area, population, flag_emoji',
        )
        .eq('iso_code_2', normalizedIso2)
        .single();

      if (error) {
        console.error('Error fetching country metadata by ISO2:', error);
        return null;
      }

      return (data as CountryMetadata | null) ?? null;
    } catch (err) {
      console.error('Exception fetching country metadata by ISO2:', err);
      return null;
    }
  }

  async getCountryCapitalByIso2(
    client: SupabaseClient,
    iso2: string,
  ): Promise<CountryCapitalCity | null> {
    const normalizedIso2 = iso2.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(normalizedIso2)) return null;

    try {
      const { data, error } = await client
        .from('cities')
        .select('name, latitude, longitude, countries!inner(iso_code_2)')
        .eq('is_capital', true)
        .eq('countries.iso_code_2', normalizedIso2)
        .limit(1)
        .single();

      if (error) {
        console.error('Error fetching country capital by ISO2:', error);
        return null;
      }

      const row = data as {
        name?: string | null;
        latitude?: number | string | null;
        longitude?: number | string | null;
      } | null;

      const latitude = Number(row?.latitude);
      const longitude = Number(row?.longitude);
      if (
        !row?.name ||
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude)
      )
        return null;

      return {
        name: row.name,
        latitude,
        longitude,
      };
    } catch (err) {
      console.error('Exception fetching country capital by ISO2:', err);
      return null;
    }
  }

  async getCountryCitiesByIso2(
    client: SupabaseClient,
    iso2: string,
  ): Promise<CountryCity[]> {
    const normalizedIso2 = iso2.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(normalizedIso2)) return [];

    try {
      const pageSize = 1000;
      let offset = 0;
      const allRows: unknown[] = [];

      while (true) {
        const { data, error } = await client
          .from('cities')
          .select(
            'id, name, name_ascii, population, latitude, longitude, countries!inner(iso_code_2)',
          )
          .eq('countries.iso_code_2', normalizedIso2)
          .order('population', { ascending: false, nullsFirst: false })
          .range(offset, offset + pageSize - 1);

        if (error) {
          console.error('Error fetching country cities by ISO2:', error);
          return [];
        }

        const pageRows = data ?? [];
        allRows.push(...pageRows);

        if (pageRows.length < pageSize) break;
        offset += pageSize;
      }

      return (
        allRows.map((row: unknown) => {
          const typed = row as {
            id?: string;
            name?: string;
            name_ascii?: string;
            population?: number | string | null;
            latitude?: number | string | null;
            longitude?: number | string | null;
          };
          const latitude = Number(typed.latitude);
          const longitude = Number(typed.longitude);
          const population =
            typed.population === null ? null : Number(typed.population);

          if (
            !typed.id ||
            !typed.name ||
            !typed.name_ascii ||
            !Number.isFinite(latitude) ||
            !Number.isFinite(longitude)
          )
            return null;

          return {
            id: typed.id,
            name: typed.name,
            name_ascii: typed.name_ascii,
            population:
              population !== null &&
              Number.isFinite(population) &&
              population > 0
                ? population
                : null,
            latitude,
            longitude,
          };
        }) as (CountryCity | null)[]
      ).filter((city): city is CountryCity => city !== null);
    } catch (err) {
      console.error('Exception fetching country cities by ISO2:', err);
      return [];
    }
  }

  async getCountryMarkersForBook(
    client: SupabaseClient,
    bookId: string,
    iso2: string,
  ): Promise<CountryMarkerDetail[]> {
    const normalizedIso2 = iso2.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(normalizedIso2)) return [];

    try {
      const pageSize = 1000;
      let offset = 0;
      const allRows: unknown[] = [];

      while (true) {
        const { data, error } = await client
          .from('markers')
          .select(
            'id, visited, favorite, want, cities!inner(id, name, latitude, longitude, countries!inner(iso_code_2))',
          )
          .eq('book_id', bookId)
          .eq('cities.countries.iso_code_2', normalizedIso2)
          .range(offset, offset + pageSize - 1);

        if (error) {
          console.error('Error fetching country markers for book:', error);
          return [];
        }

        const pageRows = data ?? [];
        allRows.push(...pageRows);

        if (pageRows.length < pageSize) break;
        offset += pageSize;
      }

      return (
        allRows.map((row: unknown) => {
          const typed = row as {
            id?: string;
            visited?: boolean;
            favorite?: boolean;
            want?: boolean;
            cities?: {
              id?: string;
              name?: string;
              latitude?: number | string | null;
              longitude?: number | string | null;
            } | null;
          };
          const city = typed.cities;
          const latitude = Number(city?.latitude);
          const longitude = Number(city?.longitude);

          if (
            !typed.id ||
            !city?.id ||
            !city?.name ||
            !Number.isFinite(latitude) ||
            !Number.isFinite(longitude)
          )
            return null;

          return {
            id: typed.id,
            cityId: city.id,
            cityName: city.name,
            latitude,
            longitude,
            visited: typed.visited ?? false,
            favorite: typed.favorite ?? false,
            want: typed.want ?? false,
          };
        }) as (CountryMarkerDetail | null)[]
      )
        .filter((marker): marker is CountryMarkerDetail => marker !== null)
        .sort((a, b) => a.cityName.localeCompare(b.cityName));
    } catch (err) {
      console.error('Exception fetching country markers for book:', err);
      return [];
    }
  }

  async updateMarkerStatuses(
    client: SupabaseClient,
    markerId: string,
    patch: CountryMarkerStatusPatch,
  ): Promise<boolean> {
    if (!markerId) return false;

    const updates: CountryMarkerStatusPatch = {};
    if (typeof patch.visited === 'boolean') updates.visited = patch.visited;
    if (typeof patch.favorite === 'boolean') updates.favorite = patch.favorite;
    if (typeof patch.want === 'boolean') updates.want = patch.want;

    if (Object.keys(updates).length === 0) return true;

    try {
      const { error } = await client
        .from('markers')
        .update(updates)
        .eq('id', markerId);

      if (error) {
        console.error('Error updating marker statuses:', error);
        return false;
      }

      return true;
    } catch (err) {
      console.error('Exception updating marker statuses:', err);
      return false;
    }
  }

  async getMarkerDetailForBook(
    client: SupabaseClient,
    markerId: string,
    bookId: string,
  ): Promise<MarkerFullDetail | null> {
    if (!markerId || !bookId) return null;

    try {
      return await this.mapMarkerFullDetailRow(client, markerId, bookId);
    } catch (err) {
      console.error('Exception fetching marker detail:', err);
      return null;
    }
  }

  async createMarkerForBookCity(
    client: SupabaseClient,
    bookId: string,
    cityId: string,
    input: MarkerMutationInput,
  ): Promise<MarkerFullDetail | null> {
    if (!bookId || !cityId) return null;

    try {
      const { data, error } = await client
        .from('markers')
        .insert({
          book_id: bookId,
          city_id: cityId,
          ...this.toMarkerMutationPayload(input),
        })
        .select('id')
        .single();

      if (error) {
        console.error('Error creating marker:', error);
        return null;
      }

      const markerId = (data as { id?: string } | null)?.id;
      if (!markerId) return null;

      const visitsSaved = await this.replaceMarkerVisits(
        client,
        markerId,
        input.visits,
      );
      if (!visitsSaved) return null;

      return await this.mapMarkerFullDetailRow(client, markerId, bookId);
    } catch (err) {
      console.error('Exception creating marker:', err);
      return null;
    }
  }

  async updateMarkerForBook(
    client: SupabaseClient,
    markerId: string,
    bookId: string,
    input: MarkerMutationInput,
  ): Promise<MarkerFullDetail | null> {
    if (!markerId || !bookId) return null;

    try {
      const { error } = await client
        .from('markers')
        .update(this.toMarkerMutationPayload(input))
        .eq('id', markerId)
        .eq('book_id', bookId);

      if (error) {
        console.error('Error updating marker:', error);
        return null;
      }

      const visitsSaved = await this.replaceMarkerVisits(
        client,
        markerId,
        input.visits,
      );
      if (!visitsSaved) return null;

      return await this.mapMarkerFullDetailRow(client, markerId, bookId);
    } catch (err) {
      console.error('Exception updating marker:', err);
      return null;
    }
  }

  async deleteMarkerForBook(
    client: SupabaseClient,
    markerId: string,
    bookId: string,
  ): Promise<boolean> {
    if (!markerId || !bookId) return false;

    try {
      const { error } = await client
        .from('markers')
        .delete()
        .eq('id', markerId)
        .eq('book_id', bookId);

      if (error) {
        console.error('Error deleting marker:', error);
        return false;
      }

      return true;
    } catch (err) {
      console.error('Exception deleting marker:', err);
      return false;
    }
  }
}
