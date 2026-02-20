import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-book-cover',
  standalone: true,
  imports: [],
  templateUrl: './book-cover.component.html',
  styleUrl: './book-cover.component.scss',
})
export class BookCoverComponent {
  constructor(private router: Router) {}

  openBook(): void {
    this.router.navigate(['/index']);
  }
}
