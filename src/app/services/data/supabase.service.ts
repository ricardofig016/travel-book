import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

import { environment } from '../../core/config/environment';

export interface SupabaseConnectionStatus {
  ok: boolean;
  error: string | null;
  countriesCount: number;
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
}
