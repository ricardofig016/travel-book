import { Injectable } from '@angular/core';
import { SupabaseClient } from '@supabase/supabase-js';

import {
  CountryCapitalCity,
  CountryCity,
  CountryIsoLookup,
  CountryMarkerDetail,
  CountryMarkerStatusPatch,
  CountryMetadata,
} from './models';

@Injectable({ providedIn: 'root' })
export class SupabaseCountriesService {
  async getVisitedCountryIso2s(
    client: SupabaseClient,
    bookId: string,
  ): Promise<string[]> {
    try {
      const { data, error } = await client
        .from('markers')
        .select('cities(countries(iso_code_2))')
        .eq('book_id', bookId)
        .eq('visited', true);

      if (error) {
        console.error('Error fetching visited countries:', error);
        return [];
      }

      const iso2s = new Set<string>();
      for (const marker of data ?? []) {
        const iso2 = (
          marker as {
            cities?: { countries?: { iso_code_2?: string } | null } | null;
          }
        )?.cities?.countries?.iso_code_2;

        if (iso2) {
          iso2s.add(iso2.toUpperCase());
        }
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
      const { data, error } = await client
        .from('cities')
        .select(
          'id, name, population, latitude, longitude, countries!inner(iso_code_2)',
        )
        .eq('countries.iso_code_2', normalizedIso2)
        .order('population', { ascending: false, nullsFirst: false });

      if (error) {
        console.error('Error fetching country cities by ISO2:', error);
        return [];
      }

      return (
        (data ?? []).map((row: unknown) => {
          const typed = row as {
            id?: string;
            name?: string;
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
            !Number.isFinite(latitude) ||
            !Number.isFinite(longitude)
          )
            return null;

          return {
            id: typed.id,
            name: typed.name,
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
      const { data, error } = await client
        .from('markers')
        .select(
          'id, visited, favorite, want, cities!inner(id, name, countries!inner(iso_code_2))',
        )
        .eq('book_id', bookId)
        .eq('cities.countries.iso_code_2', normalizedIso2);

      if (error) {
        console.error('Error fetching country markers for book:', error);
        return [];
      }

      return (
        (data ?? []).map((row: unknown) => {
          const typed = row as {
            id?: string;
            visited?: boolean;
            favorite?: boolean;
            want?: boolean;
            cities?: { id?: string; name?: string } | null;
          };
          const city = typed.cities;

          if (!typed.id || !city?.id || !city?.name) return null;

          return {
            id: typed.id,
            cityId: city.id,
            cityName: city.name,
            visited: typed.visited ?? false,
            favorite: typed.favorite ?? false,
            want: typed.want ?? false,
          };
        }) as (CountryMarkerDetail | null)[]
      ).filter((marker): marker is CountryMarkerDetail => marker !== null);
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
}
