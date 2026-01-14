import { createCustomServerClient } from "@/utils/supabase/server"; // para el usuario actual
import { createAdminClient } from "@/utils/supabase/admin"; // para funciones admin
import { NextResponse } from "next/server";

export async function GET() {
  // 1. Obtener el usuario actual (desde cookies, no service_role)
  const supabase = await createCustomServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.user_metadata?.role !== "supabase_admin") {
    console.log("Unauthorized user:", user?.email ?? "No user");
    return NextResponse.json({ error: "Unauthorized manual" }, { status: 401 });
  }

  // 2. Usar el client de administrador para listar usuarios
  const adminClient = createAdminClient();
  try {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (error) {
      console.error("Admin API Error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ users: data.users });
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error("Unexpected error:", err.message);
    } else {
      console.error("Unexpected error:", err);
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
