import Link from "next/link";

import { ROUTES } from "@/lib/routes";

export default function TermsPage() {
  return (
    <main className="min-h-dvh bg-background text-foreground">
      <section className="motion-enter mx-auto flex min-h-dvh max-w-3xl flex-col justify-center px-6 py-16">
        <p className="text-sm font-medium text-muted-foreground">Terms of Service</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">NovusMail Terms of Service</h1>
        <p className="mt-2 text-xs text-muted-foreground">Last updated: June 19, 2026</p>
        
        <div className="mt-8 space-y-6 text-sm leading-7 text-muted-foreground">
          <p>
            Welcome to NovusMail. By accessing or using our command-deck application, you agree to be bound by these 
            Terms of Service. If you do not agree to these terms, please do not use the application.
          </p>

          <hr className="border-border" />

          <div>
            <h2 className="text-base font-semibold text-foreground">1. Description of Service</h2>
            <p className="mt-2">
              NovusMail is a keyboard-first, multi-panel workspace built to consolidate and streamline your Gmail and 
              Google Calendar workflows. Features include local-first priority sorting, lightning-fast full-text search, 
              command palette actions, and proposal-based AI assistance.
            </p>
          </div>

          <div>
            <h2 className="text-base font-semibold text-foreground">2. Account Credentials & Google Integration</h2>
            <p className="mt-2">
              Access to NovusMail requires authenticating via Google Sign-In and authorizing access to your Gmail and 
              Google Calendar scopes. You are responsible for:
            </p>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li>Maintaining the confidentiality of your Google Account and password.</li>
              <li>Ensuring the accuracy of the email address associated with your workspace tenant.</li>
              <li>All activities and actions executed within NovusMail using your credentials.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-base font-semibold text-foreground">3. User Control & Explicit Approvals</h2>
            <p className="mt-2">
              Our core product philosophy is to keep you in control of your queue:
            </p>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li><strong>AI Assistant Proposals:</strong> Any action drafted or proposed by the AI operator (such as drafting an email response or planning a new calendar event) is strictly a proposal.</li>
              <li><strong>Explicit Approval:</strong> No email will be sent and no calendar event will be created or mutated without your explicit manual confirmation (e.g., clicking &quot;Approve&quot; or pressing the corresponding shortcut).</li>
              <li>You are solely responsible for reviewing the accuracy and content of any AI-drafted material before giving your approval.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-base font-semibold text-foreground">4. Acceptable Use Policy</h2>
            <p className="mt-2">
              You agree not to use NovusMail to:
            </p>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li>Violate any local, state, national, or international laws.</li>
              <li>Transmit unsolicited email, spam, bulk marketing, or harassing materials.</li>
              <li>Attempt to compromise, disrupt, or bypass the application&apos;s security systems, rate limiters, or database.</li>
              <li>Infringe upon the intellectual property rights of others.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-base font-semibold text-foreground">5. Disclaimers & Limitation of Liability</h2>
            <p className="mt-2 font-mono text-xs border border-border bg-muted/20 p-3 rounded-md">
              THE SERVICE IS PROVIDED ON AN &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; BASIS. WE EXPRESSLY DISCLAIM ALL WARRANTIES 
              OF ANY KIND. WE SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR EXEMPLARY DAMAGES, 
              INCLUDING BUT NOT LIMITED TO DAMAGES FOR LOSS OF PROFITS, GOODWILL, USE, DATA, OR OTHER INTANGIBLE LOSSES 
              RESULTING FROM THE USE OR THE INABILITY TO USE THE SERVICE.
            </p>
            <p className="mt-2">
              We are not responsible for any issues arising from Google API service limits, synchronization delays, 
              or sudden changes to Google Developer terms of service.
            </p>
          </div>

          <div>
            <h2 className="text-base font-semibold text-foreground">6. Termination</h2>
            <p className="mt-2">
              We reserve the right to suspend or terminate your access to the workspace at any time, with or without cause 
              or notice, effective immediately, if we believe you have breached these Terms of Service.
            </p>
          </div>

          <div>
            <h2 className="text-base font-semibold text-foreground">7. Contact Information</h2>
            <p className="mt-2">
              For any questions, issues, or notices regarding these Terms of Service, please contact:
            </p>
            <p className="mt-1 font-medium text-foreground">
              Email: vinayrpdev@gmail.com
            </p>
          </div>
        </div>

        <div className="mt-10 border-t border-border pt-6">
          <Link href={ROUTES.home} className="text-sm font-medium text-primary hover:underline">
            Back to home
          </Link>
        </div>
      </section>
    </main>
  );
}
