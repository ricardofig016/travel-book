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
import { BookStateService } from './services/data/book-state.service';
import { CommonModule } from '@angular/common';
import {
  CreateBookDialogComponent,
  CreateBookResult,
} from './shared/create-book-dialog/create-book-dialog.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, CommonModule, CreateBookDialogComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit {
  title = 'travel-book';
  private supabase = inject(SupabaseService);
  private router = inject(Router);
  private bookState = inject(BookStateService);

  connectionStatus = signal<{
    ok: boolean;
    error: string | null;
    countriesCount: number;
  } | null>(null);

  books = signal<Book[]>([]);
  readonly selectedBook = this.bookState.selectedBook;
  readonly isAuthenticated = this.supabase.isAuthenticated;
  error = signal<string | null>(null);
  isCreatingBook = signal<boolean>(false);
  showCreateDialog = signal<boolean>(false);

  constructor() {
    effect(() => {
      this.supabase.isAuthenticated(); // track auth changes to reload books
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
    this.showCreateDialog.set(true);
  }

  async onCreateBookConfirm(result: CreateBookResult): Promise<void> {
    this.showCreateDialog.set(false);
    this.isCreatingBook.set(true);
    this.error.set(null);

    try {
      const newBook = await this.supabase.createBook(
        result.name,
        result.memberUserIds,
      );
      await this.loadBooks();
      this.selectedBook.set(newBook);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to create book';
      this.error.set(message);
    } finally {
      this.isCreatingBook.set(false);
    }
  }

  onCreateBookCancel(): void {
    this.showCreateDialog.set(false);
  }
}
