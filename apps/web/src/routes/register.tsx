import { useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Zap } from "lucide-react";

export const Route = createFileRoute("/register")({
    component: RegisterPage
});

function RegisterPage() {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);

    const registerMutation = useMutation({
        mutationFn: () => api.post<{ id: string }>("/v1/users/register", { email, password, name }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["user-auth-status"] });
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
                        <Button type="submit" disabled={registerMutation.isPending} className="w-full">
                            {registerMutation.isPending ? "Creating account..." : "Create account"}
                        </Button>
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
