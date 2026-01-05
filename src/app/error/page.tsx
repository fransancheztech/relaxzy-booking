"use client";

import { useEffect, useState } from "react";

export default function ErrorPage() {
    const [msg, setMsg] = useState("Unknown error");

    useEffect(() => {
        try {
            const params = new URLSearchParams(window.location.search);
            const m = params.get("msg");
            if (m) setMsg(m);
        } catch (e) {
            console.error(e)
        }
    }, []);

    return (
        <div className="w-full h-screen flex flex-col items-center justify-center">
            <h1 className="text-4xl">Oops... something went wrong:</h1>
            <h2 className="text-2xl">{msg}</h2>
        </div>
    );
}
