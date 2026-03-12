import { Injectable, signal, computed } from '@angular/core';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';

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

export interface CitySearchResult {
  id: string;
  name: string;
  country: string;
}

export interface UserLookupResult {
  user_id: string;
  email: string;
  name: string | null;
}

export interface CountryIsoLookup {
  byIso3: Record<string, string>;
  byIso2: Record<string, string>;
  byName: Record<string, string>;
}

export interface BookVisitedLandAreaStats {
  visitedArea: number;
  totalArea: number;
  visitedPercent: number;
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

  // Auth state signals
  private readonly currentUserSignal = signal<User | null>(null);
  readonly currentUser = this.currentUserSignal.asReadonly();
  readonly isAuthenticated = computed(() => this.currentUserSignal() !== null);

  constructor() {
    this.initAuthListener();
  }

  private async initAuthListener(): Promise<void> {
    // Get initial session
    const {
      data: { user },
    } = await this.client.auth.getUser();
    this.currentUserSignal.set(user);

    // Listen for auth state changes
    this.client.auth.onAuthStateChange((_event, session) => {
      this.currentUserSignal.set(session?.user ?? null);
    });
  }

  getClient(): SupabaseClient {
    return this.client;
  }

  getCurrentUser(): User | null {
    return this.currentUserSignal();
  }

  async signIn(email: string, password: string): Promise<User> {
    const { data, error } = await this.client.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('Sign in error:', error);
      throw error;
    }

    if (!data.user) {
      throw new Error('Sign in failed: no user returned');
    }

