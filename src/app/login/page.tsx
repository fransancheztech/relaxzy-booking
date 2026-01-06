"use client";

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client'

export default function LoginPage() {

    const [message, setMessage] = useState("");

    // Client-side login handler using Supabase
    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setMessage("Logging in...");
        const formData = new FormData(e.currentTarget);
        const email = formData.get("email") as string;
        const password = formData.get("password") as string;
        const supabase = createClient();
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            setMessage(error.message);
        } else {
            window.location.href = "/";
        }
    };

    return (
        <main className="p-4">
            <div className="p-6 max-w-md mx-auto">
                <h2 className="text-xl font-semibold mb-4">
                    Login
                </h2>
                <form className="space-y-4" onSubmit={handleSubmit}>
                    <input
                        id="email"
                        name="email"
                        type="email"
                        placeholder="Email"
                        className="w-full p-2 border rounded"
                        required
                    />
                    <input
                        id="password"
                        name="password"
                        type="password"
                        placeholder="Password"
                        className="w-full p-2 border rounded"
                        required
                    />
                    <button
                        type="submit"
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded">
                        Log In
                    </button>
                </form>

                {message && <p className="mt-4 text-red-600">{message}</p>}
            </div>
        </main>
    );
}
