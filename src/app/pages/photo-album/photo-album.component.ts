import { CommonModule } from '@angular/common';
import {
  Component,
  ChangeDetectionStrategy,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { BookStateService } from '../../services/data/book-state.service';
import { AlbumDataService } from '../../services/album/album-data.service';
import {
  AlbumCityMarkerData,
  AlbumCountryIndexItem,
  AlbumCountryPageData,
} from '../../services/album/models';

@Component({
  selector: 'app-photo-album',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './photo-album.component.html',
  styleUrl: './photo-album.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PhotoAlbumComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly bookState = inject(BookStateService);
  private readonly albumData = inject(AlbumDataService);
  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });
  private requestId = 0;

  readonly selectedBook = this.bookState.selectedBook;
  readonly isLoading = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly countryIndex = signal<AlbumCountryIndexItem[]>([]);
  readonly countryPage = signal<AlbumCountryPageData | null>(null);
  readonly cityMarkerPage = signal<AlbumCityMarkerData | null>(null);

  readonly countrySlug = computed(() => this.params().get('countrySlug'));
  readonly citySlug = computed(() => this.params().get('citySlug'));
  readonly idTail = computed(() => this.params().get('idTail'));

  readonly viewType = computed<'landing' | 'country' | 'city-marker'>(() => {
    if (this.idTail()) return 'city-marker';
    if (this.countrySlug()) return 'country';
    return 'landing';
  });

  readonly hasSelectedBook = computed(() => Boolean(this.selectedBook()));

  constructor() {
    effect(() => {
      const bookId = this.selectedBook()?.id ?? null;
      const countrySlug = this.countrySlug();
      const citySlug = this.citySlug();
      const idTail = this.idTail();

      void this.loadDataForRoute(bookId, countrySlug, citySlug, idTail);
    });
  }

  private async loadDataForRoute(
    bookId: string | null,
    countrySlug: string | null,
    citySlug: string | null,
    idTail: string | null,
  ): Promise<void> {
    const requestId = ++this.requestId;
    this.loadError.set(null);
    this.isLoading.set(true);
    this.countryPage.set(null);
    this.cityMarkerPage.set(null);

    if (!bookId) {
      this.countryIndex.set([]);
      this.isLoading.set(false);
      return;
    }

    try {
      const countryIndex = await this.albumData.getCountryIndex(bookId);
      if (requestId !== this.requestId) return;
      this.countryIndex.set(countryIndex);

      if (!countrySlug) {
        this.isLoading.set(false);
        return;
      }

      if (citySlug && idTail) {
        const cityMarkerPage = await this.albumData.getCityMarkerPage(
          bookId,
          countrySlug,
          citySlug,
          idTail,
        );

        if (requestId !== this.requestId) return;

        if (!cityMarkerPage) {
          this.loadError.set('Marker not found for this route.');
          this.isLoading.set(false);
          return;
        }

        this.cityMarkerPage.set(cityMarkerPage);
        this.isLoading.set(false);
        return;
      }

      const countryPage = await this.albumData.getCountryPage(
        bookId,
        countrySlug,
      );

      if (requestId !== this.requestId) return;

      if (!countryPage) {
        this.loadError.set('Country not found in selected book markers.');
        this.isLoading.set(false);
        return;
      }

      this.countryPage.set(countryPage);
      this.isLoading.set(false);
    } catch (error) {
      if (requestId !== this.requestId) return;

      console.error('Failed to load album data', error);
      this.loadError.set('Failed to load album data.');
      this.countryIndex.set([]);
      this.countryPage.set(null);
      this.cityMarkerPage.set(null);
      this.isLoading.set(false);
    }
  }

  getCityMarkerLink(
    countrySlug: string,
    citySlug: string,
    idTail: string,
  ): string {
    return `/album/${countrySlug}/${citySlug}--${idTail}`;
  }

  formatPopulation(value: number | null): string {
    if (!value || value <= 0) return 'N/A';
    return value.toLocaleString();
  }

  formatArea(value: number | null): string {
    if (!value || value <= 0) return 'N/A';
    return `${Math.round(value).toLocaleString()} km²`;
  }
}
