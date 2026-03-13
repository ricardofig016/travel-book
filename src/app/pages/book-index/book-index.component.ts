import { Component } from '@angular/core';
import { ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-book-index',
  standalone: true,
  imports: [],
  templateUrl: './book-index.component.html',
  styleUrl: './book-index.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookIndexComponent {}
