import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private client: SupabaseClient;

  constructor(private config: ConfigService) {
    this.client = createClient(
      config.get('SUPABASE_URL'),
      config.get('SUPABASE_SERVICE_KEY'), // service key = bypass RLS for backend
    );
  }

  get db(): SupabaseClient {
    return this.client;
  }

  // Helper: insert and return
  async insert(table: string, data: any) {
    const { data: result, error } = await this.client
      .from(table)
      .insert(data)
      .select()
      .single();
    if (error) throw error;
    return result;
  }

  // Helper: update
  async update(table: string, id: string, data: any) {
    const { data: result, error } = await this.client
      .from(table)
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return result;
  }

  // Helper: find by id
  async findById(table: string, id: string) {
    const { data, error } = await this.client
      .from(table)
      .select('*')
      .eq('id', id)
      .single();
    if (error) return null;
    return data;
  }

  // Helper: find one by field
  async findOne(table: string, field: string, value: any) {
    const { data, error } = await this.client
      .from(table)
      .select('*')
      .eq(field, value)
      .single();
    if (error) return null;
    return data;
  }

  // Helper: find many
  async findMany(table: string, filters: Record<string, any> = {}, options: any = {}) {
    let query = this.client.from(table).select(options.select || '*');
    for (const [key, value] of Object.entries(filters)) {
      query = query.eq(key, value);
    }
    if (options.order) query = query.order(options.order, { ascending: options.ascending ?? false });
    if (options.limit) query = query.limit(options.limit);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  // Helper: delete
  async delete(table: string, id: string) {
    const { error } = await this.client.from(table).delete().eq('id', id);
    if (error) throw error;
    return true;
  }

  // Helper: count
  async count(table: string, filters: Record<string, any> = {}) {
    let query = this.client.from(table).select('*', { count: 'exact', head: true });
    for (const [key, value] of Object.entries(filters)) {
      query = query.eq(key, value);
    }
    const { count, error } = await query;
    if (error) return 0;
    return count || 0;
  }

  // Log admin action
  async logAdminAction(adminId: string, action: string, targetType: string, targetId: string, details: any, ip: string) {
    await this.insert('audit_logs', {
      admin_id: adminId,
      action,
      target_type: targetType,
      target_id: targetId,
      details,
      ip_address: ip,
    });
  }
}
