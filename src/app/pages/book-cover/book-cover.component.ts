import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-book-cover',
  standalone: true,
  imports: [],
  templateUrl: './book-cover.component.html',
  styleUrl: './book-cover.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookCoverComponent {
  private router = inject(Router);

  navigatePrev(): void {
    this.router.navigate(['/statistics']);
  }

  navigateNext(): void {
    this.router.navigate(['/account']);
  }
}
