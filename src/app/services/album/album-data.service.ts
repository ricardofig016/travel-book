import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../data/supabase.service';
import { AlbumRouteService } from './album-route.service';
import {
  AlbumCityMarkerData,
  AlbumCountryCityItem,
  AlbumCountryIndexItem,
  AlbumCountryPageData,
  AlbumPhoto,
  AlbumTriedDishItem,
} from './models';

interface MarkerCountryRow {
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

@Injectable({ providedIn: 'root' })
export class AlbumDataService {
  private readonly supabase = inject(SupabaseService);
  private readonly albumRoutes = inject(AlbumRouteService);

  async getCountryIndex(bookId: string): Promise<AlbumCountryIndexItem[]> {
    const rows = await this.fetchMarkerCountryRows(bookId);

    const byCountry = new Map<
      string,
      {
        item: AlbumCountryIndexItem;
        cityIds: Set<string>;
      }
    >();

    for (const row of rows) {
      const country = row.cities?.countries;
      const city = row.cities;
      const countryId = country?.id ?? null;
      const cityId = city?.id ?? null;
      const countryName = country?.name ?? null;
      const isoCode2 = this.normalizeIsoCode2(country?.iso_code_2);
      if (!countryId || !cityId || !countryName || !isoCode2) continue;

      const existing = byCountry.get(countryId);
      if (!existing) {
        const markerCount = 1;
        byCountry.set(countryId, {
          item: {
            countryId,
            countryName,
            countrySlug: this.albumRoutes.slugify(countryName),
            isoCode2,
            flagEmoji: country?.flag_emoji ?? null,
            markerCount,
            visitedCount: row.visited ? 1 : 0,
            favoriteCount: row.favorite ? 1 : 0,
            wantCount: row.want ? 1 : 0,
            cityCount: 1,
          },
          cityIds: new Set([cityId]),
        });
        continue;
      }

      existing.item.markerCount += 1;
      if (row.visited) existing.item.visitedCount += 1;
      if (row.favorite) existing.item.favoriteCount += 1;
      if (row.want) existing.item.wantCount += 1;
      existing.cityIds.add(cityId);
      existing.item.cityCount = existing.cityIds.size;
    }

    return Array.from(byCountry.values())
      .map((entry) => entry.item)
      .sort((a, b) => a.countryName.localeCompare(b.countryName));
  }

  async getCountryPage(
    bookId: string,
    countrySlug: string,
  ): Promise<AlbumCountryPageData | null> {
    const rows = await this.fetchMarkerCountryRows(bookId);

    const matchedRows = rows.filter((row) => {
      const countryName = row.cities?.countries?.name ?? null;
      if (!countryName) return false;
      return this.albumRoutes.slugify(countryName) === countrySlug;
    });

    if (matchedRows.length === 0) return null;

    const firstCountry = matchedRows[0].cities?.countries;
    const countryId = firstCountry?.id ?? null;
    const countryName = firstCountry?.name ?? null;
    const isoCode2 = this.normalizeIsoCode2(firstCountry?.iso_code_2);
    const isoCode3 = this.normalizeIsoCode3(firstCountry?.iso_code_3);
    if (!countryId || !countryName || !isoCode2 || !isoCode3) return null;

    const cities: AlbumCountryCityItem[] = matchedRows
      .map((row) => {
        const markerId = row.id ?? null;
        const cityId = row.cities?.id ?? null;
        const cityName = row.cities?.name ?? null;
        if (!markerId || !cityId || !cityName) return null;

        return {
          markerId,
          markerIdTail: this.albumRoutes.getMarkerIdTail(markerId),
          cityId,
          cityName,
          citySlug: this.albumRoutes.slugify(cityName),
          adminName: row.cities?.admin_name ?? null,
          visited: Boolean(row.visited),
          favorite: Boolean(row.favorite),
          want: Boolean(row.want),
          photoCount: (row.photos ?? []).length,
        };
      })
      .filter((value): value is AlbumCountryCityItem => value !== null)
      .sort((a, b) => a.cityName.localeCompare(b.cityName));

    const dishesTried = await this.fetchCountryTriedDishes(bookId, countryId);

    const photoCount = matchedRows.reduce(
      (sum, row) => sum + (row.photos ?? []).length,
      0,
    );

    return {
      country: {
        id: countryId,
        name: countryName,
        slug: countrySlug,
        nativeName: firstCountry?.native_name ?? null,
        isoCode2,
        isoCode3,
        population: this.toNullableNumber(firstCountry?.population),
        area: this.toNullableNumber(firstCountry?.area),
        flagEmoji: firstCountry?.flag_emoji ?? null,
      },
      bookInfo: {
        markerCount: matchedRows.length,
        visitedCount: matchedRows.filter((row) => row.visited).length,
        favoriteCount: matchedRows.filter((row) => row.favorite).length,
        wantCount: matchedRows.filter((row) => row.want).length,
        cityCount: cities.length,
        photoCount,
      },
      cities,
      dishesTried,
    };
  }

