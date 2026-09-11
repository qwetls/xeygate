import { createTransactionDB, userAuthStore } from "@srouter/db";

const DAY_MS = 24 * 60 * 60 * 1000;
const STREAK_CYCLE = 7;
const BASE_REWARD = 8;
const FINAL_DAY_REWARD = 10;

export interface DailyRewardResult {
    awarded: boolean;
    /** Streak day (1..7) the user is currently on. */
    day: number;
    amount: number;
    /** Wallet credits after the (possible) grant. */
    credits: number;
}

function utcDayKey(now: number): string {
    return new Date(now).toISOString().slice(0, 10);
}

/**
 * Credit the daily login reward for one successful sign-in.
 *
 * Days 1-6 of a streak pay $8; completing day 7 pays $10 and the next
 * consecutive login restarts the cycle. Granting is keyed to the UTC
 * calendar day, so extra logins on the same day never double-credit, and
 * skipping a full day resets the streak to day 1.
 */
export async function GrantDailyLoginReward(
    userId: string,
    now = Date.now()
): Promise<DailyRewardResult> {
    const today = utcDayKey(now);
    const current = await userAuthStore.getLoginReward(userId);

    if (current?.lastDay === today) {
        return { awarded: false, day: current.streak, amount: 0, credits: await userAuthStore.getUserCredits(userId) };
    }

    const continuing =
        current !== null &&
        current.streak < STREAK_CYCLE &&
        current.lastDay === utcDayKey(now - DAY_MS);
    const day = continuing ? current.streak + 1 : 1;
    const amount = day === STREAK_CYCLE ? FINAL_DAY_REWARD : BASE_REWARD;

    const updated = await userAuthStore.updateCredits(userId, amount);
    await createTransactionDB({
        userId,
        type: "credit",
        amount,
        description: `Daily login reward — day ${day} of ${STREAK_CYCLE}`
    });
    await userAuthStore.setLoginReward(userId, today, day);

    return { awarded: true, day, amount, credits: updated?.credits ?? 0 };
}
