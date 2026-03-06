import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-book-index',
  standalone: true,
  imports: [],
  templateUrl: './book-index.component.html',
  styleUrl: './book-index.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookIndexComponent {
  private router = inject(Router);

  navigatePrev(): void {
    this.router.navigate(['/cover']);
  }

  navigateNext(): void {
    this.router.navigate(['/map']);
  }
}
