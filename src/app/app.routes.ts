import { Route, Routes, UrlMatchResult, UrlSegment } from '@angular/router';
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

  if (separatorIndex <= 0 || separatorIndex >= cityWithId.length - 2)
    return null;

  const citySlug = cityWithId.slice(0, separatorIndex);
  const idTail = cityWithId.slice(separatorIndex + 2);

  // idTail should be a 12-character hexadecimal string (representing the last 12 characters of a UUID)
  if (!/^[0-9a-f]{12}$/i.test(idTail)) return null;

  return {
    consumed: segments,
    posParams: {
      countrySlug: new UrlSegment(countrySlug, {}),
      citySlug: new UrlSegment(citySlug, {}),
      idTail: new UrlSegment(idTail, {}),
    },
  };
};

export const routes: Routes = [
  { path: '', component: BookCoverComponent },
  { path: 'cover', component: BookCoverComponent },
  { path: 'account', component: AccountComponent },
  { path: 'index', component: BookIndexComponent },
  { path: 'map', component: WorldMapComponent },
  { path: 'album', component: PhotoAlbumComponent },
  { path: 'album/:countrySlug', component: PhotoAlbumComponent },
  { matcher: albumCityMarkerMatcher, component: PhotoAlbumComponent },
  { path: 'statistics', component: StatisticsComponent },
  { path: '**', redirectTo: '' },
];
