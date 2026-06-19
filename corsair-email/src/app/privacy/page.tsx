import Link from "next/link";

import { ROUTES } from "@/lib/routes";

export default function PrivacyPage() {
  return (
    <main className="min-h-dvh bg-background text-foreground">
      <section className="motion-enter mx-auto flex min-h-dvh max-w-3xl flex-col justify-center px-6 py-16">
        <p className="text-sm font-medium text-muted-foreground">Privacy Policy</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">NovusMail Privacy Policy</h1>
        <p className="mt-2 text-xs text-muted-foreground">Last updated: June 19, 2026</p>
        
        <div className="mt-8 space-y-6 text-sm leading-7 text-muted-foreground">
          <p>
            At NovusMail, we are committed to protecting your privacy. This Privacy Policy describes how we collect, 
            use, disclose, and safeguard your information when you use our command-deck application, which integrates 
            with Gmail and Google Calendar.
          </p>

          <hr className="border-border" />

          <div>
            <h2 className="text-base font-semibold text-foreground">1. Information We Collect</h2>
            <p className="mt-2">
              To provide our keyboard-first inbox and calendar workspace, we access and store the following data:
            </p>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li><strong>Account Identity:</strong> Your email address and display name obtained during Google Sign-In.</li>
              <li><strong>Google API Credentials:</strong> Tenant-scoped OAuth access and refresh tokens used to authenticate requests to Google APIs.</li>
              <li><strong>Workspace Cache:</strong> Temporarily cached Gmail message headers, thread details, labels, and Google Calendar events stored locally in a secure database to enable priority sync, fast search, and offline views.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-base font-semibold text-foreground">2. Google API Data & Limited Use Disclosure</h2>
            <p className="mt-2 font-medium text-foreground bg-muted/40 border-l-2 border-primary p-3 rounded-r-md">
              NovusMail&apos;s use and transfer of information received from Google APIs to any other app will adhere to 
              the <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" className="underline text-primary hover:text-primary/80">Google API Services User Data Policy</a>, 
              including the Limited Use requirements.
            </p>
            <p className="mt-2">
              Specifically, we do not use your Google user data for serving advertisements, and we do not transfer this data 
              to third parties unless required for security, legal compliance, or as part of providing the core workspace features.
            </p>
          </div>

          <div>
            <h2 className="text-base font-semibold text-foreground">3. How We Use Information</h2>
            <p className="mt-2">
              We process your data strictly to deliver the service, including:
            </p>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li>Displaying your unified focus queue, message details, and calendar agenda on a single workspace interface.</li>
              <li>Executing message actions (reply, archive, star, trash) and event mutations directly on your behalf.</li>
              <li>Powering proposal-based AI features to draft emails or draft calendar events. All AI-generated changes require your explicit review and confirmation before leaving the application.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-base font-semibold text-foreground">4. Data Security & Encryption</h2>
            <p className="mt-2">
              Security is foundational to NovusMail. Sensitive credentials (such as Google OAuth refresh tokens) are 
              encrypted at rest in our database using a secure Key Encryption Key (KEK). Data in transit is secured using 
              industry-standard Transport Layer Security (TLS/HTTPS).
            </p>
          </div>

          <div>
            <h2 className="text-base font-semibold text-foreground">5. Data Sharing & AI Providers</h2>
            <p className="mt-2">
              We do not sell, rent, or trade your personal information. We do not use Google API data to train artificial 
              intelligence or machine learning models. If you use the optional AI operator to draft replies or inspect context, 
              only the relevant email thread or calendar snippet is sent to our AI API provider to generate the draft. These 
              providers are contractually bound not to retain or use your data for training.
            </p>
          </div>

          <div>
            <h2 className="text-base font-semibold text-foreground">6. Your Control & Account Deletion</h2>
            <p className="mt-2">
              You can revoke NovusMail&apos;s access to your Google Account at any time via your 
              <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" className="underline text-primary hover:text-primary/80 ml-1">Google Security Settings</a>. 
              To request permanent deletion of your account and cached data from our systems, please contact support at 
              <a href="mailto:vinayrpdev@gmail.com" className="underline text-primary hover:text-primary/80 ml-1">vinayrpdev@gmail.com</a>.
            </p>
          </div>

          <div>
            <h2 className="text-base font-semibold text-foreground">7. Contact Us</h2>
            <p className="mt-2">
              If you have any questions or concerns regarding this Privacy Policy or our data practices, please contact us at:
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
