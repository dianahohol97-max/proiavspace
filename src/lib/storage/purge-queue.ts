import type { SupabaseClient } from '@supabase/supabase-js'
import { isMissingTableError, type PurgeQueue, type PurgeRow } from './purge'

const TABLE = 'storage_purge_queue'

/** public.storage_purge_queue through the service-role client. */
export function supabasePurgeQueue(admin: SupabaseClient, now: () => Date = () => new Date()): PurgeQueue {
  return {
    async fetchPending(limit, maxAttempts) {
      const { data, error } = await admin
        .from(TABLE)
        .select('id, key, kind, owner_id, attempts')
        .is('purged_at', null)
        .lt('attempts', maxAttempts)
        .order('enqueued_at', { ascending: true })
        .order('id', { ascending: true })
        .limit(limit)
      if (error) {
        if (isMissingTableError(error)) return { missingTable: true }
        throw new Error(`storage_purge_queue read failed: ${error.message}`)
      }
      return { rows: (data ?? []) as PurgeRow[] }
    },
    async countStuck(maxAttempts) {
      const { count, error } = await admin
        .from(TABLE)
        .select('id', { count: 'exact', head: true })
        .is('purged_at', null)
        .gte('attempts', maxAttempts)
      if (error) throw new Error(`storage_purge_queue count failed: ${error.message}`)
      return count ?? 0
    },
    async markPurged(id) {
      const { error } = await admin
        .from(TABLE)
        .update({ purged_at: now().toISOString(), last_error: null })
        .eq('id', id)
      if (error) throw new Error(`storage_purge_queue update failed: ${error.message}`)
    },
    async markFailed(id, attempts, message) {
      const { error } = await admin.from(TABLE).update({ attempts, last_error: message }).eq('id', id)
      if (error) throw new Error(`storage_purge_queue update failed: ${error.message}`)
    },
  }
}
