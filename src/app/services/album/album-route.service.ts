import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AlbumRouteService {
  slugify(value: string): string {
    const base = value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

    const slug = base
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '');

    return slug || 'unknown';
  }

  getMarkerIdTail(markerId: string, length = 12): string {
    return markerId.slice(-length);
  }

  buildCountryAlbumPath(countryName: string): string {
    return `/album/${this.slugify(countryName)}`;
  }

  buildCityMarkerPath(
    countryName: string,
    cityName: string,
    markerId: string,
  ): string {
    return this.buildCityMarkerPathFromSlugs(
      this.slugify(countryName),
      this.slugify(cityName),
      this.getMarkerIdTail(markerId),
    );
  }

  buildCityMarkerPathFromSlugs(
    countrySlug: string,
    citySlug: string,
    idTail: string,
  ): string {
    return `/album/${countrySlug}/${citySlug}--${idTail}`;
  }
}