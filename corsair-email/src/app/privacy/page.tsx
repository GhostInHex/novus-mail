import Link from "next/link";

import { ROUTES } from "@/lib/routes";

export default function PrivacyPage() {
  return (
    <main className="min-h-dvh bg-background text-foreground">
      <section className="motion-enter mx-auto flex min-h-dvh max-w-3xl flex-col justify-center px-6 py-16">
        <p className="text-sm font-medium text-muted-foreground">Privacy Policy</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">NovusMail privacy policy</h1>
        <div className="mt-8 space-y-4 text-sm leading-7 text-muted-foreground">
          <p>
            NovusMail only uses account data to provide email, calendar, and workspace features for the signed-in
            user.
          </p>
          <p>
            We store session, tenant, and application data needed to run the product. OAuth tokens are encrypted and
            handled for the connected workspace only.
          </p>
          <p>
            Contact the site owner before launch to replace this placeholder with your real privacy terms, data
            retention details, and support contact.
          </p>
        </div>
        <div className="mt-10">
          <Link href={ROUTES.home} className="text-sm font-medium text-primary hover:underline">
            Back to home
          </Link>
        </div>
      </section>
    </main>
  );
}
