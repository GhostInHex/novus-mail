import Link from "next/link";

import { ROUTES } from "@/lib/routes";

export default function TermsPage() {
  return (
    <main className="min-h-dvh bg-background text-foreground">
      <section className="motion-enter mx-auto flex min-h-dvh max-w-3xl flex-col justify-center px-6 py-16">
        <p className="text-sm font-medium text-muted-foreground">Terms of Service</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">NovusMail terms of service</h1>
        <div className="mt-8 space-y-4 text-sm leading-7 text-muted-foreground">
          <p>
            NovusMail is provided as a workspace for managing connected email and calendar accounts. Users are
            responsible for their own account access and content.
          </p>
          <p>
            Actions that send email or create calendar events require explicit confirmation inside the product unless
            the user performs them directly.
          </p>
          <p>
            Replace this placeholder with the final legal text before launch.
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
