import { inject } from '@angular/core';
import {
  CanActivateFn,
  Route,
  Router,
  Routes,
  UrlMatchResult,
  UrlSegment,
} from '@angular/router';
import { BookCoverComponent } from './pages/book-cover/book-cover.component';
import { AccountComponent } from './pages/account/account.component';
import { BookIndexComponent } from './pages/book-index/book-index.component';
import { WorldMapComponent } from './pages/world-map/world-map.component';
import { PhotoAlbumComponent } from './pages/photo-album/photo-album.component';
import { StatisticsComponent } from './pages/statistics/statistics.component';

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

const albumCityMarkerGuard: CanActivateFn = (route) => {
  const router = inject(Router);
  const countrySlug = route.paramMap.get('countrySlug');
  const citySlug = route.paramMap.get('citySlug');
  const idTail = route.paramMap.get('idTail');
  const safeIdTail = idTail ?? '';

  if (!countrySlug) return router.createUrlTree(['/album']);

  const isValidCityMarker =
    Boolean(citySlug) && /^[0-9a-f]{12}$/i.test(safeIdTail);

  if (!isValidCityMarker) return router.createUrlTree(['/album', countrySlug]);

  return true;
};

export const routes: Routes = [
  { path: '', component: BookCoverComponent },
  { path: 'cover', component: BookCoverComponent },
  { path: 'account', component: AccountComponent },
  { path: 'index', component: BookIndexComponent },
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
