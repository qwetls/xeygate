import { useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { GitHubSignIn } from "@/components/auth/GitHubSignIn";
import { Input } from "@/components/ui/input";
import { Clock, Zap } from "lucide-react";

export const Route = createFileRoute("/register")({
    component: RegisterPage
});

interface RegisterResponse {
    id?: string;
    status?: string;
    requiresApproval?: boolean;
    message?: string;
}

function RegisterPage() {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [agreed, setAgreed] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pendingApproval, setPendingApproval] = useState(false);

    const registerMutation = useMutation({
        mutationFn: () =>
            api.post<RegisterResponse>("/v1/users/register", {
                email,
                password,
                name,
                accepted_terms: agreed
            }),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ["user-auth-status"] });
            if (data?.requiresApproval) {
                setPendingApproval(true);
                return;
            }
            navigate({ to: "/onboarding" });
        },
        onError: (err: Error) => {
            setError(err instanceof ApiError ? err.message : "Registration failed");
        }
    });

    function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setError(null);
        registerMutation.mutate();
    }

    if (pendingApproval) {
        return (
            <main className="flex min-h-svh items-center justify-center bg-background px-4 py-8">
                <Card className="w-full max-w-md text-center">
                    <CardHeader>
                        <div className="flex justify-center mb-2">
                            <div className="flex size-10 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10">
                                <Clock className="size-5 text-amber-500" strokeWidth={2} />
                            </div>
                        </div>
                        <CardTitle>Account created — pending approval</CardTitle>
                        <CardDescription>
                            An admin must approve your registration before you can sign in. You&apos;ll
                            be able to log in once your account is activated.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                        <Link
                            to="/login"
                            className="inline-flex items-center justify-center rounded-md bg-foreground text-background px-4 py-2 text-xs font-medium hover:bg-foreground/90 transition-colors"
                        >
                            Back to sign in
                        </Link>
                    </CardContent>
                </Card>
            </main>
        );
    }

    return (
        <main className="flex min-h-svh items-center justify-center bg-background px-4 py-8">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <div className="flex justify-center mb-2">
                        <div className="flex size-10 items-center justify-center rounded-xl border border-border/80 bg-secondary/50">
                            <Zap className="size-5" strokeWidth={2} />
                        </div>
                    </div>
                    <CardTitle>Create your account</CardTitle>
                    <CardDescription>Get API keys and start using the XEYGATE gateway</CardDescription>
                </CardHeader>
                <CardContent>
                    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
                        <label className="flex flex-col gap-1.5 text-xs font-medium">
                            Name
                            <Input type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoFocus />
                        </label>
                        <label className="flex flex-col gap-1.5 text-xs font-medium">
                            Email
                            <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
                        </label>
                        <label className="flex flex-col gap-1.5 text-xs font-medium">
                            Password
                            <Input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 8 characters" required minLength={8} />
                        </label>
                        {error && (
                            <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">{error}</p>
                        )}
                        <div className="flex items-start gap-2.5">
                            <Checkbox
                                id="terms-consent"
                                checked={agreed}
                                onCheckedChange={(c) => setAgreed(Boolean(c))}
                                className="mt-px"
                            />
                            <label htmlFor="terms-consent" className="cursor-pointer select-none text-[11px] leading-relaxed text-muted-foreground">
                                I have read and agree to the{" "}
                                <Link to="/terms" target="_blank" rel="noreferrer" className="text-foreground underline underline-offset-2 hover:text-foreground/80">Terms of Service</Link>{" "}
                                and{" "}
                                <Link to="/privacy" target="_blank" rel="noreferrer" className="text-foreground underline underline-offset-2 hover:text-foreground/80">Privacy Policy</Link>.
                            </label>
                        </div>
                        <Button type="submit" disabled={registerMutation.isPending || !agreed} className="w-full">
                            {registerMutation.isPending ? "Creating account..." : "Create account"}
                        </Button>
                        <GitHubSignIn disabled={!agreed} />
                        <p className="text-center text-xs text-muted-foreground">
                            Already have an account?{" "}
                            <Link to="/login" className="text-foreground underline underline-offset-2 hover:text-foreground/80">Sign in</Link>
                        </p>
                    </form>
                </CardContent>
            </Card>
        </main>
    );
}
