import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { BadgeCheck, Clock, Coins, Flame, Mail, ShieldCheck, UserRound } from "lucide-react";

export const Route = createFileRoute("/_client/dashboard/profile")({
    staticData: { title: "Profile" },
    component: ProfilePage
});

interface UserInfo {
    id: string;
    email: string;
    name: string;
    credits: number;
    role: "buyer" | "creator";
    status: "active" | "pending" | "banned";
    creatorStatus: "none" | "pending" | "approved" | "rejected";
    isAdmin: boolean;
    createdAt: number;
    loginStreak: number;
}

function initials(name: string, email: string): string {
    const source = name.trim() || email;
    const parts = source.split(/[\s_.@-]+/).filter(Boolean);
    return (parts[0]?.[0] ?? "?").toUpperCase() + (parts[1]?.[0] ?? "").toUpperCase();
}

function streakEarned(streak: number): number {
    const capped = Math.min(streak, 7);
    return Math.min(capped, 6) * 8 + (capped === 7 ? 10 : 0);
}

function ProfilePage() {
    const queryClient = useQueryClient();
    const { data: user } = useQuery({
        queryKey: ["user-auth-status"],
        queryFn: () => api.get<UserInfo>("/v1/users/me")
    });

    const [name, setName] = useState<string | null>(null);
    const displayName = name ?? user?.name ?? "";
    const dirty = user !== undefined && displayName.trim() !== user.name;

    const saveMutation = useMutation({
        mutationFn: () => api.patch<UserInfo>("/v1/users/me", { name: displayName.trim() }),
        onSuccess: () => {
            setName(null);
            queryClient.invalidateQueries({ queryKey: ["user-auth-status"] });
            toast.success("Profile updated");
        },
        onError: (err: Error) => {
            toast.error(err instanceof ApiError ? err.message : "Failed to update profile");
        }
    });

    function handleSubmit(e: FormEvent) {
        e.preventDefault();
        if (!dirty) return;
        saveMutation.mutate();
    }

    const streak = user?.loginStreak ?? 0;
    const memberSince = user?.createdAt ? new Date(user.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) : "—";

    return (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 font-mono">
            <header className="border-b border-border/80 pb-5">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">Profile</h1>
                <p className="mt-1 text-xs text-muted-foreground">
                    Your identity across XEYGATE — how admins see you and where your rewards land.
                </p>
            </header>

            <Card>
                <CardContent className="pt-6">
                    <div className="flex flex-col sm:flex-row gap-5 sm:items-center">
                        <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl border border-border/80 bg-linear-to-b from-secondary/90 via-secondary/50 to-background text-xl font-bold text-foreground shadow-2xs">
                            {user ? initials(user.name, user.email) : <UserRound className="size-7" />}
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-lg font-bold text-foreground truncate">
                                    {user?.name || user?.email || "…"}
                                </span>
                                {user?.role === "creator" && (
                                    <span className="inline-flex items-center gap-1 rounded-md border border-border/80 bg-secondary/50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-foreground">
                                        Creator
                                    </span>
                                )}
                                {user?.isAdmin && (
                                    <span className="inline-flex items-center gap-1 rounded-md border border-violet-500/30 bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-violet-500">
                                        <ShieldCheck className="size-3" strokeWidth={1.75} />
                                        Admin
                                    </span>
                                )}
                            </div>
                            <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Mail className="size-3.5" strokeWidth={1.75} />
                                {user?.email ?? "…"}
                            </div>
                        </div>
                        <div className="shrink-0 rounded-xl border border-border/80 bg-card/60 px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                                <Coins className="size-3.5" strokeWidth={1.75} />
                                Wallet
                            </div>
                            <div className="mt-1 text-xl font-bold text-foreground">
                                ${(user?.credits ?? 0).toFixed(4)}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-sm">Display name</CardTitle>
                    <CardDescription>
                        Shown on the dashboard and in admin user lists. Your email is fixed — contact an
                        admin to move an account.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form className="flex flex-col sm:flex-row gap-3" onSubmit={handleSubmit}>
                        <label className="flex flex-1 flex-col gap-1.5 text-xs font-medium">
                            Name
                            <Input
                                value={displayName}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Your display name"
                                maxLength={64}
                                disabled={!user}
                            />
                        </label>
                        <Button
                            type="submit"
                            className="self-end sm:self-auto h-9 text-xs shrink-0"
                            disabled={!dirty || saveMutation.isPending}
                        >
                            {saveMutation.isPending ? "Saving..." : "Save"}
                        </Button>
                    </form>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Flame className="size-4 text-muted-foreground" strokeWidth={1.75} />
                        <CardTitle className="text-sm">Daily login streak</CardTitle>
                    </div>
                    <CardDescription>
                        +$8 on days 1–6, +$10 on day 7. Sign in every day — skipping resets the cycle.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-foreground">
                            {streak === 0
                                ? "No active streak — log in tomorrow to start day 1"
                                : streak >= 7
                                  ? "Cycle complete — day 7 bonus claimed"
                                  : `Day ${streak} of 7`}
                        </span>
                        <span className="text-muted-foreground">${streakEarned(streak)} earned this cycle</span>
                    </div>
                    <div className="flex gap-1.5" aria-hidden>
                        {Array.from({ length: 7 }, (_, i) => {
                            const day = i + 1;
                            const done = streak >= day;
                            return (
                                <div
                                    key={day}
                                    className={`h-2 flex-1 rounded-full border ${
                                        done
                                            ? day === 7
                                                ? "border-emerald-500/50 bg-emerald-500/70"
                                                : "border-border/80 bg-foreground/80"
                                            : "border-border/60 bg-secondary/40"
                                    }`}
                                />
                            );
                        })}
                    </div>
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                        <Clock className="size-3" strokeWidth={1.75} />
                        {streak >= 7
                            ? "Next sign-in starts a fresh cycle at day 1."
                            : `Next reward: +$${streak === 6 ? 10 : 8} on your next sign-in day.`}
                    </p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-sm">Account details</CardTitle>
                </CardHeader>
                <CardContent>
                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-xs">
                        <div className="flex items-center justify-between border-b border-border/50 pb-2">
                            <dt className="text-muted-foreground">Account ID</dt>
                            <dd className="font-semibold text-foreground truncate ml-3">{user?.id ?? "…"}</dd>
                        </div>
                        <div className="flex items-center justify-between border-b border-border/50 pb-2">
                            <dt className="text-muted-foreground">Member since</dt>
                            <dd className="font-semibold text-foreground">{memberSince}</dd>
                        </div>
                        <div className="flex items-center justify-between border-b border-border/50 pb-2">
                            <dt className="text-muted-foreground">Status</dt>
                            <dd className="font-semibold text-foreground capitalize">{user?.status ?? "…"}</dd>
                        </div>
                        <div className="flex items-center justify-between border-b border-border/50 pb-2">
                            <dt className="text-muted-foreground">Creator access</dt>
                            <dd className="font-semibold text-foreground capitalize">
                                {user?.role === "creator" && user?.creatorStatus === "approved" ? (
                                    <span className="inline-flex items-center gap-1 text-emerald-600">
                                        <BadgeCheck className="size-3.5" strokeWidth={1.75} /> Approved
                                    </span>
                                ) : (
                                    user?.creatorStatus ?? "none"
                                )}
                            </dd>
                        </div>
                    </dl>
                </CardContent>
            </Card>
        </div>
    );
}
