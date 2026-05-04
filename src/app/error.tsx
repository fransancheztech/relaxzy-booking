"use client";

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

export default function ErrorPage() {
    const t = useTranslations('Errors');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    useEffect(() => {
        // dynamically import js-cookie on the client only to avoid server-side build errors
                import('js-cookie')
                    .then((mod) => {
                        // avoid using `any` to satisfy eslint; use unknown and a narrow shape
                        const cookieModule = mod as unknown as {
                            default?: { get: (k: string) => string | undefined; remove: (k: string) => void };
                            get?: (k: string) => string | undefined;
                            remove?: (k: string) => void;
                        };
                        const c = (cookieModule.default ?? { get: cookieModule.get, remove: cookieModule.remove }) as {
                            get: (k: string) => string | undefined;
                            remove: (k: string) => void;
                        };
                        const msg = c.get('errorSignUp') ?? null;
                        c.remove('errorSignUp');
                        setErrorMsg(msg);
                    })
            .catch(() => {
                // ignore — show fallback
            });
    }, []);

    return (
        <div className="w-full h-screen flex flex-col items-center justify-center">
            <h1 className="text-4xl">{t('oops')}</h1>
            <h2 className="text-2xl">{errorMsg ?? t('unknownError')}</h2>
        </div>
    );
}
