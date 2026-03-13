import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-photo-album',
  standalone: true,
  imports: [],
  templateUrl: './photo-album.component.html',
  styleUrl: './photo-album.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PhotoAlbumComponent {}
