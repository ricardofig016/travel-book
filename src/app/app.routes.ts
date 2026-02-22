import { Routes } from '@angular/router';
import { BookCoverComponent } from './pages/book-cover/book-cover.component';
import { BookIndexComponent } from './pages/book-index/book-index.component';
import { WorldMapComponent } from './pages/world-map/world-map.component';
import { PhotoAlbumsComponent } from './pages/photo-albums/photo-albums.component';
import { StatisticsComponent } from './pages/statistics/statistics.component';

export const routes: Routes = [
  { path: '', component: BookCoverComponent },
  { path: 'index', component: BookIndexComponent },
  { path: 'map', component: WorldMapComponent },
  { path: 'albums', component: PhotoAlbumsComponent },
  { path: 'statistics', component: StatisticsComponent },
  { path: '**', redirectTo: '' },
];
