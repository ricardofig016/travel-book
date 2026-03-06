import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-photo-albums',
  standalone: true,
  imports: [],
  templateUrl: './photo-albums.component.html',
  styleUrl: './photo-albums.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PhotoAlbumsComponent {
  private router = inject(Router);

  navigatePrev(): void {
    this.router.navigate(['/map']);
  }

  navigateNext(): void {
    this.router.navigate(['/statistics']);
  }
}
