import { notFound } from "next/navigation";
import { AccessPanel } from "@/components/auth-landing";
import { ConnectState } from "@/components/connect-state";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import LandingPage from "@/app/page";
import PrivacyPage from "@/app/privacy/page";
import TermsPage from "@/app/terms/page";
import { DoopReviewWorkspace } from "./workspace";
import { connection, session } from "./fixtures";

export default async function DoopReviewPage({ searchParams }: { searchParams: Promise<{ scenario?: string }> }) {
  if (process.env.NODE_ENV === "production" || process.env.DOOP_VISUAL_REVIEW !== "1") notFound();
  const { scenario = "inbox" } = await searchParams;
  if (scenario === "landing") return <LandingPage />;
  if (scenario === "privacy") return <PrivacyPage />;
  if (scenario === "terms") return <TermsPage />;
  if (scenario === "connect") return <ConnectState session={session} status={{ ...connection, gmail: { ...connection.gmail, authorized: false }, calendar: { ...connection.calendar, authorized: false }, readyForWorkspace: false }} />;
  if (scenario === "sign-in") return <main className="doop-auth"><SiteHeader /><section className="doop-auth-main"><AccessPanel googleEnabled allowEmailLogin={false} demoEnabled className="doop-access" /></section><SiteFooter /></main>;
  return <DoopReviewWorkspace scenario={scenario} />;
}
