import { createFileRoute } from "@tanstack/react-router";
import { LegalShell, P, Ul, Strong } from "@/components/legal/legalShell";

export const Route = createFileRoute("/privacy")({
    component: PrivacyPage,
    staticData: { title: "Privacy Policy" }
});

function PrivacyPage() {
    return (
        <LegalShell
            eyebrow="Legal"
            title="Privacy Policy"
            updated="11 September 2026"
            intro={
                <P>
                    This policy explains what XeyCompany collects when you use XEYGATE, why, and
                    what you can ask us to do about it. We deliberately keep collection minimal: the
                    gateway exists to route API calls, not to profile you.
                </P>
            }
            sections={[
                {
                    heading: "1. Information we collect",
                    body: (
                        <>
                            <P>We collect three kinds of information:</P>
                            {Ul([
                                <>
                                    <Strong>Account data</Strong> — your name, e-mail address, a
                                    hashed password, account status and role flags, and your credit
                                    balance, API keys and transaction history.
                                </>,
                                <>
                                    <Strong>Usage telemetry</Strong> — for every routed request:
                                    timestamp, model, provider, latency, token counts, HTTP status,
                                    credit cost, and the key and account that made the call.
                                </>,
                                <>
                                    <Strong>Request payloads</Strong> — the content you send through
                                    the gateway and the responses returned are processed to deliver
                                    the service and are retained in request logs so you and our
                                    operators can debug integrations and audit spending.
                                </>
                            ])}
                            <P>
                                We do not ask for, or expect, payment card data: top-ups are recorded
                                as reference notes you supply, reviewed by our administrators.
                            </P>
                        </>
                    )
                },
                {
                    heading: "2. How we use information",
                    body: (
                        <>{Ul([
                            "to operate the gateway: authenticate, route, meter and bill requests;",
                            "to show you your own dashboards: usage, analytics, logs, keys and billing history;",
                            "to keep the service safe: detect abuse, key sharing, credential stuffing and anomalous spend;",
                            "to review top-up and payout orders, including the payment references you submit;",
                            "to comply with law and enforce our Terms and Acceptable Use Policy."
                        ])}</>
                    )
                },
                {
                    heading: "3. Sharing with third parties",
                    body: (
                        <>
                            <P>
                                <Strong>
                                    Your prompts and inputs are transmitted to the AI model
                                    providers you choose to route to
                                </Strong>{" "}
                                — this is the core function of the service. Those providers process
                                the content under their own terms and data-handling practices;
                                marketplace listings show whose models you are calling. We do not
                                sell your personal information.
                            </P>
                            <P>
                                We may disclose information to our hosting and infrastructure
                                vendors, payment processors, professional advisers, and authorities
                                where we are legally required or permitted to do so, or where
                                disclosure is necessary to protect the rights, safety or property of
                                XeyCompany, our users or the public.
                            </P>
                        </>
                    )
                },
                {
                    heading: "4. Cookies and sessions",
                    body: (
                        <P>
                            XEYGATE uses strictly necessary session cookies to keep you signed in to
                            the dashboard. We do not run advertising trackers or cross-site
                            profiling scripts on the gateway application.
                        </P>
                    )
                },
                {
                    heading: "5. Retention",
                    body: (
                        <>
                            <P>
                                Account data is kept while your account exists. Request logs and
                                telemetry are retained for a rolling period that is long enough to
                                resolve billing disputes and debug integrations, then deleted or
                                anonymised. Transaction and top-up records are kept for as long as
                                financial-records law requires.
                            </P>
                            <P>
                                If you delete your account, we remove personal identifiers and erase
                                logs where feasible, keeping only the minimum aggregated or archival
                                data required for legal, tax and security purposes.
                            </P>
                        </>
                    )
                },
                {
                    heading: "6. Security",
                    body: (
                        <P>
                            Traffic is served over HTTPS, passwords are stored only as strong
                            hashes, API keys are shown once and stored in hashed form, and access to
                            production systems is restricted to administrators. No system is
                            perfectly secure; if you believe your account or keys are compromised,
                            rotate your keys immediately and contact us.
                        </P>
                    )
                },
                {
                    heading: "7. Your choices and rights",
                    body: (
                        <>{Ul([
                            "access and export: your usage, logs and transactions are visible and exportable from the dashboard;",
                            "correction: update your name and contact details from your profile page;",
                            "deletion: request account deletion through the contact channel below;",
                            "objection: you can stop routing to a provider at any time; do not send sensitive data through models you have not reviewed."
                        ])}</>
                    )
                },
                {
                    heading: "8. Children",
                    body: (
                        <P>
                            XEYGATE is a developer tool for business use and is not directed at
                            children under 16. We do not knowingly collect their data.
                        </P>
                    )
                },
                {
                    heading: "9. International processing",
                    body: (
                        <P>
                            XEYGATE is operated from Indonesia and routes to providers located in
                            other countries. By using the gateway you understand your requests may
                            be processed outside your jurisdiction, under the laws of those places.
                        </P>
                    )
                },
                {
                    heading: "10. Changes and contact",
                    body: (
                        <P>
                            We may update this policy; the date above shows the current version. For
                            privacy questions or requests, contact XeyCompany via{" "}
                            <a
                                href="https://xeycompany.com"
                                target="_blank"
                                rel="noreferrer"
                                className="text-foreground underline underline-offset-2"
                            >
                                xeycompany.com
                            </a>
                            .
                        </P>
                    )
                }
            ]}
        />
    );
}
