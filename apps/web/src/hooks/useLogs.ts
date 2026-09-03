import { useMemo, useState } from "react";
import type { RequestLogEntry } from "@srouter/types";

export type LogStatusFilter = "all" | "success" | "error";

export function useLogs(logs: RequestLogEntry[]) {
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<LogStatusFilter>("all");
    const [apiKeyFilter, setApiKeyFilter] = useState<string>("all");

    const filteredLogs = useMemo(
        () =>
            logs.filter((log) => {
                const query = searchQuery.toLowerCase().trim();
                const matchesQuery =
                    !query ||
                    log.model.toLowerCase().includes(query) ||
                    log.providerId.toLowerCase().includes(query) ||
                    log.id.toLowerCase().includes(query) ||
                    (log.ipAddress && log.ipAddress.toLowerCase().includes(query)) ||
                    (log.resolvedModel && log.resolvedModel.toLowerCase().includes(query)) ||
                    (log.apiKeyName && log.apiKeyName.toLowerCase().includes(query)) ||
                    (log.apiKeyId && log.apiKeyId.toLowerCase().includes(query));

                const isSuccess = log.statusCode >= 200 && log.statusCode < 300;
                if (statusFilter === "success" && !isSuccess) return false;
                if (statusFilter === "error" && isSuccess) return false;

                if (apiKeyFilter !== "all") {
                    if (apiKeyFilter === "none") {
                        if (log.apiKeyId) return false;
                    } else if (log.apiKeyId !== apiKeyFilter) {
                        return false;
                    }
                }

                return matchesQuery;
            }),
        [logs, searchQuery, statusFilter, apiKeyFilter]
    );

    return {
        searchQuery,
        setSearchQuery,
        statusFilter,
        setStatusFilter,
        apiKeyFilter,
        setApiKeyFilter,
        filteredLogs
    };
}
