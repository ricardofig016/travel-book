import { Injectable, signal } from '@angular/core';
import { Book } from './supabase/models';

@Injectable({ providedIn: 'root' })
export class BookStateService {
  readonly selectedBook = signal<Book | null>(null);
}
