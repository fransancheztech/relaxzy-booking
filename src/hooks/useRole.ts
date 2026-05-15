"use client";

import { createClient } from "@/utils/supabase/client";
import { useEffect, useState } from "react";

export type UserRole = "admin" | "therapist" | null;

const supabase = createClient();

export function useRole() {
  const [role, setRole] = useState<UserRole>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setRole((data.user?.app_metadata?.role as UserRole) ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setRole((session?.user?.app_metadata?.role as UserRole) ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  return {
    role,
    isAdmin: role === "admin",
    isTherapist: role === "therapist",
  };
}
