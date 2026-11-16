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
      <p>Your workspace starts here</p>
      <h1>Make room for your day</h1>
      <p>Sign in to bring Gmail and Google Calendar together.</p>
      {loginError && (
        <p role="alert" className="mt-4 text-destructive">
          Google sign-in did not complete. Please try again.
        </p>
      )}
      {googleEnabled ? (
        <Button asChild className="mt-5 h-9 w-full">
          <a
            href={`/api/auth/google/start?redirectTo=${encodeURIComponent(ROUTES.dashboard)}`}
          >
            Continue with Google
          </a>
        </Button>
      ) : (
        <>
          <Button disabled className="mt-5 h-9 w-full">
            Continue with Google
          </Button>
          <p className="mt-2 text-xs">
            Google sign-in is not available in this environment.
          </p>
        </>
      )}
      {demoEnabled && (
        <div className="mt-5">
          <p className="mb-5">Or explore the workspace</p>
          <form action="/api/demo-login" method="post">
            <Button type="submit" className="h-9 w-full">
              Open demo workspace
            </Button>
          </form>
        </div>
      )}
      {allowEmailLogin && (
        <details className="mt-5">
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
      <p className="mt-5">
        By continuing, you agree to the{" "}
        <Link href={ROUTES.terms} className="underline underline-offset-4">
          Terms of Service
        </Link>{" "}
        and acknowledge the{" "}
        <Link href={ROUTES.privacy} className="underline underline-offset-4">
          Privacy Policy
        </Link>
        .
      </p>
    </section>
  );
}
