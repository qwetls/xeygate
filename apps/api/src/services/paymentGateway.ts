import {
    userAuthStore,
    processTopupOrderDB,
    createTransactionDB,
    getTopupOrderDB,
    type TopupOrder
} from "@srouter/db";

// ─────────────────────────────────────────────────────
// Payment gateway abstraction. Today only the SandboxGateway exists:
// an order in 'pending_payment' is settled by an explicit user action
// (the dashboard's "Pay" button), which immediately credits the wallet.
// A real gateway (Midtrans/Xendit-style) plugs in by implementing
// `createCheckout` + calling `SettleTopupOrder` from its webhook —
// only the settle path moves money, so the wallet logic never changes.
// ─────────────────────────────────────────────────────

export interface PaymentGateway {
    readonly name: string;
    readonly sandbox: boolean;
}

export const SandboxGateway: PaymentGateway = {
    name: "sandbox",
    sandbox: true
};

export function GetActiveGateway(): PaymentGateway {
    return SandboxGateway;
}

export interface SettleResult {
    topup: TopupOrder;
    credits?: number;
}

/**
 * Single path that flips an unpaid order to 'paid' and moves money.
 * The conditional UPDATE in processTopupOrderDB pins the order to an open
 * status, so a double settle (or a race against user cancel) changes 0 rows
 * and returns null — callers treat null as "not payable".
 */
export async function SettleTopupOrder(
    orderId: string,
    opts?: { note?: string }
): Promise<SettleResult | null> {
    const topup = await processTopupOrderDB(orderId, "paid", {
        note: opts?.note ?? "Paid via sandbox gateway"
    });
    if (!topup) return null;

    await userAuthStore.updateCredits(topup.userId, topup.amount);
    await createTransactionDB({
        userId: topup.userId,
        type: "credit",
        amount: topup.amount,
        description: `Top-up ${topup.id} paid`
    });
    const user = await userAuthStore.getUserById(topup.userId);
    return { topup, credits: user?.credits };
}

/** Look up an order the current user owns and that is still payable. */
export async function GetPayableTopupOrder(
    orderId: string,
    userId: string
): Promise<{ topup?: TopupOrder; error?: string }> {
    const topup = await getTopupOrderDB(orderId);
    if (!topup || topup.userId !== userId) return { error: "Top-up order not found" };
    if (topup.status !== "pending_payment") {
        return { error: "Order is not awaiting payment" };
    }
    return { topup };
}
