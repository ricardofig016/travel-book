import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-book-cover',
  standalone: true,
  imports: [],
  templateUrl: './book-cover.component.html',
  styleUrl: './book-cover.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookCoverComponent {
}