    return data.user;
  }

  async signUp(
    name: string,
    email: string,
    password: string,
    homeCityId: string,
  ): Promise<User> {
    // Sign up with user metadata
    const { data, error } = await this.client.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          home_city_id: homeCityId,
        },
      },
    });

    if (error) {
      console.error('Sign up error:', error);
      throw error;
    }

    if (!data.user) {
      throw new Error('Sign up failed: no user returned');
    }

    // Best-effort profile write
    try {
      const { error: profileError } = await this.client
        .from('user_profiles')
        .upsert({
          user_id: data.user.id,
          home_city_id: homeCityId,
          hide_demo_book: false,
        });

      if (profileError) {
        console.warn('Profile write deferred to DB trigger:', profileError);
      }
    } catch (err) {
      console.warn('Profile write skipped (handled by DB trigger):', err);
    }

    return data.user;
  }

  async signOut(): Promise<void> {
    const { error } = await this.client.auth.signOut();

    if (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  }

  async searchCities(term: string): Promise<CitySearchResult[]> {
    if (term.length < 2) {
      return [];
    }

    try {
      const { data, error } = await this.client
        .from('cities')
        .select('id, name, name_ascii, countries(name)')
        .or(`name.ilike.%${term}%,name_ascii.ilike.%${term}%`)
        .limit(10);

      if (error) {
        console.error('Error searching cities:', error);
        return [];
      }

      // Format results as "city, country"
      return (
        data?.map((city: any) => ({
          id: city.id,
          name: city.name,
          country: city.countries?.name || 'Unknown',
        })) || []
      );
    } catch (err) {
      console.error('Exception searching cities:', err);
      return [];
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

      // Fetch memberships first, then load member books + demo book.
      const { data: memberships, error: membershipsError } = await this.client
        .from('book_members')
        .select('book_id')
        .eq('user_id', user.id);

      if (membershipsError) {
        console.error('Error fetching user memberships:', membershipsError);
        return [];
      }

      const memberBookIds = (memberships ?? []).map(
        (membership) => membership.book_id,
      );

      const { data: publicBooks, error: publicBooksError } = await this.client
        .from('books')
        .select('*')
        .eq('is_public', true);

      if (publicBooksError) {
        console.error('Error fetching public books:', publicBooksError);
        return [];
      }

      let memberBooks: Book[] = [];
      if (memberBookIds.length > 0) {
        const { data: fetchedMemberBooks, error: memberBooksError } =
          await this.client.from('books').select('*').in('id', memberBookIds);

        if (memberBooksError) {
          console.error('Error fetching member books:', memberBooksError);
          return [];
        }

        memberBooks = fetchedMemberBooks ?? [];
      }

      // Merge and de-duplicate by id.
      const booksById = new Map<string, Book>();
      for (const book of [...memberBooks, ...(publicBooks ?? [])]) {
        booksById.set(book.id, book);
      }

      // Filter out demo book if user has hidden it
      const books = Array.from(booksById.values());
      if (hideDemoBook) {
        return books.filter((book) => !book.is_public);
      }

      return books;
    } catch (err) {
      console.error('Exception fetching books:', err);
      return [];
    }
  }

  async lookupUserByEmail(email: string): Promise<UserLookupResult | null> {
    const { data, error } = await this.client.rpc('lookup_user_by_email', {
      lookup_email: email,
    });

    if (error) {
      console.error('Error looking up user by email:', error);
      throw error;
    }

    if (!data || data.length === 0) return null;
    return data[0] as UserLookupResult;
  }

  async createBook(name: string, memberUserIds: string[] = []): Promise<Book> {
    const {
      data: { session },
    } = await this.client.auth.getSession();

    if (!session?.user) {
      throw new Error('Auth session invalid or expired. Please sign in again.');
    }

    const userId = session.user.id;

    // Create the book (INSERT + RETURNING requires both INSERT and SELECT policies)
    const { data: bookData, error: bookError } = await this.client
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

    // Build member rows: creator + any additional members (deduplicated)
    const uniqueMemberIds = new Set([userId, ...memberUserIds]);
    const memberRows = Array.from(uniqueMemberIds).map((uid) => ({
      book_id: bookData.id,
      user_id: uid,
    }));

    const { error: memberError } = await this.client
      .from('book_members')
      .insert(memberRows);

    if (memberError) {
      console.error('Error adding members to book:', memberError);
      throw memberError;
    }

    return bookData as Book;
  }

  async getVisitedCountryIso2s(bookId: string): Promise<string[]> {
    try {
      const { data, error } = await this.client
        .from('markers')
        .select('cities(countries(iso_code_2))')
        .eq('book_id', bookId)
        .eq('visited', true);

      if (error) {
        console.error('Error fetching visited countries:', error);
        return [];
      }

      const iso2s = new Set<string>();
      for (const marker of data ?? []) {
        const iso2 = (
          marker as {
            cities?: { countries?: { iso_code_2?: string } | null } | null;
          }
        )?.cities?.countries?.iso_code_2;
        if (iso2) {
          iso2s.add(iso2.toUpperCase());
        }
      }

      return Array.from(iso2s);
    } catch (err) {
      console.error('Exception fetching visited countries:', err);
      return [];
    }
  }

  async getCountryIsoLookup(): Promise<CountryIsoLookup> {
    try {
      const { data, error } = await this.client
        .from('countries')
        .select('name, iso_code_2, iso_code_3');

      if (error) {
        console.error('Error fetching country lookup:', error);
        return {
          byIso3: {},
          byIso2: {},
          byName: {},
        };
      }

      const byIso3: Record<string, string> = {};
      const byIso2: Record<string, string> = {};
      const byName: Record<string, string> = {};

      for (const row of (data ?? []) as Array<{
        name: string | null;
        iso_code_2: string | null;
        iso_code_3: string | null;
      }>) {
        const iso2 = row.iso_code_2?.trim().toUpperCase();
        if (!iso2 || !/^[A-Z]{2}$/.test(iso2)) continue;

        byIso2[iso2] = iso2;

        const iso3 = row.iso_code_3?.trim().toUpperCase();
        if (iso3 && /^[A-Z]{3}$/.test(iso3)) byIso3[iso3] = iso2;

        const name = row.name?.trim().toLowerCase();
        if (name) byName[name] = iso2;
      }

      return {
        byIso3,
        byIso2,
        byName,
      };
    } catch (err) {
      console.error('Exception fetching country lookup:', err);
      return {
        byIso3: {},
        byIso2: {},
        byName: {},
      };
    }
  }

  async getBookVisitedLandAreaStats(
    bookId: string,
  ): Promise<BookVisitedLandAreaStats> {
    try {
      const { data: markerRows, error: markersError } = await this.client
        .from('markers')
        .select('cities(country_id)')
        .eq('book_id', bookId)
        .eq('visited', true);

      if (markersError) {
        console.error(
          'Error fetching visited marker country ids:',
          markersError,
        );
        return { visitedArea: 0, totalArea: 0, visitedPercent: 0 };
      }

      const visitedCountryIds = new Set<string>();
      for (const marker of markerRows ?? []) {
        const countryId = (
          marker as { cities?: { country_id?: string | null } | null }
        )?.cities?.country_id;

        if (countryId) visitedCountryIds.add(countryId);
      }

      let visitedArea = 0;
      if (visitedCountryIds.size > 0) {
        const { data: visitedCountries, error: visitedCountriesError } =
          await this.client
            .from('countries')
            .select('area')
            .in('id', Array.from(visitedCountryIds));

        if (visitedCountriesError) {
          console.error(
            'Error fetching visited country areas:',
            visitedCountriesError,
          );
          return { visitedArea: 0, totalArea: 0, visitedPercent: 0 };
        }

        visitedArea = (visitedCountries ?? []).reduce((sum, row) => {
          const area = Number((row as { area?: number | string | null }).area);
          if (!Number.isFinite(area) || area <= 0) return sum;

          return sum + area;
        }, 0);
      }

      const { data: allCountries, error: allCountriesError } = await this.client
        .from('countries')
        .select('area');

      if (allCountriesError) {
        console.error('Error fetching total country area:', allCountriesError);
        return { visitedArea: 0, totalArea: 0, visitedPercent: 0 };
      }

      const totalArea = (allCountries ?? []).reduce((sum, row) => {
        const area = Number((row as { area?: number | string | null }).area);
        if (!Number.isFinite(area) || area <= 0) return sum;

        return sum + area;
      }, 0);

      if (totalArea <= 0)
        return { visitedArea, totalArea: 0, visitedPercent: 0 };

      const visitedPercent = (visitedArea / totalArea) * 100;
      return {
        visitedArea,
        totalArea,
        visitedPercent,
      };
    } catch (err) {
      console.error('Exception calculating visited land area stats:', err);
      return { visitedArea: 0, totalArea: 0, visitedPercent: 0 };
    }
  }
}
