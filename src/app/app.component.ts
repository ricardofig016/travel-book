import {
  Component,
  OnInit,
  signal,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SupabaseService, Book } from './services/data/supabase.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, CommonModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit {
  title = 'travel-book';
  private supabase = inject(SupabaseService);

  connectionStatus = signal<{
    ok: boolean;
    error: string | null;
    countriesCount: number;
  } | null>(null);

  books = signal<Book[]>([]);
  selectedBook = signal<Book | null>(null);
  isAuthenticated = signal<boolean>(false);

  async ngOnInit(): Promise<void> {
    // Check Supabase connection on app init
    const status = await this.supabase.checkConnection();
    this.connectionStatus.set(status);

    // Check authentication status
    const authenticated = await this.supabase.isAuthenticated();
    this.isAuthenticated.set(authenticated);

    // Load books
    const userBooks = await this.supabase.getUserBooks();
    this.books.set(userBooks);

    // Select first book by default
    if (userBooks.length > 0) {
      this.selectedBook.set(userBooks[0]);
    }
  }

  onBookChange(event: Event): void {
    const bookId = (event.target as HTMLSelectElement).value;
    const book = this.books().find((b) => b.id === bookId);
    if (book) {
      this.selectedBook.set(book);
    }
  }

  onExportBook(): void {
    // TODO: Implement export functionality
    console.log('Export book - not implemented yet');
  }

  async onHideDemoBook(): Promise<void> {
    const success = await this.supabase.setHideDemoBook(true);
    if (success) {
      // Reload books to reflect the change
      const userBooks = await this.supabase.getUserBooks();
      this.books.set(userBooks);

      // If the selected book was the demo book, select the first available book
      if (this.selectedBook()?.is_public && userBooks.length > 0) {
        this.selectedBook.set(userBooks[0]);
      } else if (userBooks.length === 0) {
        this.selectedBook.set(null);
      }
    } else {
      console.error('Failed to hide demo book');
    }
  }
}
