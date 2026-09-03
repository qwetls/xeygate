interface SettingsSectionProps {
    id?: string;
    icon?: React.ComponentType<{ className?: string }>;
    tag?: string;
    title: string;
    description?: string;
    badge?: React.ReactNode;
    children: React.ReactNode;
}

export function SettingsSection({
    id,
    icon: Icon,
    tag,
    title,
    description,
    badge,
    children
}: SettingsSectionProps) {
    return (
        <section
            id={id}
            className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-2xs transition-all scroll-mt-20"
        >
            <div className="flex items-start justify-between gap-4 border-b border-border/60 pb-4 mb-2">
                <div className="flex items-start gap-3.5">
                    {Icon && (
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-secondary/50 text-foreground shadow-2xs mt-0.5">
                            <Icon className="size-4" />
                        </div>
                    )}
                    <div>
                        <div className="flex items-center gap-2.5 flex-wrap">
                            <h2 className="text-sm font-bold tracking-tight text-foreground">
                                {title}
                            </h2>
                            {tag && (
                                <span className="rounded-md border border-border/70 bg-secondary/40 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">
                                    {tag}
                                </span>
                            )}
                        </div>
                        {description && (
                            <p className="mt-1 text-xs leading-relaxed text-muted-foreground max-w-2xl">
                                {description}
                            </p>
                        )}
                    </div>
                </div>
                {badge && <div className="shrink-0">{badge}</div>}
            </div>
            <div className="divide-y divide-border/50">{children}</div>
        </section>
    );
}

export function SettingsRow({
    title,
    description,
    control,
    className
}: {
    title: string;
    description?: string;
    control?: React.ReactNode;
    className?: string;
}) {
    return (
        <div
            className={[
                "flex flex-col gap-2 py-3.5 sm:flex-row sm:items-center sm:justify-between",
                className ?? ""
            ].join(" ")}
        >
            <div className="min-w-0 pr-4">
                <div className="text-xs font-semibold text-foreground leading-tight">{title}</div>
                {description && (
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                        {description}
                    </p>
                )}
            </div>
            {control && <div className="shrink-0">{control}</div>}
        </div>
    );
}

export function SegmentedControl<T extends string | number | boolean>({
    options,
    value,
    onChange,
    disabled,
    className
}: {
    options: Array<{ value: T; label: string }>;
    value: T;
    onChange: (value: T) => void;
    disabled?: boolean;
    className?: string;
}) {
    return (
        <div
            role="tablist"
            className={[
                "inline-flex items-center gap-1 rounded-md border border-border/70 bg-secondary/30 p-0.5",
                className ?? ""
            ].join(" ")}
        >
            {options.map((option) => {
                const isActive = option.value === value;
                return (
                    <button
                        key={String(option.value)}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        disabled={disabled}
                        onClick={() => onChange(option.value)}
                        className={[
                            "rounded px-2.5 py-1 text-[11px] font-medium transition-all",
                            "disabled:pointer-events-none disabled:opacity-50",
                            isActive
                                ? "bg-foreground text-background font-semibold"
                                : "text-muted-foreground hover:text-foreground"
                        ].join(" ")}
                    >
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
}

export function ValueBadge({ children }: { children: React.ReactNode }) {
    return (
        <span className="inline-flex items-center rounded-md border border-border/70 bg-background px-2 py-0.5 font-mono text-[11px] font-bold tabular-nums text-foreground">
            {children}
        </span>
    );
}