  async getCityMarkerPage(
    bookId: string,
    countrySlug: string,
    citySlug: string,
    idTail: string,
  ): Promise<AlbumCityMarkerData | null> {
    const rows = await this.fetchMarkerCountryRows(bookId, true);

    const matchedRow = rows.find((row) => {
      if (!row.visited) return false;

      const markerId = row.id ?? '';
      const rowCountryName = row.cities?.countries?.name ?? null;
      const rowCityName = row.cities?.name ?? null;
      if (!rowCountryName || !rowCityName) return false;

      return (
        markerId.toLowerCase().endsWith(idTail.toLowerCase()) &&
        this.albumRoutes.slugify(rowCountryName) === countrySlug &&
        this.albumRoutes.slugify(rowCityName) === citySlug
      );
    });

    if (!matchedRow) return null;

    const markerId = matchedRow.id ?? null;
    const country = matchedRow.cities?.countries;
    const city = matchedRow.cities;
    const countryName = country?.name ?? null;
    const cityName = city?.name ?? null;
    const countryId = country?.id ?? null;
    const cityId = city?.id ?? null;
    const isoCode2 = this.normalizeIsoCode2(country?.iso_code_2);
    const isoCode3 = this.normalizeIsoCode3(country?.iso_code_3);

    if (
      !markerId ||
      !country ||
      !city ||
      !countryName ||
      !cityName ||
      !countryId ||
      !cityId ||
      !isoCode2 ||
      !isoCode3
    )
      return null;

    const photoRows = matchedRow.photos ?? [];

    const photos: AlbumPhoto[] = photoRows
      .map((photo) => {
        if (!photo.id || !photo.url || !photo.public_id) return null;

        return {
          id: photo.id,
          url: photo.url,
          publicId: photo.public_id,
          dateTaken: photo.date_taken ?? null,
          caption: photo.caption ?? null,
        };
      })
      .filter((value): value is AlbumPhoto => value !== null);

    const visits = (matchedRow.marker_visits ?? [])
      .map((visit) => {
        if (!visit.id || !visit.start_date || !visit.end_date) return null;
        return {
          id: visit.id,
          startDate: visit.start_date,
          endDate: visit.end_date,
        };
      })
      .filter(
        (value): value is { id: string; startDate: string; endDate: string } =>
          value !== null,
      )
      .sort((a, b) => a.startDate.localeCompare(b.startDate));

    return {
      markerId,
      markerIdTail: this.albumRoutes.getMarkerIdTail(markerId),
      country: {
        id: countryId,
        name: countryName,
        slug: this.albumRoutes.slugify(countryName),
        nativeName: country.native_name ?? null,
        isoCode2,
        isoCode3,
        population: this.toNullableNumber(country.population),
        area: this.toNullableNumber(country.area),
        flagEmoji: country.flag_emoji ?? null,
      },
      city: {
        id: cityId,
        name: cityName,
        slug: this.albumRoutes.slugify(cityName),
        adminName: city.admin_name ?? null,
      },
      status: {
        visited: Boolean(matchedRow.visited),
        favorite: Boolean(matchedRow.favorite),
        want: Boolean(matchedRow.want),
      },
      notes: matchedRow.notes ?? null,
      companions: matchedRow.companions ?? [],
      activities: matchedRow.activities ?? [],
      visits,
      photos,
    };
  }

