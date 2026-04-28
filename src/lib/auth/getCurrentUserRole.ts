import { createCustomServerClient } from "@/utils/supabase/server";

export async function getCurrentUserRole(): Promise<string | null> {
  const supabase = await createCustomServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return (user?.app_metadata?.role as string) ?? null;
}