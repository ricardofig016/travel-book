import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-statistics',
  standalone: true,
  imports: [],
  templateUrl: './statistics.component.html',
  styleUrl: './statistics.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatisticsComponent {
  private router = inject(Router);

  navigatePrev(): void {
    this.router.navigate(['/album']);
  }

  navigateNext(): void {
    this.router.navigate(['/cover']);
  }
}
