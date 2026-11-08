import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * «Відкрити як клієнт» (designer → owner-view route) adds ?preview=1 so the
 * photographer's own look at the gallery is not counted as a client's view
 * and does not send «вперше переглянули». The parameter alone proves
 * nothing — anyone can type it — so it counts only when the signed-in user
 * owns this gallery (owner_id = user.id). Everyone else: ignored, the view is
 * recorded as usual. Any failure → false (count the view).
 */
export async function isOwnerPreview(
  preview: string | undefined,
  galleryId: string,
  supabase: Pick<SupabaseClient, 'auth' | 'from'>
): Promise<boolean> {
  if (preview !== '1') return false
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return false
    const { data, error } = await supabase
      .from('galleries')
      .select('id')
      .eq('id', galleryId)
      .eq('owner_id', user.id)
      .maybeSingle<{ id: string }>()
    return !error && data?.id === galleryId
  } catch {
    return false
  }
}
