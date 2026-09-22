import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bell, Send, X } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from "@/components/ui/dialog";
import type { NotificationType } from "@srouter/types";

interface ComposeNotificationDialogProps {
    open: boolean;
    onClose: () => void;
}

const NOTIFICATION_TYPES: { value: NotificationType; label: string; color: string }[] = [
    { value: "announcement", label: "Announcement", color: "bg-blue-500" },
    { value: "maintenance", label: "Maintenance", color: "bg-amber-500" },
    { value: "model_disable", label: "Model Disable", color: "bg-red-500" },
    { value: "update", label: "Update", color: "bg-emerald-500" },
    { value: "alert", label: "Alert", color: "bg-orange-500" },
    { value: "info", label: "Info", color: "bg-gray-500" }
];

const TARGETS = [
    { value: "all", label: "All Users" },
    { value: "admin", label: "Admins Only" },
    { value: "creator", label: "Creators Only" },
    { value: "buyer", label: "Buyers Only" }
] as const;

export function ComposeNotificationDialog({ open, onClose }: ComposeNotificationDialogProps) {
    const queryClient = useQueryClient();
    const [title, setTitle] = useState("");
    const [message, setMessage] = useState("");
    const [type, setType] = useState<NotificationType>("info");
    const [target, setTarget] = useState<"all" | "admin" | "creator" | "buyer">("all");

    const sendMutation = useMutation({
        mutationFn: (payload: {
            title: string;
            message: string;
            type: NotificationType;
            target: string;
        }) => api.post("/v1/notifications", payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["notifications"] });
            toast.success("Notification sent successfully");
            setTitle("");
            setMessage("");
            setType("info");
            setTarget("all");
            onClose();
        },
        onError: (err) => {
            toast.error("Failed to send notification", {
                description: err instanceof Error ? err.message : "Unknown error"
            });
        }
    });

    const handleSend = () => {
        if (!title.trim() || !message.trim()) {
            toast.error("Title and message are required");
            return;
        }
        sendMutation.mutate({ title: title.trim(), message: message.trim(), type, target });
    };

    return (
        <Dialog open={open} onClose={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Bell className="size-4 text-emerald-500" />
                        Compose Notification
                    </DialogTitle>
                    <DialogDescription>
                        Send a notification to users. Select the type and target audience.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {/* Title */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground">Title</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Notification title"
                            className="w-full rounded-lg border border-border/80 bg-secondary/30 px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                        />
                    </div>

                    {/* Message */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground">Message</label>
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Notification message..."
                            rows={3}
                            className="w-full rounded-lg border border-border/80 bg-secondary/30 px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none"
                        />
                    </div>

                    {/* Type selector */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground">Type</label>
                        <div className="flex flex-wrap gap-1.5">
                            {NOTIFICATION_TYPES.map((t) => (
                                <button
                                    key={t.value}
                                    type="button"
                                    onClick={() => setType(t.value)}
                                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[10px] font-semibold transition-all cursor-pointer ${
                                        type === t.value
                                            ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-500"
                                            : "border-border/60 bg-secondary/40 text-muted-foreground hover:text-foreground"
                                    }`}
                                >
                                    <span className={`size-1.5 rounded-full ${t.color}`} />
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Target selector */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground">Target</label>
                        <div className="flex flex-wrap gap-1.5">
                            {TARGETS.map((t) => (
                                <button
                                    key={t.value}
                                    type="button"
                                    onClick={() => setTarget(t.value)}
                                    className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-[10px] font-semibold transition-all cursor-pointer ${
                                        target === t.value
                                            ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-500"
                                            : "border-border/60 bg-secondary/40 text-muted-foreground hover:text-foreground"
                                    }`}
                                >
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={onClose} className="cursor-pointer">
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSend}
                        disabled={sendMutation.isPending || !title.trim() || !message.trim()}
                        className="cursor-pointer gap-1.5"
                    >
                        <Send className="size-3.5" />
                        {sendMutation.isPending ? "Sending..." : "Send Notification"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
