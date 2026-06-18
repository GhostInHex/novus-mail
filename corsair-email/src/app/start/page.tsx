import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";

import { AccessPanel, BrandMark } from "@/components/auth-landing";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { env, isGoogleLoginConfigured } from "@/lib/env";
import { ROUTES } from "@/lib/routes";

type StartPageProps = {
  searchParams: Promise<{ login_error?: string }>;
};

export default async function StartPage({ searchParams }: StartPageProps) {
  const { login_error } = await searchParams;

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <header className="motion-enter-soft mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-5 sm:px-8">
        <BrandMark />
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Button asChild size="sm" variant="ghost">
            <Link href={ROUTES.home}>
              <ArrowLeftIcon className="size-4" />
              Back
            </Link>
          </Button>
        </div>
      </header>

      <section className="motion-enter mx-auto flex min-h-[calc(100dvh-4rem)] max-w-5xl items-center justify-center px-5 py-10 sm:px-8">
        <AccessPanel
          googleEnabled={isGoogleLoginConfigured()}
          allowEmailLogin={env.ALLOW_EMAIL_LOGIN}
          demoEnabled={env.DEMO_LOGIN_ENABLED}
          loginError={login_error === "google"}
          className="w-full max-w-md shadow-elevation-1"
        />
      </section>
    </main>
  );
}
