import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

import { environment } from '../../core/config/environment';

export interface SupabaseConnectionStatus {
  ok: boolean;
  error: string | null;
  countriesCount: number;
}

export interface Book {
  id: string;
  name: string;
  is_public: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  user_id: string;
  home_city_id: string | null;
  hide_demo_book: boolean;
  created_at: string;
  updated_at: string;
}

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  private readonly client: SupabaseClient = createClient(
    environment.supabase.url,
    environment.supabase.publishableKey,
    {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    },
  );

  getClient(): SupabaseClient {
    return this.client;
  }

  async isAuthenticated(): Promise<boolean> {
    try {
      const {
        data: { user },
      } = await this.client.auth.getUser();
      return user !== null;
    } catch (err) {
      console.error('Error checking authentication:', err);
      return false;
    }
  }

  async checkConnection(): Promise<SupabaseConnectionStatus> {
    try {
      const { count, error } = await this.client
        .from('countries')
        .select('id', { count: 'exact', head: true });

      if (error) {
        console.error('Supabase error:', error);
      }

      return {
        ok: !error,
        error: error?.message ?? null,
        countriesCount: count ?? 0,
      };
    } catch (err) {
      console.error('Connection check exception:', err);
      return {
        ok: false,
        error: String(err),
        countriesCount: 0,
      };
    }
  }

  async getUserProfile(): Promise<UserProfile | null> {
    try {
      const {
        data: { user },
      } = await this.client.auth.getUser();

      if (!user) {
        return null;
      }

      const { data, error } = await this.client
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('Error fetching user profile:', error);
        return null;
      }

      return data;
    } catch (err) {
      console.error('Exception fetching user profile:', err);
      return null;
    }
  }

  async setHideDemoBook(hide: boolean): Promise<boolean> {
    try {
      const {
        data: { user },
      } = await this.client.auth.getUser();

      if (!user) {
        console.error('User not authenticated');
        return false;
      }

      const { error } = await this.client
        .from('user_profiles')
        .update({ hide_demo_book: hide })
        .eq('user_id', user.id);

      if (error) {
        console.error('Error updating hide_demo_book:', error);
        return false;
      }

      return true;
    } catch (err) {
      console.error('Exception updating hide_demo_book:', err);
      return false;
    }
  }

  async getUserBooks(): Promise<Book[]> {
    try {
      const {
        data: { user },
      } = await this.client.auth.getUser();

      if (!user) {
        // Not authenticated - return only public demo book
        const { data, error } = await this.client
          .from('books')
          .select('*')
          .eq('is_public', true);

        if (error) {
          console.error('Error fetching public book:', error);
          return [];
        }
        return data || [];
      }

      // Authenticated - get user profile first to check hide_demo_book
      const profile = await this.getUserProfile();
      const hideDemoBook = profile?.hide_demo_book ?? false;

      // Fetch books user is a member of
      const { data, error } = await this.client
        .from('books')
        .select('*')
        .or(
          `id.in.(select book_id from book_members where user_id=${user.id}),is_public.eq.true`,
        );

      if (error) {
        console.error('Error fetching user books:', error);
        return [];
      }

      // Filter out demo book if user has hidden it
      const books = data || [];
      if (hideDemoBook) {
        return books.filter((book) => !book.is_public);
      }

      return books;
    } catch (err) {
      console.error('Exception fetching books:', err);
      return [];
    }
  }
}
