import { SiteHeader, SiteFooter } from "@/components/site-chrome";

import { AccessPanel } from "@/components/auth-landing";
import { env, isGoogleLoginConfigured } from "@/lib/env";

type StartPageProps = {
  searchParams: Promise<{ login_error?: string }>;
};

export default async function StartPage({ searchParams }: StartPageProps) {
  const { login_error } = await searchParams;

  return (
    <main className="doop-auth">
      <SiteHeader />
      <section className="doop-auth-main">
        <AccessPanel
          googleEnabled={isGoogleLoginConfigured()}
          allowEmailLogin={env.ALLOW_EMAIL_LOGIN}
          demoEnabled={env.DEMO_LOGIN_ENABLED}
          loginError={login_error === "google"}
          className="doop-access"
        />
      </section>
      <SiteFooter />
    </main>
  );
}
