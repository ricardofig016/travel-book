import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-book-cover',
  standalone: true,
  imports: [],
  templateUrl: './cover.component.html',
  styleUrl: './cover.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookCoverComponent {
}
