import type { MarketplaceHealthBucket, MarketplaceHealthEntry } from "@srouter/types";

/**
 * Marketplace uptime stripe — 28 vertical bars (7d × 6h buckets) showing the
 * 7-day health of one model. Same visual grammar as GitHub contribution
 * graphs: green = all traffic succeeded, amber = some failures, red = mostly
 * failures, gray = no traffic. Zero-traffic buckets stay gray, never red:
 * silence is "no signal", not an outage.
 *
 * The bars are categorical colour blocks, so each fills the strip height; the
 * `title` tooltips carry the raw counts that back the colour.
 */
function bucketTone(bucket: { requests: number; errors: number }): string {
    if (bucket.requests === 0) return "bg-muted-foreground/25";
    const failureRatio = bucket.errors / bucket.requests;
    if (failureRatio === 0) return "bg-emerald-500";
    if (failureRatio < 0.5) return "bg-amber-400";
    return "bg-destructive";
}

const EMPTY_SERIES: MarketplaceHealthBucket[] = Array.from(
    { length: 28 },
    () => ({ ts: 0, requests: 0, errors: 0 })
);

interface Props {
    health: MarketplaceHealthEntry | null | undefined;
    /** Compact = bars only, no percentage label (marketplace cards). */
    compact?: boolean;
}

export function UptimeStrip({ health, compact = false }: Props) {
    const series = health?.series ?? EMPTY_SERIES;
    const successRate = health ? health.successRate : null;
    const label = health
        ? `${health.model}: ${health.requests - health.errors}/${health.requests} requests succeeded in 7d (${(
              health.successRate * 100
          ).toFixed(1)}%)`
        : "No traffic in the last 7 days";

    return (
        <div className="flex items-center gap-2" role="img" aria-label={label} title={label}>
            <div className={`flex items-stretch gap-px ${compact ? "h-4" : "h-6"}`} aria-hidden="true">
                {series.map((bucket, i) => (
                    <div
                        key={i}
                        className={`w-1 rounded-[1px] ${bucketTone(bucket)}`}
                        title={
                            bucket.requests === 0
                                ? "no traffic"
                                : `${bucket.requests - bucket.errors}/${bucket.requests} ok`
                        }
                    />
                ))}
            </div>
            {!compact ? (
                <span className="text-[11px] tabular-nums text-muted-foreground">
                    {successRate === null ? "No data" : `${(successRate * 100).toFixed(1)}% · 7d`}
                </span>
            ) : null}
        </div>
    );
}
