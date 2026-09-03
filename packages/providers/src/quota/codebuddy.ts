import { CODEBUDDY_CN_DOMAIN, CODEBUDDY_CN_USER_AGENT, isProviderBaseId } from "@srouter/constants";
import type { LiveModelQuotaItem, ProviderQuotaAccount } from "@srouter/types";
import { type IProviderQuotaFetcher, type ProviderQuotaContext, formatResetIn } from "./base.js";

interface CodeBuddyCNAccount {
    PackageName?: string;
    SubProductName?: string;
    CycleStartTime?: string;
    CycleEndTime?: string;
    DeductionEndTime?: number;
    CycleCapacityUsed?: number;
    CycleCapacityUsedPrecise?: string;
    CycleCapacitySize?: number;
    CycleCapacitySizePrecise?: string;
    CapacityUsed?: number;
    CapacityUsedPrecise?: string;
    CapacitySize?: number;
    CapacitySizePrecise?: string;
}

const CN_REFILL_GAP_MS = 2 * 24 * 60 * 60 * 1000;

function parseNum(precise?: string, plain?: number): number {
    if (precise !== undefined && precise !== null && precise !== "") {
        const parsed = Number(precise);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return plain !== undefined && plain !== null && Number.isFinite(plain) ? plain : 0;
}

export class CodeBuddyCNQuotaFetcher implements IProviderQuotaFetcher {
    public readonly providerKey = "codebuddy-cn";

    public canHandle(providerId: string): boolean {
        return isProviderBaseId(providerId, "codebuddy-cn");
    }

    public async fetchQuota(ctx: ProviderQuotaContext): Promise<ProviderQuotaAccount> {
        const accessToken = ctx.accessToken || "";
        if (!accessToken) {
            throw new Error("CodeBuddy CN quota requires an access token");
        }

        const Res = await fetch("https://copilot.tencent.com/v2/billing/meter/get-user-resource", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
                Accept: "application/json",
                "User-Agent": CODEBUDDY_CN_USER_AGENT,
                "X-Product": "SaaS",
                "X-IDE-Type": "CLI",
                "X-IDE-Name": "CLI",
                "X-Domain": CODEBUDDY_CN_DOMAIN,
                "x-requested-with": "XMLHttpRequest",
                "x-codebuddy-request": "1"
            },
            body: "{}"
        });

        if (!Res.ok) {
            throw new Error(`CodeBuddy CN quota fetch failed: HTTP ${Res.status}`);
        }

        const Json = (await Res.json()) as {
            code?: number;
            msg?: string;
            data?: { Response?: { Data?: { Accounts?: CodeBuddyCNAccount[] } } };
        };
        if (Json.code !== 0) {
            throw new Error(`CodeBuddy CN quota error: ${Json.msg || "unknown"}`);
        }

        const Accounts = Json.data?.Response?.Data?.Accounts ?? [];
        if (Accounts.length === 0) {
            throw new Error("CodeBuddy CN quota fetch returned no credit packages");
        }

        const cycleEndMs = (acc: CodeBuddyCNAccount): number => {
            const T = acc.CycleEndTime ? new Date(acc.CycleEndTime).getTime() : NaN;
            return Number.isFinite(T) ? T : Number.POSITIVE_INFINITY;
        };
        const isRefill = (acc: CodeBuddyCNAccount): boolean => {
            const Ce = cycleEndMs(acc);
            const De = parseNum(undefined, acc.DeductionEndTime);
            return Number.isFinite(Ce) && Number.isFinite(De) && De - Ce > CN_REFILL_GAP_MS;
        };
        const byExpiry = (a: CodeBuddyCNAccount, b: CodeBuddyCNAccount) =>
            cycleEndMs(a) - cycleEndMs(b);

        const Refills = Accounts.filter(isRefill).sort(byExpiry);
        const Bonuses = Accounts.filter((a) => !isRefill(a)).sort(byExpiry);

        const toItem = (
            name: string,
            used: number,
            total: number,
            resetTime?: string
        ): LiveModelQuotaItem => {
            const RemainingFraction = total > 0 ? (total - used) / total : 1;
            return {
                name,
                used: Math.round(used * 100) / 100,
                limit: Math.round(total * 100) / 100,
                percentage: total > 0 ? `${Math.round((used / total) * 100)}%` : "0%",
                percentageValue: total > 0 ? Math.round((used / total) * 100) : 0,
                resetIn: formatResetIn(resetTime),
                resetTime,
                status:
                    RemainingFraction <= 0.05
                        ? "exhausted"
                        : RemainingFraction <= 0.2
                          ? "warning"
                          : "ok"
            };
        };

        const Quotas: LiveModelQuotaItem[] = [];
        const SeenCadence: Record<string, number> = {};
        for (const acc of Refills) {
            const CycleStartMs = acc.CycleStartTime ? new Date(acc.CycleStartTime).getTime() : NaN;
            const CycleDays = (cycleEndMs(acc) - CycleStartMs) / 86400000;
            const Base =
                Number.isFinite(CycleDays) && CycleDays <= 1.5
                    ? "Daily"
                    : Number.isFinite(CycleDays) && CycleDays <= 10
                      ? "Weekly"
                      : "Monthly";
            SeenCadence[Base] = (SeenCadence[Base] ?? 0) + 1;
            const Name = SeenCadence[Base]! > 1 ? `${Base} ${SeenCadence[Base]}` : Base;
            Quotas.push(
                toItem(
                    Name,
                    parseNum(acc.CycleCapacityUsedPrecise, acc.CycleCapacityUsed),
                    parseNum(acc.CycleCapacitySizePrecise, acc.CycleCapacitySize),
                    acc.CycleEndTime
                )
            );
        }

        Bonuses.forEach((acc, i) => {
            Quotas.push(
                toItem(
                    `Bonus Pack ${i + 1}`,
                    parseNum(acc.CapacityUsedPrecise, acc.CapacityUsed),
                    parseNum(acc.CapacitySizePrecise, acc.CapacitySize),
                    acc.CycleEndTime
                )
            );
        });

        const BasePkg = Refills[0] ?? Accounts[0] ?? {};
        const Plan = BasePkg.PackageName || BasePkg.SubProductName;

        return {
            id: ctx.id,
            provider: Plan ? `CodeBuddy CN (${Plan})` : "CodeBuddy CN",
            account: ctx.name || "CodeBuddy CN Account",
            enabled: ctx.enabled,
            quotaType: "live_provider_quota",
            totalQuotas: Quotas.length,
            quotas: Quotas
        };
    }
}
