import type { ReactNode } from "react";
import {
  AlertCircleIcon,
  CalendarDaysIcon,
  CheckCircle2Icon,
  CircleDashedIcon,
  MailIcon,
  RefreshCwIcon,
  TerminalIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import type { ConnectionStatus, SessionUser } from "@/lib/types";
import { corsairOAuthRedirectUri } from "@/server/corsair-oauth";

type ConnectStateProps = {
  session: SessionUser;
  status: ConnectionStatus;
  connectionError?: string;
};

const CONNECTION_ERROR_COPY: Record<string, string> = {
  missing_config:
    "This app is not configured for Google data access yet. Ask the app owner to finish setup.",
  oauth_denied: "Google access was not granted. Try connecting again.",
  oauth_failed: "The Google connection did not complete. Try again.",
  tenant_mismatch: "The Google connection did not match this workspace. Try again.",
};

function StatusPill({ label, live }: { label: string; live: boolean }) {
  return (
    <div
      className={cn(
        "motion-state flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium",
        live
          ? "border-success/30 bg-success/10 text-success"
          : "border-border bg-muted text-muted-foreground",
      )}
    >
      {live ? (
        <CheckCircle2Icon className="size-4 motion-enter-soft" />
      ) : (
        <CircleDashedIcon className="size-4 motion-pulse" />
      )}
      {label} {live ? "connected" : "pending"}
    </div>
  );
}

function CommandBlock({ title, children }: { title: string; children: string }) {
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <TerminalIcon className="size-3.5" />
        {title}
      </p>
      <pre className="scroll-area-thin overflow-x-auto rounded-md border border-border bg-muted/60 p-3 font-mono text-xs leading-relaxed text-foreground">
        {children}
      </pre>
    </div>
  );
}

function ConnectAction({
  label,
  description,
  connected,
  action,
  icon,
}: {
  label: string;
  description: string;
  connected: boolean;
  action: string;
  icon: ReactNode;
}) {
  return (
    <div className="motion-state grid gap-4 rounded-md border border-border bg-background p-4 hover:border-primary/25 hover:bg-card/80 sm:min-h-28 sm:grid-cols-[minmax(0,1fr)_11.5rem] sm:items-center">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="font-medium">{label}</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
        </div>
      </div>

      {connected ? (
        <span className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-md bg-success/10 px-4 text-sm font-medium text-success">
          <CheckCircle2Icon className="size-4" />
          Connected
        </span>
      ) : (
        <form action={action} method="get" className="w-full">
          <Button type="submit" className="h-10 w-full">
            Connect {label}
          </Button>
        </form>
      )}
    </div>
  );
}

export function ConnectState({ session, status, connectionError }: ConnectStateProps) {
  const errorMessage = connectionError
    ? CONNECTION_ERROR_COPY[connectionError] ?? CONNECTION_ERROR_COPY.oauth_failed
    : null;
  const showDeveloperDetails = process.env.NODE_ENV !== "production" && status.setupLog;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-6 py-12">
      <Card className="motion-enter w-full max-w-2xl shadow-elevation-2">
        <CardHeader>
          <Badge variant="secondary" className="w-fit">
            Google access
          </Badge>
          <CardTitle className="mt-2 text-2xl">
            Connect Gmail and Calendar
          </CardTitle>
          <CardDescription>
            Give Corsair Mail permission to read, organize, send mail, and manage your
            calendar for{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.8em] text-foreground">
              {session.tenantId}
            </code>
            .
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {errorMessage && (
            <p className="motion-enter-soft flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircleIcon className="mt-0.5 size-4 shrink-0" />
              {errorMessage}
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <StatusPill label="Gmail" live={status.gmail} />
            <StatusPill label="Calendar" live={status.calendar} />
          </div>

          <div className="space-y-3">
            <ConnectAction
              label="Gmail"
              description="Allow inbox search, labels, drafts, sending, and thread actions."
              connected={status.gmail}
              action="/api/auth/corsair/start/gmail"
              icon={<MailIcon className="size-4" />}
            />
            <ConnectAction
              label="Calendar"
              description="Allow agenda lookup, availability checks, and event scheduling."
              connected={status.calendar}
              action="/api/auth/corsair/start/googlecalendar"
              icon={<CalendarDaysIcon className="size-4" />}
            />
          </div>

          {showDeveloperDetails && (
            <details className="motion-surface rounded-md border border-border bg-muted/40 p-3 open:bg-muted/55">
              <summary className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <TerminalIcon className="size-3.5" />
                Developer details
              </summary>
              <div className="mt-3 space-y-3">
                <CommandBlock title="Google Cloud authorized redirect URI">
                  {corsairOAuthRedirectUri()}
                </CommandBlock>
                <CommandBlock title="Corsair setup log">
                  {status.setupLog || "No setup output yet."}
                </CommandBlock>
              </div>
            </details>
          )}

          <div className="flex flex-wrap gap-3 pt-1">
            <form action={ROUTES.connect} method="get">
              <Button type="submit">
                <RefreshCwIcon className="size-4" />
                Recheck connection
              </Button>
            </form>
            <form action="/api/logout" method="post">
              <Button type="submit" variant="ghost">
                Switch workspace
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
