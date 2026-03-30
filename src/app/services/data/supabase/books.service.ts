import { Injectable, inject } from '@angular/core';
import { SupabaseClient } from '@supabase/supabase-js';

import { Book, UserLookupResult } from './models';
import { SupabaseAuthService } from './auth.service';

interface MembershipRow {
  book_id: string;
}

@Injectable({ providedIn: 'root' })
export class SupabaseBooksService {
  private readonly authService = inject(SupabaseAuthService);

  private readonly pageSize = 1000;

  private async fetchPublicBooks(client: SupabaseClient): Promise<Book[]> {
    const books: Book[] = [];
    let offset = 0;

    while (true) {
      const { data, error } = await client
        .from('books')
        .select('*')
        .eq('is_public', true)
        .range(offset, offset + this.pageSize - 1);

      if (error) {
        console.error('Error fetching public books:', error);
        return [];
      }

      const pageRows = (data as Book[] | null) ?? [];
      books.push(...pageRows);

      if (pageRows.length < this.pageSize) break;
      offset += this.pageSize;
    }

    return books;
  }

  private async fetchMembershipBookIds(
    client: SupabaseClient,
    userId: string,
  ): Promise<string[]> {
    const bookIds: string[] = [];
    let offset = 0;

    while (true) {
      const { data, error } = await client
        .from('book_members')
        .select('book_id')
        .eq('user_id', userId)
        .range(offset, offset + this.pageSize - 1);

      if (error) {
        console.error('Error fetching user memberships:', error);
        return [];
      }

      const pageRows = ((data ?? []) as MembershipRow[]).map(
        (membership) => membership.book_id,
      );
      bookIds.push(...pageRows);

      if (pageRows.length < this.pageSize) break;
      offset += this.pageSize;
    }

    return bookIds;
  }

  private async fetchBooksByIds(
    client: SupabaseClient,
    bookIds: string[],
  ): Promise<Book[]> {
    const result: Book[] = [];
    const chunkSize = 500;

    for (let start = 0; start < bookIds.length; start += chunkSize) {
      const chunk = bookIds.slice(start, start + chunkSize);
      if (chunk.length === 0) continue;

      const { data, error } = await client
        .from('books')
        .select('*')
        .in('id', chunk);

      if (error) {
        console.error('Error fetching member books:', error);
        return [];
      }

      result.push(...((data as Book[] | null) ?? []));
    }

    return result;
  }

  async getUserBooks(client: SupabaseClient): Promise<Book[]> {
    try {
      const {
        data: { user },
      } = await client.auth.getUser();

      if (!user) return await this.fetchPublicBooks(client);

      const profile = await this.authService.getUserProfile(client);
      const hideDemoBook = profile?.hide_demo_book ?? false;

      const memberBookIds = await this.fetchMembershipBookIds(client, user.id);
      const publicBooks = await this.fetchPublicBooks(client);

      let memberBooks: Book[] = [];
      if (memberBookIds.length > 0) {
        memberBooks = await this.fetchBooksByIds(client, memberBookIds);
      }

      const booksById = new Map<string, Book>();
      for (const book of [...memberBooks, ...publicBooks])
        booksById.set(book.id, book);

      const books = Array.from(booksById.values());
      if (hideDemoBook) return books.filter((book) => !book.is_public);

      return books;
    } catch (err) {
      console.error('Exception fetching books:', err);
      return [];
    }
  }

  async lookupUserByEmail(
    client: SupabaseClient,
    email: string,
  ): Promise<UserLookupResult | null> {
    const { data, error } = await client.rpc('lookup_user_by_email', {
      lookup_email: email,
    });

    if (error) {
      console.error('Error looking up user by email:', error);
      throw error;
    }

    if (!data || data.length === 0) return null;
    return data[0] as UserLookupResult;
  }

  async createBook(
    client: SupabaseClient,
    name: string,
    memberUserIds: string[] = [],
  ): Promise<Book> {
    const {
      data: { session },
    } = await client.auth.getSession();

    if (!session?.user)
      throw new Error('Auth session invalid or expired. Please sign in again.');

    const userId = session.user.id;

    const { data: bookData, error: bookError } = await client
      .from('books')
      .insert({
        name,
        is_public: false,
        created_by: userId,
      })
      .select('*')
      .single();

    if (bookError) throw bookError;
    if (!bookData) throw new Error('Book creation returned no data');

    const uniqueMemberIds = new Set([userId, ...memberUserIds]);
    const memberRows = Array.from(uniqueMemberIds).map((uid) => ({
      book_id: bookData.id,
      user_id: uid,
    }));

    const { error: memberError } = await client
      .from('book_members')
      .insert(memberRows);

    if (memberError) {
      console.error('Error adding members to book:', memberError);
      throw memberError;
    }

    return bookData as Book;
  }
}
