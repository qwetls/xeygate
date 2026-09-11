import { createFileRoute } from "@tanstack/react-router";
import { LegalShell, P, Ul, Strong } from "@/components/legal/legalShell";

export const Route = createFileRoute("/terms")({
    component: TermsPage,
    staticData: { title: "Terms of Service" }
});

function TermsPage() {
    return (
        <LegalShell
            eyebrow="Legal"
            title="Terms of Service"
            updated="11 September 2026"
            intro={
                <P>
                    These Terms govern your access to and use of XEYGATE, the cloud AI gateway and
                    model marketplace operated by XeyCompany ("we", "us"). By creating an account or
                    sending a request through the gateway you agree to these Terms. If you are
                    accepting on behalf of an organisation, you represent that you may bind it.
                </P>
            }
            sections={[
                {
                    heading: "1. The service",
                    body: (
                        <>
                            <P>
                                XEYGATE routes API requests from your applications to third-party AI
                                model providers, meters that usage, and provides dashboards, keys,
                                analytics and a marketplace where independent creators may offer
                                model access. We are an intermediary: the underlying models are
                                supplied by their respective providers under their own terms and
                                capabilities, which we do not control or warrant.
                            </P>
                            <P>
                                We may add, change, deprecate or remove models, endpoints, pricing
                                and features at any time. Route availability depends on upstream
                                providers and may degrade without notice.
                            </P>
                        </>
                    )
                },
                {
                    heading: "2. Accounts and keys",
                    body: (
                        <>
                            <P>
                                You must provide accurate information and keep your credentials and
                                API keys confidential.{" "}
                                <Strong>
                                    Any request signed with your key is treated as authorised by you
                                </Strong>
                                , including usage that exhausts your wallet or incurs cost. Notify us
                                promptly and rotate keys if you suspect compromise — key rotation is
                                available from your dashboard.
                            </P>
                            <P>
                                Accounts are subject to approval. We may refuse, suspend or terminate
                                accounts that violate these Terms, the Acceptable Use Policy, or
                                applicable law, or where required to protect the service or other
                                customers.
                            </P>
                        </>
                    )
                },
                {
                    heading: "3. Wallet, credits and top-ups",
                    body: (
                        <>
                            <P>
                                Usage is billed against a prepaid USD credit balance. You may request
                                a top-up from the Billing page; each request becomes an{" "}
                                <Strong>
                                    order that an administrator reviews and confirms
                                </Strong>
                                . Credits are only added after that confirmation, and only one top-up
                                order may be pending per account at a time.
                            </P>
                            <P>
                                While an order is pending you may cancel it yourself; once processed
                                it can no longer be changed. Credits have no cash value, are not a
                                deposit, are not insured, are not transferable between accounts, and
                                cannot be withdrawn except where a refund is required by law or
                                granted by us (see the Refund Policy).
                            </P>
                            <P>
                                Promotional and reward credits — including daily login rewards — are
                                granted at our discretion, may expire, and are never refundable or
                                exchangeable for money.
                            </P>
                        </>
                    )
                },
                {
                    heading: "4. Billing and taxes",
                    body: (
                        <>
                            <P>
                                Prices shown in the marketplace are per request or per token as
                                listed at the time of the call. Listed prices may change; changes do
                                not apply to requests already accepted by the gateway. You are
                                responsible for any taxes, duties or bank or payment-processor fees
                                that apply to your purchases.
                            </P>
                            <P>
                                If a request fails before upstream processing we meter it as
                                unbilled; where a provider charges us for a call that returned an
                                error to you, we may still pass that cost through and will say so in
                                the transaction ledger.
                            </P>
                        </>
                    )
                },
                {
                    heading: "5. Creators and the marketplace",
                    body: (
                        <>
                            <P>
                                Creators may list models they operate or resell. A listing implies
                                the creator holds the rights and permissions needed to offer it and
                                is responsible for its accuracy, availability, content handling and
                                pricing. We take a platform share from creator earnings and pay out
                                approved balances through the payout queue.
                            </P>
                            <P>
                                Buying a listing grants access to routed calls only — it transfers no
                                ownership of any model, weights, training data or provider licence.
                            </P>
                        </>
                    )
                },
                {
                    heading: "6. Acceptable use",
                    body: (
                        <P>
                            You must use XEYGATE in line with our Acceptable Use Policy, available in
                            the footer of every page. Misuse may result in throttling, key
                            revocation, loss of credits or termination.
                        </P>
                    )
                },
                {
                    heading: "7. Inputs, outputs and your content",
                    body: (
                        <>
                            <P>
                                You keep your rights in the material you send through the gateway and
                                remain responsible for it and for how outputs are used. You grant us
                                the limited licence needed to operate the service: transmitting your
                                requests to providers, returning responses, and storing the request
                                and response telemetry required for metering, debugging, abuse
                                detection and your own log views.
                            </P>
                            <P>
                                Model outputs are machine-generated, may be inaccurate, offensive or
                                infringing, and are not advice. You must review outputs before using
                                them in anything consequential.
                            </P>
                        </>
                    )
                },
                {
                    heading: "8. Availability, support and no SLA",
                    body: (
                        <P>
                            XEYGATE is provided on an as-available basis without any service level
                            commitment, uptime guarantee or support response time unless a separate
                            written agreement says otherwise. Planned maintenance may occur; we do
                            not promise to notify you of every change.
                        </P>
                    )
                },
                {
                    heading: "9. Disclaimers",
                    body: (
                        <P>
                            To the maximum extent permitted by law the service is provided "as is"
                            and we disclaim all implied warranties, including merchantability, fitness
                            for a particular purpose, title and non-infringement, and any warranty
                            that the service will be uninterrupted, secure or error-free.
                        </P>
                    )
                },
                {
                    heading: "10. Liability",
                    body: (
                        <P>
                            We are not liable for indirect, incidental, special or consequential
                            loss, or for lost profits, lost credits value or business interruption,
                            even if advised of the possibility. Our total aggregate liability for
                            claims arising from the service is limited to the amount of credits you
                            paid for and were unable to use because of the event giving rise to the
                            claim. These limits apply regardless of whether the claim is brought in
                            contract, tort or otherwise.
                        </P>
                    )
                },
                {
                    heading: "11. Suspension, termination and effect",
                    body: (
                        <P>
                            You may stop using XEYGATE at any time; account deletion can be requested
                            through the contact channel below. We may suspend or terminate access for
                            breach, non-payment of upstream costs, security risk, or prolonged
                            inactivity. On termination your keys stop working immediately and unused
                            credits are handled as described in the Refund Policy. Provisions that by
                            nature should survive — ownership, disclaimers, liability limits and
                            indemnity — do survive.
                        </P>
                    )
                },
                {
                    heading: "12. Changes to these Terms",
                    body: (
                        <P>
                            We may update these Terms. Material changes are announced in the
                            application or by other reasonable means; the "last updated" date above
                            always reflects the current version. Continuing to use XEYGATE after a
                            change takes effect means you accept it. If you do not, stop using the
                            service.
                        </P>
                    )
                },
                {
                    heading: "13. Contact",
                    body: (
                        <P>
                            Questions about these Terms, or requests relating to your account, can be
                            sent to XeyCompany via{" "}
                            <a
                                href="https://xeycompany.com"
                                target="_blank"
                                rel="noreferrer"
                                className="text-foreground underline underline-offset-2"
                            >
                                xeycompany.com
                            </a>
                            . Please include your account e-mail so we can act on the request.
                        </P>
                    )
                }
            ]}
        />
    );
}
