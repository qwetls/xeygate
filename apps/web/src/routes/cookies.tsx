import { createFileRoute } from "@tanstack/react-router";
import { LegalShell, P, Ul, Strong } from "@/components/legal/legalShell";

export const Route = createFileRoute("/cookies")({
    component: CookiesPage,
    staticData: { title: "Cookie Policy" }
});

function CookiesPage() {
    return (
        <LegalShell
            eyebrow="Legal"
            title="Cookie Policy"
            updated="15 September 2026"
            intro={
                <P>
                    This Cookie Policy explains how XEYGATE, operated by XeyCompany, uses cookies and
                    similar technologies when you visit our website and dashboard at{" "}
                    <Strong>gate.xeycompany.com</Strong>. This policy should be read together with our{" "}
                    <Strong>Privacy Policy</Strong>.
                </P>
            }
            sections={[
                {
                    heading: "1. What are cookies",
                    body: (
                        <P>
                            Cookies are small text files placed on your device by websites you visit.
                            They are widely used to make websites work, improve efficiency, and provide
                            reporting information to site operators.
                        </P>
                    )
                },
                {
                    heading: "2. Cookies we use",
                    body: (
                        <>
                            <P>
                                XEYGATE uses only <Strong>strictly necessary cookies</Strong>. We do not
                                use advertising, tracking, analytics, or cross-site profiling cookies.
                            </P>
                            {Ul([
                                <>
                                    <Strong>__Host-xeygate_user_session</Strong> — a secure, HttpOnly
                                    session cookie that keeps you signed in to the dashboard. It is set
                                    when you log in or register and expires after 30 days of inactivity.
                                    This cookie uses the <Strong>__Host-</Strong> prefix, which means the
                                    browser enforces that it is only sent over HTTPS, scoped to the exact
                                    domain (not subdomains), and cannot be overwritten by insecure scripts.
                                </>,
                                <>
                                    <Strong>__Host-xeygate_github_oauth</Strong> — a short-lived,
                                    HttpOnly cookie used during the GitHub sign-in flow to prevent CSRF
                                    attacks. It stores a cryptographic state token and expires after 10
                                    minutes. It is deleted automatically once the sign-in completes or
                                    fails.
                                </>
                            ])}
                        </>
                    )
                },
                {
                    heading: "3. What we do NOT use",
                    body: (
                        <>
                            <P>We do not use:</P>
                            {Ul([
                                "Advertising or marketing cookies",
                                "Third-party analytics cookies (Google Analytics, Mixpanel, etc.)",
                                "Social media tracking pixels",
                                "Cross-site profiling or fingerprinting technologies",
                                "Local storage for tracking purposes (we use local storage only for your UI preferences such as theme)"
                            ])}
                        </>
                    )
                },
                {
                    heading: "4. Security features",
                    body: (
                        <>
                            <P>All XEYGATE cookies carry these security attributes:</P>
                            {Ul([
                                <>
                                    <Strong>Secure</Strong> — cookies are only transmitted over HTTPS
                                    connections.
                                </>,
                                <>
                                    <Strong>HttpOnly</Strong> — cookies are not accessible to JavaScript
                                    code, protecting against cross-site scripting (XSS) attacks.
                                </>,
                                <>
                                    <Strong>SameSite=Lax</Strong> — cookies are not sent on cross-site
                                    requests, protecting against cross-site request forgery (CSRF).
                                </>,
                                <>
                                    <Strong>__Host- prefix</Strong> — the browser enforces that these
                                    cookies are domain-bound, HTTPS-only, and scoped to the exact host,
                                    preventing subdomain injection attacks.
                                </>
                            ])}
                        </>
                    )
                },
                {
                    heading: "5. Managing cookies",
                    body: (
                        <>
                            <P>
                                Because we only use strictly necessary cookies, disabling them will prevent
                                you from signing in to the XEYGATE dashboard. You can manage or delete
                                cookies through your browser settings at any time.
                            </P>
                            <P>
                                Most browsers allow you to block or delete cookies. Refer to your
                                browser's help documentation for instructions. Note that blocking our
                                session cookies will prevent authentication but you can still browse the
                                public marketplace and API documentation.
                            </P>
                        </>
                    )
                },
                {
                    heading: "6. Changes to this policy",
                    body: (
                        <P>
                            If we introduce new cookies or change how existing ones are used, we will
                            update this policy and, where required, request your consent before
                            activating non-essential cookies.
                        </P>
                    )
                },
                {
                    heading: "7. Contact",
                    body: (
                        <P>
                            Questions about this Cookie Policy can be directed to{" "}
                            <Strong>legal@xeycompany.com</Strong>.
                        </P>
                    )
                }
            ]}
        />
    );
}
