import { createFileRoute } from "@tanstack/react-router";
import { LegalShell, P, Ul, Strong } from "@/components/legal/legalShell";

export const Route = createFileRoute("/acceptable-use")({
    component: AcceptableUsePage,
    staticData: { title: "Acceptable Use Policy" }
});

function AcceptableUsePage() {
    return (
        <LegalShell
            eyebrow="Legal"
            title="Acceptable Use Policy"
            updated="11 September 2026"
            intro={
                <P>
                    This policy sets the floor for how XEYGATE may be used. It applies to you, your
                    applications, everyone you grant access, and anything generated with your keys.
                    Our Terms incorporate it by reference. If a rule here conflicts with a model
                    provider's own usage terms, the stricter one applies to that route.
                </P>
            }
            sections={[
                {
                    heading: "1. Content limits",
                    body: (
                        <>
                            <P>
                                Do not use the gateway to create, host, transmit, procure or
                                promote:
                            </P>
                            {Ul([
                            <>material that is unlawful in your jurisdiction or ours, including content that facilitates violent or sexual offences, terrorism, or self-harm;</>,
                            <>child sexual exploitation or abuse in any form — this is a zero-tolerance, reportable category;</>,
                            <>targeted harassment, bullying, defamation, or incitement to violence against individuals or groups;</>,
                            <>material that promotes discrimination or measured hostility against people based on protected characteristics;</>,
                            <>non-consensual intimate imagery, or content that invades a reasonable expectation of privacy;</>,
                            <>content intended to defraud, deceive, impersonate or mislead — including phishing, fake credentials, fabricated evidence, and deepfake media presented as authentic;</>,
                            <>instructions, exploits or malware designed to damage systems or steal data.</>
                        ])}</>
                    )
                },
                {
                    heading: "2. Protecting people and systems",
                    body: (
                        <>{Ul([
                            <>no building, testing or distributing malicious software, denial-of-service tooling, intrusion payloads, or credential-stealing flows;</>,
                            <>no probing, scanning or attacking XEYGATE, our upstream providers, or any third-party network without written authorisation;</>,
                            <>no attempts to bypass rate limits, quotas, spend caps, key scoping or model access controls;</>,
                            <>no reselling, sharing or publishing of API keys, and no operating a service that proxies gateway access to the public.</>
                        ])}</>
                    )
                },
                {
                    heading: "3. Regulated and high-stakes domains",
                    body: (
                        <>
                            <P>
                                XEYGATE is not a certified system for safety-critical or regulated
                                decisions. You must not route, without your own qualified review,
                                work used for medical diagnosis or treatment, credit, housing or
                                employment eligibility, legal or immigration determinations, exam
                                proctoring, critical infrastructure control, weapons guidance, or any
                                purpose where law requires a licensed human to decide.
                            </P>
                            <P>
                                Where a domain is regulated, <Strong>you</Strong>, not XEYGATE or
                                the model provider, are responsible for compliance with that
                                regime.
                            </P>
                        </>
                    )
                },
                {
                    heading: "4. Accuracy, fairness and disclosure",
                    body: (
                        <>{Ul([
                            "label AI-generated content as AI-generated where its authenticity could mislead a reasonable person;",
                            "do not present model output as professional advice, verified fact, or sourced evidence without human review;",
                            "where outputs influence decisions about people, keep a route for human appeal and correction."
                        ])}</>
                    )
                },
                {
                    heading: "5. Marketplace conduct",
                    body: (
                        <>{Ul([
                            "creators must only list models they are licensed to offer, priced and described accurately;",
                            "no fabricating usage, inflating quality signals, self-buying, or gaming routing, rankings or the payout queue;",
                            "no listing a model in order to harvest other users' prompts or keys."
                        ])}</>
                    )
                },
                {
                    heading: "6. Enforcement",
                    body: (
                        <>
                            <P>
                                We enforce this policy proportionally: throttling a route, requiring
                                review, revoking a key, freezing a disputed payout, suspending an
                                account, or terminating it and forfeiting credits obtained through
                                abuse. For content that is unlawful or presents an immediate risk of
                                serious harm, we may act first and notify you afterwards.
                            </P>
                            <P>
                                Accounts are approved by administrators. Repeated or wilful breaches,
                                or providing false information during approval, can end your access
                                permanently.
                            </P>
                        </>
                    )
                },
                {
                    heading: "7. Reporting",
                    body: (
                        <P>
                            Report suspected misuse of XEYGATE, or security issues, to XeyCompany
                            via{" "}
                            <a
                                href="https://xeycompany.com"
                                target="_blank"
                                rel="noreferrer"
                                className="text-foreground underline underline-offset-2"
                            >
                                xeycompany.com
                            </a>
                            . Good-faith reports are welcome and we do not retaliate against people
                            who flag problems.
                        </P>
                    )
                }
            ]}
        />
    );
}
