"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createCustomServerClient } from "@/utils/supabase/server";

export async function login(formData: FormData) {
    const supabase = await createCustomServerClient();

    // type-casting here for convenience
    // in practice, you should validate your inputs
    const data = {
        email: formData.get("email") as string,
        password: formData.get("password") as string,
    };

    const { error } = await supabase.auth.signInWithPassword(data);

    if (error) {
        redirect(`/error?msg=${encodeURIComponent(error.message)}`);
    }

    revalidatePath("/");
    redirect("/");
}

export async function signup(formData: FormData) {
    const supabase = await createCustomServerClient();

    // type-casting here for convenience
    // in practice, you should validate your inputs
    const data = {
        email: formData.get("email") as string,
        password: formData.get("password") as string,
        options: {
            data: {
                role: "client",
            },
        },
    };

    const response = await supabase.auth.signUp(data);
    console.log(response);

    if (response.error) {
        redirect(`/error?msg=${encodeURIComponent(response.error.message)}`);
    }

    revalidatePath("/", "layout");
    redirect("/");
}
