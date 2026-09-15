import { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { Cookie, X } from "lucide-react";

const STORAGE_KEY = "xeygate_cookie_consent";

export function CookieConsentBanner() {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        try {
            if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
        } catch {
            setVisible(true);
        }
    }, []);

    const accept = () => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ accepted: true, ts: Date.now() }));
        } catch { /* ignore */ }
        setVisible(false);
    };

    if (!visible) return null;

    return (
        <div className="fixed bottom-0 inset-x-0 z-50 border-t border-border/60 bg-background/95 backdrop-blur-md px-4 py-4 sm:py-3">
            <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                    <Cookie className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground leading-relaxed">
                        We use strictly necessary cookies to keep you signed in and secure your session.
                        We do not use advertising trackers or cross-site profiling.
                        See our{" "}
                        <Link to="/cookies" className="underline hover:text-foreground transition-colors">
                            Cookie Policy
                        </Link>{" "}
                        for details.
                    </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <button
                        onClick={accept}
                        className="rounded-md bg-[var(--ink)] text-[var(--canvas)] px-4 py-1.5 text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer"
                    >
                        Accept
                    </button>
                    <button
                        onClick={() => setVisible(false)}
                        className="rounded-md border border-border/60 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        aria-label="Dismiss"
                    >
                        <X className="size-3" />
                    </button>
                </div>
            </div>
        </div>
    );
}
