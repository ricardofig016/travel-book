import { Injectable } from '@angular/core';
import { SupabaseClient, User } from '@supabase/supabase-js';

import {
  CitySearchResult,
  SupabaseConnectionStatus,
  UserProfile,
} from './models';

interface CitySearchRow {
  id: string;
  name: string;
  countries?: unknown;
}

@Injectable({ providedIn: 'root' })
export class SupabaseAuthService {
  async signIn(
    client: SupabaseClient,
    email: string,
    password: string,
  ): Promise<User> {
    const { data, error } = await client.auth.signInWithPassword({
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
    client: SupabaseClient,
    name: string,
    email: string,
    password: string,
    homeCityId: string,
  ): Promise<User> {
    const { data, error } = await client.auth.signUp({
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

    if (!data.user) throw new Error('Sign up failed: no user returned');

    try {
      const { error: profileError } = await client
        .from('user_profiles')
        .upsert({
          user_id: data.user.id,
          home_city_id: homeCityId,
          hide_demo_book: false,
        });

      if (profileError)
        console.warn('Profile write deferred to DB trigger:', profileError);
    } catch (err) {
      console.warn('Profile write skipped (handled by DB trigger):', err);
    }

    return data.user;
  }

  async signOut(client: SupabaseClient): Promise<void> {
    const { error } = await client.auth.signOut();

    if (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  }

  async searchCities(
    client: SupabaseClient,
    term: string,
  ): Promise<CitySearchResult[]> {
    if (term.length < 2) return [];

    try {
      const { data, error } = await client
        .from('cities')
        .select('id, name, name_ascii, countries(name)')
        .or(`name.ilike.%${term}%,name_ascii.ilike.%${term}%`)
        .limit(10);

      if (error) {
        console.error('Error searching cities:', error);
        return [];
      }

      const rows = (data ?? []) as CitySearchRow[];
      return rows.map((city) => ({
        id: city.id,
        name: city.name,
        country: this.resolveCountryName(city.countries),
      }));
    } catch (err) {
      console.error('Exception searching cities:', err);
      return [];
    }
  }

  async checkConnection(
    client: SupabaseClient,
  ): Promise<SupabaseConnectionStatus> {
    try {
      const { count, error } = await client
        .from('countries')
        .select('id', { count: 'exact', head: true });

      if (error) console.error('Supabase error:', error);

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

  async getUserProfile(client: SupabaseClient): Promise<UserProfile | null> {
    try {
      const {
        data: { user },
      } = await client.auth.getUser();

      if (!user) return null;

      const { data, error } = await client
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('Error fetching user profile:', error);
        return null;
      }

      return (data as UserProfile | null) ?? null;
    } catch (err) {
      console.error('Exception fetching user profile:', err);
      return null;
    }
  }

  async setHideDemoBook(
    client: SupabaseClient,
    hide: boolean,
  ): Promise<boolean> {
    try {
      const {
        data: { user },
      } = await client.auth.getUser();

      if (!user) {
        console.error('User not authenticated');
        return false;
      }

      const { error } = await client
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

  private resolveCountryName(countriesRelation: unknown): string {
    if (countriesRelation && typeof countriesRelation === 'object') {
      if (Array.isArray(countriesRelation)) {
        const first = countriesRelation[0] as { name?: string } | undefined;
        return first?.name ?? 'Unknown';
      }

      const single = countriesRelation as { name?: string };
      return single.name ?? 'Unknown';
    }

    return 'Unknown';
  }
}
