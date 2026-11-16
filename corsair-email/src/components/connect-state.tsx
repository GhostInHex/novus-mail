import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";
import type { ConnectionStatus, SessionUser } from "@/lib/types";
type ConnectStateProps = {
  session: SessionUser;
  status: ConnectionStatus;
  connectionError?: string;
};
const CONNECTION_ERROR_COPY: Record<string, string> = {
  missing_config:
    "This app is not configured for Google data access yet. Ask the app owner to finish setup.",
  oauth_denied: "Access was not granted. Try connecting again.",
  oauth_failed: "The Google connection did not complete. Try again.",
  tenant_mismatch:
    "The Google connection did not match this workspace. Try again.",
};
export function ConnectState({ status, connectionError }: ConnectStateProps) {
  const action = !status.gmail.authorized
    ? "/api/auth/corsair/start/gmail"
    : !status.calendar.authorized
      ? "/api/auth/corsair/start/googlecalendar"
      : ROUTES.connect;
  return (
    <main className="doop-auth">
      <SiteHeader />
      <section className="doop-auth-main">
        <section
          className="doop-access doop-connect-panel"
          aria-labelledby="connect-title"
        >
          <p>Set up your workspace</p>
          <h1 id="connect-title">Connect your everyday tools</h1>
          <p>Bring your conversations and commitments into one place.</p>
          {connectionError && (
            <p role="alert" className="doop-connect-error">
              {CONNECTION_ERROR_COPY[connectionError] ??
                CONNECTION_ERROR_COPY.oauth_failed}
            </p>
          )}
          {status.degraded && (
            <p role="status" className="doop-connect-error">
              Your connection is taking longer than usual. Recheck to continue.
            </p>
          )}
          <div className="doop-connect-status">
            {[
              { label: "Gmail", status: status.gmail },
              { label: "Google Calendar", status: status.calendar },
            ].map(({ label, status }) => (
              <div key={label}>
                {label} /{" "}
                {status.authorized
                  ? status.healthy === false
                    ? "Connection delayed"
                    : "Connected"
                  : "Ready to connect"}
              </div>
            ))}
          </div>
          <Button asChild className="doop-connect-primary">
            <a href={action}>
              {status.gmail.authorized && status.calendar.authorized
                ? "Recheck connection"
                : status.gmail.authorized
                  ? "Connect Google Calendar"
                  : "Connect Google account"}
            </a>
          </Button>
          <p className="doop-connect-review">
            You review replies and new events before they are sent or created.
          </p>
        </section>
      </section>
      <SiteFooter />
    </main>
  );
}
