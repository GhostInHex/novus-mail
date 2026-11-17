import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";

export function SiteHeader() {
  return (
    <header className="doop-site-nav">
      <Link href={ROUTES.home} className="doop-site-brand">
        NovusMail
      </Link>
      <nav aria-label="Main navigation">
        <Link href="/#workspace">The workspace</Link>
        <Link href="/#how-it-works">How it works</Link>
        <Link href="/#control">Your control</Link>
      </nav>
      <Button asChild className="doop-public-primary">
        <Link href={ROUTES.start}>
          <span>Open workspace</span>
        </Link>
      </Button>
    </header>
  );
}
export function SiteFooter() {
  return (
    <footer className="doop-site-footer">
      <span>NovusMail / A little less inbox. A little more day.</span>
      <nav aria-label="Legal">
        <Link href={ROUTES.privacy}>Privacy</Link>{" "}
        <Link href={ROUTES.terms}>Terms</Link>{" "}
        <a href="https://github.com/GhostInHex/novus-mail/issues">
          Get in touch
        </a>
      </nav>
    </footer>
  );
}
