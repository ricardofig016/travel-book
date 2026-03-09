import {
  Component,
  OnInit,
  signal,
  inject,
  ChangeDetectionStrategy,
  effect,
} from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
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
  private router = inject(Router);

  connectionStatus = signal<{
    ok: boolean;
    error: string | null;
    countriesCount: number;
  } | null>(null);

  books = signal<Book[]>([]);
  selectedBook = signal<Book | null>(null);
  isAuthenticated = signal<boolean>(false);
  error = signal<string | null>(null);
  isCreatingBook = signal<boolean>(false);

  constructor() {
    effect(() => {
      const authenticated = this.supabase.isAuthenticated();
      this.isAuthenticated.set(authenticated);
      void this.loadBooks();
    });
  }

  async ngOnInit(): Promise<void> {
    // Check Supabase connection on app init
    const status = await this.supabase.checkConnection();
    this.connectionStatus.set(status);
  }

  private async loadBooks(): Promise<void> {
    const userBooks = await this.supabase.getUserBooks();
    this.books.set(userBooks);

    if (userBooks.length === 0) {
      this.selectedBook.set(null);
      return;
    }

    const currentSelectedBookId = this.selectedBook()?.id;
    if (!currentSelectedBookId) {
      this.selectedBook.set(userBooks[0]);
      return;
    }

    const stillExists = userBooks.some(
      (book) => book.id === currentSelectedBookId,
    );
    if (!stillExists) {
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
    this.error.set(null);
    const success = await this.supabase.setHideDemoBook(true);
    if (success) {
      await this.loadBooks();
    } else {
      this.error.set('Failed to hide demo book');
    }
  }

  async onCreateBook(): Promise<void> {
    if (!this.isAuthenticated()) {
      await this.router.navigate(['/account']);
      return;
    }

    const bookName = prompt('Enter book name:');
    if (!bookName || bookName.trim().length === 0) {
      return; // User cancelled
    }

    this.isCreatingBook.set(true);
    this.error.set(null);

    try {
      const newBook = await this.supabase.createBook(bookName.trim());
      await this.loadBooks();
      this.selectedBook.set(newBook);
    } catch (err: any) {
      this.error.set(err?.message ?? 'Failed to create book');
    } finally {
      this.isCreatingBook.set(false);
    }
  }
}
