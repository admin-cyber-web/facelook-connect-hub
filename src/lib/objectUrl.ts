/**
 * Revoke only temporary Blob URLs.
 *
 * Components also use remote Supabase URLs in the same preview state, so
 * cleanup must never call URL.revokeObjectURL on a normal https URL.
 */
export function revokeObjectUrl(url: string | null | undefined): void {
  if (url?.startsWith("blob:")) {
    URL.revokeObjectURL(url);
  }
}