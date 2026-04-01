import { Injectable } from '@angular/core';
import { SupabaseClient } from '@supabase/supabase-js';

import {
  AlbumBookTriedDishRow,
  AlbumMarkerCountryRow,
  AlbumPhotoMutationInput,
  AlbumPhotoUpdateInput,
  AlbumPhotoRow,
} from './models';

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

  async createMarkerPhoto(
    client: SupabaseClient,
    input: AlbumPhotoMutationInput,
  ): Promise<AlbumPhotoRow | null> {
    if (!input.markerId || !input.url || !input.publicId) return null;

    try {
      const { data, error } = await client
        .from('photos')
        .insert({
          marker_id: input.markerId,
          url: input.url,
          public_id: input.publicId,
          date_taken: input.dateTaken,
          caption: input.caption,
        })
        .select('id, url, public_id, date_taken, caption')
        .single();

      if (error) {
        console.error('Failed to create marker photo:', error);
        return null;
      }

      return (data as AlbumPhotoRow | null) ?? null;
    } catch (error) {
      console.error('Exception while creating marker photo:', error);
      return null;
    }
  }

  async updateMarkerPhoto(
    client: SupabaseClient,
    input: AlbumPhotoUpdateInput,
  ): Promise<AlbumPhotoRow | null> {
    if (!input.markerId || !input.photoId) return null;

    try {
      const payload: Record<string, string | null> = {
        date_taken: input.dateTaken,
        caption: input.caption,
      };

      if (typeof input.url === 'string' && input.url.length > 0)
        payload['url'] = input.url;

      if (typeof input.publicId === 'string' && input.publicId.length > 0)
        payload['public_id'] = input.publicId;

      const { data, error } = await client
        .from('photos')
        .update(payload)
        .eq('id', input.photoId)
        .eq('marker_id', input.markerId)
        .select('id, url, public_id, date_taken, caption')
        .single();

      if (error) {
        console.error('Failed to update marker photo:', error);
        return null;
      }

      return (data as AlbumPhotoRow | null) ?? null;
    } catch (error) {
      console.error('Exception while updating marker photo:', error);
      return null;
    }
  }

  async deleteMarkerPhoto(
    client: SupabaseClient,
    markerId: string,
    photoId: string,
  ): Promise<boolean> {
    if (!markerId || !photoId) return false;

    try {
      const { error } = await client
        .from('photos')
        .delete()
        .eq('id', photoId)
        .eq('marker_id', markerId);

      if (error) {
        console.error('Failed to delete marker photo:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Exception while deleting marker photo:', error);
      return false;
    }
  }
}
