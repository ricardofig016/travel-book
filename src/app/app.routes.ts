import { inject } from '@angular/core';
import {
  CanActivateFn,
  Route,
  Router,
  Routes,
  UrlMatchResult,
  UrlSegment,
} from '@angular/router';
import { BookCoverComponent } from './pages/cover/cover.component';
import { AccountComponent } from './pages/account/account.component';
import { WorldMapComponent } from './pages/map/map.component';
import { PhotoAlbumComponent } from './pages/album/album.component';
import { StatisticsComponent } from './pages/statistics/statistics.component';
import { BookStateService } from './services/data/book-state.service';
import { AlbumDataService } from './services/album/album-data.service';

const albumCityMarkerMatcher = (
  segments: UrlSegment[],
  _group: unknown,
  _route: Route,
): UrlMatchResult | null => {
  if (segments.length !== 3 || segments[0].path !== 'album') return null;

  const countrySlug = segments[1].path;
  const cityWithId = segments[2].path;
  const separatorIndex = cityWithId.lastIndexOf('--');

  const citySlug =
    separatorIndex >= 0 ? cityWithId.slice(0, separatorIndex) : cityWithId;
  const idTail =
    separatorIndex >= 0 ? cityWithId.slice(separatorIndex + 2) : '';

  return {
    consumed: segments,
    posParams: {
      countrySlug: new UrlSegment(countrySlug, {}),
      citySlug: new UrlSegment(citySlug, {}),
      idTail: new UrlSegment(idTail, {}),
    },
  };
};

const albumCityMarkerGuard: CanActivateFn = async (route) => {
  const router = inject(Router);
  const bookState = inject(BookStateService);
  const albumData = inject(AlbumDataService);
  const countrySlug = route.paramMap.get('countrySlug');
  const citySlug = route.paramMap.get('citySlug');
  const idTail = route.paramMap.get('idTail');

  if (!countrySlug) return router.createUrlTree(['/album']);
  if (!citySlug) return router.createUrlTree(['/album', countrySlug]);

  let selectedBookId = bookState.selectedBook()?.id ?? null;

  if (!selectedBookId && !bookState.booksInitialized()) {
    await waitForBooksInitialization(bookState);
    selectedBookId = bookState.selectedBook()?.id ?? null;
  }

  if (!selectedBookId) return router.createUrlTree(['/album', countrySlug]);

  const safeIdTail = idTail ?? '';
  const isValidTailFormat = /^[0-9a-f]{12}$/i.test(safeIdTail);

  if (isValidTailFormat) {
    const exactMatch = await albumData.getCityMarkerPage(
      selectedBookId,
      countrySlug,
      citySlug,
      safeIdTail,
    );

    if (exactMatch) return true;
  }

  const bestIdTail = await albumData.getBestCityMarkerIdTail(
    selectedBookId,
    countrySlug,
    citySlug,
  );

  if (bestIdTail) {
    return router.createUrlTree([
      '/album',
      countrySlug,
      `${citySlug}--${bestIdTail}`,
    ]);
  }

  return router.createUrlTree(['/album', countrySlug]);
};

const waitForBooksInitialization = (
  bookState: BookStateService,
  timeoutMs = 4000,
): Promise<void> =>
  new Promise((resolve) => {
    if (bookState.booksInitialized()) {
      resolve();
      return;
    }

    const startedAt = Date.now();
    const interval = setInterval(() => {
      if (bookState.booksInitialized()) {
        clearInterval(interval);
        resolve();
        return;
      }

      if (Date.now() - startedAt >= timeoutMs) {
        clearInterval(interval);
        resolve();
      }
    }, 50);
  });

export const routes: Routes = [
  { path: '', component: BookCoverComponent },
  { path: 'cover', component: BookCoverComponent },
  { path: 'account', component: AccountComponent },
  { path: 'map', component: WorldMapComponent },
  { path: 'album', component: PhotoAlbumComponent },
  { path: 'album/:countrySlug', component: PhotoAlbumComponent },
  {
    matcher: albumCityMarkerMatcher,
    component: PhotoAlbumComponent,
    canActivate: [albumCityMarkerGuard],
  },
  { path: 'statistics', component: StatisticsComponent },
  { path: '**', redirectTo: '' },
];
