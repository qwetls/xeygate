import { useEffect, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";

export interface LegalSection {
    heading: string;
    body: ReactNode;
}

const CROSS_LINKS: Array<{ to: string; label: string }> = [
    { to: "/terms", label: "Terms of Service" },
    { to: "/privacy", label: "Privacy Policy" },
    { to: "/acceptable-use", label: "Acceptable Use" },
    { to: "/refund", label: "Refund Policy" }
];

export function LegalShell(props: {
    title: string;
    eyebrow: string;
    updated: string;
    intro: ReactNode;
    sections: LegalSection[];
}) {
    useEffect(() => {
        const previous = document.title;
        document.title = `${props.title} · XEYGATE`;
        return () => {
            document.title = previous;
        };
    }, [props.title]);

    return (
        <div className="min-h-svh bg-background font-mono">
            <header className="border-b border-border/60 bg-secondary/20">
                <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
                    <Link to="/" className="flex items-center gap-2">
                        <div className="flex size-6 items-center justify-center rounded-md border border-border/80 bg-secondary">
                            <svg viewBox="0 0 24 24" fill="none" className="size-3.5">
                                <path
                                    d="M13 2.5L5 13H11.5L9.5 21.5L18.5 10H12L13.5 2.5Z"
                                    fill="currentColor"
                                    fillOpacity="0.92"
                                />
                            </svg>
                        </div>
                        <span className="text-sm font-bold tracking-tight">XEYGATE</span>
                    </Link>
                    <Link
                        to="/"
                        className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:text-foreground"
                    >
                        ← Home
                    </Link>
                </div>
            </header>

            <main className="mx-auto max-w-3xl px-4 py-10">
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground">
                    {props.eyebrow}
                </p>
                <h1 className="mt-2 text-2xl font-bold tracking-tight">{props.title}</h1>
                <p className="mt-1 text-[11px] text-muted-foreground">
                    Last updated: {props.updated}
                </p>
                <div className="mt-5 rounded-lg border border-border/60 bg-secondary/30 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
                    {props.intro}
                </div>

                <div className="mt-8 space-y-8">
                    {props.sections.map((section) => (
                        <section key={section.heading}>
                            <h2 className="text-sm font-bold uppercase tracking-[0.14em]">
                                {section.heading}
                            </h2>
                            <div className="mt-2.5 space-y-2.5 text-xs leading-relaxed text-muted-foreground">
                                {section.body}
                            </div>
                        </section>
                    ))}
                </div>

                <nav className="mt-12 flex flex-wrap gap-x-5 gap-y-2 border-t border-border/60 pt-5 text-[11px]">
                    {CROSS_LINKS.map((link) => (
                        <Link
                            key={link.to}
                            to={link.to}
                            className="text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
                        >
                            {link.label}
                        </Link>
                    ))}
                </nav>
            </main>

            <footer className="border-t border-border/60 bg-secondary/20">
                <div className="mx-auto max-w-3xl px-4 py-5 text-[11px] text-muted-foreground">
                    © {new Date().getFullYear()} XeyCompany · XEYGATE — operated as a service of
                    XeyCompany. These pages are provided for transparency and do not constitute
                    legal advice.
                </div>
            </footer>
        </div>
    );
}

export function P(props: { children: ReactNode }) {
    return <p>{props.children}</p>;
}

export function Ul(items: ReactNode[]) {
    return (
        <ul className="list-disc space-y-1.5 pl-5">
            {items.map((item, i) => (
                <li key={i}>{item}</li>
            ))}
        </ul>
    );
}

export function Strong({ children }: { children: ReactNode }) {
    return <strong className="font-semibold text-foreground">{children}</strong>;
}
