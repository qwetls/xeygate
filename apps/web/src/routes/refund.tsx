import { createFileRoute } from "@tanstack/react-router";
import { LegalShell, P, Ul, Strong } from "@/components/legal/legalShell";

export const Route = createFileRoute("/refund")({
    component: RefundPage,
    staticData: { title: "Refund Policy" }
});

function RefundPage() {
    return (
        <LegalShell
            eyebrow="Legal"
            title="Refund Policy"
            updated="11 September 2026"
            intro={
                <P>
                    XEYGATE runs on prepaid credits consumed by per-request usage, so most charges
                    are for service already delivered. This policy explains when money can come
                    back the other way, and how to ask. It supplements the Terms of Service.
                </P>
            }
            sections={[
                {
                    heading: "1. Pending top-ups",
                    body: (
                        <P>
                            A top-up is an order until an administrator confirms it. While pending,
                            you can cancel it yourself from the Billing page — no money has moved
                            and no action from us is needed. Once approved and credited, an order
                            cannot be reversed by you and falls under the rules below.
                        </P>
                    )
                },
                {
                    heading: "2. Refundable within 7 days",
                    body: (
                        <>
                            <P>
                                You may request a refund of a credited top-up{" "}
                                <Strong>
                                    within 7 days of approval
                                </Strong>{" "}
                                when the credits it added are still unused — for example you paid
                                for the wrong account, sent the wrong amount, or your access was
                                never approved. We will remove the credits and return the payment to
                                the method it came from where the payment rail allows it.
                            </P>
                            <P>
                                Partially used top-ups are evaluated pro rata: we can refund the
                                unused portion, minus any costs we already incurred on your behalf
                                with upstream providers.
                            </P>
                        </>
                    )
                },
                {
                    heading: "3. Not refundable",
                    body: (
                        <>{Ul([
                            "credits already consumed by successful requests — the service was delivered;",
                            "requests that failed for reasons on your side: bad keys, unsupported parameters, your own timeouts, or content a provider legitimately refused;",
                            "reward, promotional and bonus credits — they never had a cash value;",
                            "price differences after a marketplace listing changes its price;",
                            "accounts terminated for breaching the Terms or the Acceptable Use Policy: credits forfeited in that case are not refundable;",
                            "bank, e-wallet or payment-processor fees charged to you by the payment provider — those belong to them, not us."
                        ])}</>
                    )
                },
                {
                    heading: "4. Service-failure claims",
                    body: (
                        <P>
                            If XEYGATE itself (not an upstream provider) materially fails while your
                            credits are being consumed — for example a gateway bug double-charges a
                            request — tell us with the request log IDs. Verified errors are credited
                            back to your wallet promptly; corrections of this kind are made in
                            credits, not cash.
                        </P>
                    )
                },
                {
                    heading: "5. How to request",
                    body: (
                        <>
                            <P>
                                Contact XeyCompany via{" "}
                                <a
                                    href="https://xeycompany.com"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-foreground underline underline-offset-2"
                                >
                                    xeycompany.com
                                </a>{" "}
                                with your account e-mail, the top-up order ID (shown in Billing),
                                the amount, and why you believe a refund applies. Requests are
                                reviewed by an administrator.
                            </P>
                            <P>
                                Approved refunds are returned to the original payment method (or by
                                manual transfer where the rail no longer allows it) within
                                approximately 5–10 business days of approval, depending on your bank
                                or wallet provider.
                            </P>
                        </>
                    )
                },
                {
                    heading: "6. Chargebacks",
                    body: (
                        <P>
                            Please use this refund process instead of opening a dispute with your
                            bank or payment processor. Filing a chargeback without first giving us a
                            chance to fix the issue usually results in the account and its remaining
                            credits being frozen while the dispute is resolved.
                        </P>
                    )
                },
                {
                    heading: "7. Closing an account",
                    body: (
                        <P>
                            If you close an account in good standing, you may request a refund of
                            unused, paid-for credits that are older than your most recent 7 days but
                            were never used; reward and promotional balances are excluded. Once the
                            account is deleted, no further claims can be made against it.
                        </P>
                    )
                },
                {
                    heading: "8. Your legal rights",
                    body: (
                        <P>
                            Nothing in this policy limits rights you cannot lawfully be excluded
                            from — including statutory withdrawal or consumer rights that apply in
                            your jurisdiction. Where this policy and those rights conflict, the
                            law wins.
                        </P>
                    )
                }
            ]}
        />
    );
}
