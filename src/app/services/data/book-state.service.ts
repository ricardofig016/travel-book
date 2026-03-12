import { Injectable, signal } from '@angular/core';
import { Book } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class BookStateService {
  readonly selectedBook = signal<Book | null>(null);
}
