import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export const Route = createFileRoute("/_client/dashboard")({
    component: DashboardLayout
});

interface UserInfo {
    id: string;
    email: string;
    name: string;
    credits: number;
}

function DashboardLayout() {
    return <Outlet />;
}
