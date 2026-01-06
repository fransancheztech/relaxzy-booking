"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import "react-datepicker/dist/react-datepicker.css";

export default function Home() {
    const supabase = createClient();
    const [message, setMessage] = useState("Connecting...");

    useEffect(() => {
        const test = async () => {
            const { error } = await supabase
                .schema('public')
                .from("bookings")
                .select("*");
            if (error) {
                setMessage(`Error: ${error.code}`);
            } else {
                setMessage(`Success! Logged in.`);
            }
        };

        test();
    }, [supabase]);

    return (
        <div className="flex flex-col justify-center items-center w-full h-screen">
            <div className="p-4 text-xl">{message}</div>
        </div>
    );
}
