import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-photo-album',
  standalone: true,
  imports: [],
  templateUrl: './photo-album.component.html',
  styleUrl: './photo-album.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PhotoAlbumComponent {
  private router = inject(Router);

  navigatePrev(): void {
    this.router.navigate(['/map']);
  }

  navigateNext(): void {
    this.router.navigate(['/statistics']);
  }
}
