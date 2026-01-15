import { NextResponse } from "next/server";
import { createCustomServerClient } from "@/utils/supabase/server"; // para el usuario actual
import { createAdminClient } from "@/utils/supabase/admin"; // para funciones admin

export async function POST(req: Request) {
  const supabase = await createCustomServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.user_metadata?.role !== "supabase_admin") {
    console.log("Unauthorized user:", user?.email ?? "No user");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { user_id, full_name, phone } = body;

  if (!user_id || !full_name || !phone) {
    return NextResponse.json({ error: "Faltan datos obligatorios" }, { status: 400 });
  }

  const adminClient = createAdminClient();
  const { data: userData, error: userError } = await adminClient.auth.admin.getUserById(user_id);

  if (userError || !userData?.user?.email) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  const email = userData.user.email;

  // Soft-delete awareness: check if therapist already exists but is deleted
  const { data: existing } = await supabase
    .from("therapists")
    .select("*")
    .eq("id", user_id)
    .is("deleted_at", null)
    .single();

  if (existing) {
    return NextResponse.json({ error: "Therapist already exists" }, { status: 400 });
  }

  // Insert into therapists table
  const { error: insertError } = await supabase
    .from("therapists")
    .insert({ id: user_id, full_name, phone, email, deleted_at: null });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
