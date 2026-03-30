import { Injectable, signal } from '@angular/core';
import { Book } from '../../services/data/supabase/models';

@Injectable({ providedIn: 'root' })
export class BookStateService {
  readonly selectedBook = signal<Book | null>(null);
  readonly booksInitialized = signal(false);
}
