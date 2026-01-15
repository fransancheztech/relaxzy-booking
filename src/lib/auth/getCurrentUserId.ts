import { createCustomServerClient } from "@/utils/supabase/server";

export async function getCurrentUserId(): Promise<string> {
  const supabase = await createCustomServerClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("Unauthorized: no authenticated user");
  }

  return user.id;
}
