import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-world-map',
  standalone: true,
  imports: [],
  templateUrl: './world-map.component.html',
  styleUrl: './world-map.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorldMapComponent {
  private router = inject(Router);

  navigatePrev(): void {
    this.router.navigate(['/index']);
  }

  navigateNext(): void {
    this.router.navigate(['/album']);
  }
}
