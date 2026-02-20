import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-book-index',
  standalone: true,
  imports: [],
  templateUrl: './book-index.component.html',
  styleUrl: './book-index.component.scss'
})
export class BookIndexComponent {
  constructor(private router: Router) {}

  navigateTo(section: string): void {
    this.router.navigate([`/${section}`]);
  }
}
