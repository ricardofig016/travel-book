import { Injectable } from '@angular/core';
import { SupabaseClient } from '@supabase/supabase-js';

import { AlbumBookTriedDishRow, AlbumMarkerCountryRow } from './models';

@Injectable({ providedIn: 'root' })
export class SupabaseAlbumService {
  async getMarkerCountryRows(
    client: SupabaseClient,
    bookId: string,
    includeMarkerDetails = false,
  ): Promise<AlbumMarkerCountryRow[]> {
    if (!bookId) return [];

    try {
      const photoSelect = includeMarkerDetails
        ? 'photos(id, url, public_id, date_taken, caption)'
        : 'photos(id)';

      const selectBase = [
        'id',
        'visited',
        'favorite',
        'want',
        'cities!inner(id, name, admin_name, countries!inner(id, name, native_name, iso_code_2, iso_code_3, population, area, flag_emoji))',
        photoSelect,
      ];

      const selectDetails = includeMarkerDetails
        ? [
            'notes',
            'companions',
            'activities',
            'marker_visits(id, start_date, end_date)',
          ]
        : [];

      const { data, error } = await client
        .from('markers')
        .select([...selectBase, ...selectDetails].join(', '))
        .eq('book_id', bookId);

      if (error) {
        console.error('Failed to load marker-country rows:', error);
        return [];
      }

      return (data as AlbumMarkerCountryRow[] | null) ?? [];
    } catch (error) {
      console.error('Exception while loading marker-country rows:', error);
      return [];
    }
  }

  async getBookTriedDishesForCountry(
    client: SupabaseClient,
    bookId: string,
    countryId: string,
  ): Promise<AlbumBookTriedDishRow[]> {
    if (!bookId || !countryId) return [];

    try {
      const { data, error } = await client
        .from('book_tried_dishes')
        .select(
          'dish_id, dishes!inner(id, name, category, rating, image_url, country_id)',
        )
        .eq('book_id', bookId)
        .eq('dishes.country_id', countryId);

      if (error) {
        console.error('Failed to load country dishes:', error);
        return [];
      }

      return (data as AlbumBookTriedDishRow[] | null) ?? [];
    } catch (error) {
      console.error('Exception while loading country dishes:', error);
      return [];
    }
  }
}
