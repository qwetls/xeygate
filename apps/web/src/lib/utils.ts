import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

const compactFormatter = new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1
});

export function formatCompactNumber(num: number): string {
    if (typeof num !== "number" || Number.isNaN(num)) return "0";
    if (Math.abs(num) < 1000) return num.toLocaleString("en-US");
    return compactFormatter.format(num);
}

export function formatNumber(num: number): string {
    if (typeof num !== "number" || Number.isNaN(num)) return "0";
    return num.toLocaleString("en-US");
}

export function safeJsonParse<T>(json: string | null | undefined, fallback: T): T {
    if (!json) return fallback;
    try {
        return JSON.parse(json) as T;
    } catch {
        return fallback;
    }
}
