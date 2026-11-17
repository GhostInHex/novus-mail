import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

type AccessPanelProps = {
  googleEnabled: boolean;
  allowEmailLogin: boolean;
  demoEnabled: boolean;
  loginError?: boolean;
  className?: string;
};
export function AccessPanel({
  googleEnabled,
  allowEmailLogin,
  demoEnabled,
  loginError,
  className,
}: AccessPanelProps) {
  return (
    <section
      aria-label="Start NovusMail"
      className={cn("doop-access", className)}
    >
      <div className="doop-access-content">
        <p>Your workspace starts here</p>
        <h1>Make room for your day</h1>
        <p>Sign in to bring Gmail and Google Calendar together.</p>
        {loginError && (
          <p role="alert" className="text-destructive">
            Google sign-in did not complete. Please try again.
          </p>
        )}
        {googleEnabled ? (
          <Button asChild className="doop-public-primary doop-google-action">
            <a
              href={`/api/auth/google/start?redirectTo=${encodeURIComponent(ROUTES.dashboard)}`}
            >
              <span>Continue with Google</span>
            </a>
          </Button>
        ) : (
          <>
            <Button disabled className="doop-public-primary doop-google-action">
              <span>Continue with Google</span>
            </Button>
            <p className="doop-access-warning">
              Google sign-in is not available in this environment.
            </p>
          </>
        )}
        {demoEnabled && (
          <form
            action="/api/demo-login"
            method="post"
            className="doop-demo-form"
          >
            <p>Or explore with an email address</p>
            <label className="sr-only" htmlFor="demo-email">
              Demo email address
            </label>
            <Input
              id="demo-email"
              name="email"
              type="email"
              autoComplete="email"
              spellCheck={false}
              placeholder="you@example.com"
            />
            <Button type="submit" className="doop-public-primary">
              <span>Open demo workspace</span>
            </Button>
          </form>
        )}
        {allowEmailLogin && (
          <details className="doop-local-login">
            <summary className="cursor-pointer text-sm text-muted-foreground">
              Use a local workspace
            </summary>
            <form action="/api/login" method="post" className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Work email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  spellCheck={false}
                  placeholder="you@example.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="displayName">Display name</Label>
                <Input
                  id="displayName"
                  name="displayName"
                  autoComplete="name"
                  required
                />
              </div>
              <Button type="submit" className="w-full">
                Enter workspace
              </Button>
            </form>
            <p className="mt-3 text-xs">
              Local access is for development. It does not verify your identity.
            </p>
          </details>
        )}
        <p>
          By continuing, you agree to the{" "}
          <Link href={ROUTES.terms}>Terms of Service</Link>
          <br className="doop-policy-break" />
          and acknowledge the <Link href={ROUTES.privacy}>Privacy Policy</Link>.
        </p>
      </div>
    </section>
  );
}