  async getBestCityMarkerIdTail(
    bookId: string,
    countrySlug: string,
    citySlug: string,
  ): Promise<string | null> {
    const rows = await this.fetchMarkerCountryRows(bookId);

    const candidates = rows
      .map((row) => {
        if (!row.visited) return null;

        const markerId = row.id ?? null;
        const rowCountryName = row.cities?.countries?.name ?? null;
        const rowCityName = row.cities?.name ?? null;
        if (!markerId || !rowCountryName || !rowCityName) return null;

        if (
          this.albumRoutes.slugify(rowCountryName) !== countrySlug ||
          this.albumRoutes.slugify(rowCityName) !== citySlug
        )
          return null;

        return {
          markerId,
          markerIdTail: this.albumRoutes.getMarkerIdTail(markerId),
          photoCount: (row.photos ?? []).length,
          visited: Boolean(row.visited),
          favorite: Boolean(row.favorite),
          want: Boolean(row.want),
        };
      })
      .filter(
        (
          value,
        ): value is {
          markerId: string;
          markerIdTail: string;
          photoCount: number;
          visited: boolean;
          favorite: boolean;
          want: boolean;
        } => value !== null,
      )
      .sort((a, b) => {
        if (a.favorite !== b.favorite)
          return Number(b.favorite) - Number(a.favorite);
        if (a.photoCount !== b.photoCount) return b.photoCount - a.photoCount;
        return a.markerId.localeCompare(b.markerId);
      });

    if (candidates.length === 0) return null;
    return candidates[0].markerIdTail;
  }

  private async fetchMarkerCountryRows(
    bookId: string,
    includeMarkerDetails = false,
  ): Promise<MarkerCountryRow[]> {
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

      const { data, error } = await this.supabase
        .getClient()
        .from('markers')
        .select([...selectBase, ...selectDetails].join(', '))
        .eq('book_id', bookId);

      if (error) {
        console.error('Failed to load marker-country rows:', error);
        return [];
      }

      return (data as MarkerCountryRow[] | null) ?? [];
    } catch (error) {
      console.error('Exception while loading marker-country rows:', error);
      return [];
    }
  }

  private async fetchCountryTriedDishes(
    bookId: string,
    countryId: string,
  ): Promise<AlbumTriedDishItem[]> {
    try {
      const { data, error } = await this.supabase
        .getClient()
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

      return (
        (data as Array<{
          dishes?: {
            id?: string | null;
            name?: string | null;
            category?: string | null;
            rating?: number | string | null;
            image_url?: string | null;
          } | null;
        }> | null) ?? []
      )
        .map((row) => {
          const dish = row.dishes;
          if (!dish?.id || !dish.name) return null;

          return {
            dishId: dish.id,
            name: dish.name,
            category: dish.category ?? null,
            rating: this.toNullableNumber(dish.rating),
            imageUrl: dish.image_url ?? null,
          };
        })
        .filter((dish): dish is AlbumTriedDishItem => dish !== null)
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      console.error('Exception while loading country dishes:', error);
      return [];
    }
  }

  private normalizeIsoCode2(value: string | null | undefined): string | null {
    const normalized = value?.trim().toUpperCase() ?? '';
    if (!/^[A-Z]{2}$/.test(normalized)) return null;
    return normalized;
  }

  private normalizeIsoCode3(value: string | null | undefined): string | null {
    const normalized = value?.trim().toUpperCase() ?? '';
    if (!/^[A-Z]{3}$/.test(normalized)) return null;
    return normalized;
  }

  private toNullableNumber(
    value: number | string | null | undefined,
  ): number | null {
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue)) return null;
    return numberValue;
  }
}
