import {
  ArrowRightIcon,
  CalendarDaysIcon,
  CheckCircle2Icon,
  CommandIcon,
  MailIcon,
  SearchIcon,
  SendIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from "lucide-react";
import Link from "next/link";

import { NovusLogo } from "@/components/novus-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";

type AuthLandingProps = {
  googleEnabled: boolean;
  allowEmailLogin: boolean;
  demoEnabled: boolean;
  loginError?: boolean;
};

const PRODUCT_PILLARS = [
  {
    title: "One surface for mail and calendar",
    body: "Scan priority threads, inspect today's meetings, and turn a conversation into a calendar event without leaving the deck.",
    icon: CalendarDaysIcon,
  },
  {
    title: "Commands when the queue gets noisy",
    body: "Search, label, draft, schedule, and triage from a command-first workspace built for operators who repeat the same work all day.",
    icon: CommandIcon,
  },
  {
    title: "AI that asks before it acts",
    body: "NovusMail can propose replies and events, but mutating actions move through explicit confirmations before anything is sent or created.",
    icon: ShieldCheckIcon,
  },
];

const WORKFLOW_STEPS = [
  {
    title: "Scan the live queue",
    body: "Priority bands, unread state, starred threads, and calendar context stay visible in the same working surface.",
  },
  {
    title: "Ask for the next move",
    body: "Use search, command parsing, or the AI operator to draft a reply, find a thread, or prepare a meeting.",
  },
  {
    title: "Approve the mutation",
    body: "Every send and calendar creation resolves through a clear review state so the user stays in control.",
  },
];

const CONTROL_POINTS = [
  "Tenant-scoped Gmail and Calendar connections",
  "Local-first cached reads with live Google fallback",
  "Proposal-based agent actions for email and events",
  "Visible loading, errors, sync state, and confirmation history",
];

const PREVIEW_THREADS = [
  {
    sender: "Ari Morgan",
    subject: "Can we move launch review to 3?",
    snippet: "Calendar conflict detected. Two open windows available this afternoon.",
    time: "4m",
    state: "Needs reply",
    active: true,
  },
  {
    sender: "Design Ops",
    subject: "Approval pass for onboarding copy",
    snippet: "AI drafted a response, waiting for confirmation before send.",
    time: "18m",
    state: "Draft ready",
    active: false,
  },
  {
    sender: "Mika Patel",
    subject: "Follow-up from investor sync",
    snippet: "High priority because the thread mentions tomorrow's board packet.",
    time: "42m",
    state: "High",
    active: false,
  },
];

const PREVIEW_EVENTS = [
  { title: "Launch review", time: "Today, 3:00 PM", status: "Tentative" },
  { title: "Hiring sync", time: "Today, 4:30 PM", status: "Confirmed" },
  { title: "Board packet review", time: "Tomorrow, 9:00 AM", status: "Draft" },
];

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 18 18" className="size-4" aria-hidden>
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

export function BrandMark({
  compact = false,
  tone = "default",
}: {
  compact?: boolean;
  tone?: "default" | "inverted";
}) {
  void tone;

  return (
    <div className="flex items-center gap-2.5">
      <span className="flex size-9 items-center justify-center overflow-hidden rounded-md bg-[#08071a] shadow-elevation-1 ring-1 ring-white/10">
        <NovusLogo className="size-8" priority />
      </span>
      <div className={cn("leading-tight", compact && "hidden sm:block")}>
        <p className="text-sm font-semibold tracking-tight text-current">NovusMail</p>
        <p className="text-xs text-current/62">Focused command deck</p>
      </div>
    </div>
  );
}

export function AccessPanel({
  googleEnabled,
  allowEmailLogin,
  demoEnabled,
  loginError,
  className,
}: AuthLandingProps & { className?: string }) {
  const hasBothMethods = googleEnabled && (allowEmailLogin || demoEnabled);

  return (
    <aside
      id="access"
      className={cn("scroll-mt-24 rounded-xl border border-border bg-card p-5 text-card-foreground", className)}
      aria-label="Start NovusMail"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold">Start a workspace</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Sign in, connect Gmail and Calendar, then move through the queue from one surface.
          </p>
        </div>
        <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
          Preview
        </span>
      </div>

      {loginError && (
        <p className="mt-5 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Google sign-in did not complete. Please try again.
        </p>
      )}

      {googleEnabled && (
        <form action="/api/auth/google/start" method="get" className="mt-6">
          <input type="hidden" name="redirectTo" value={ROUTES.dashboard} />
          <Button type="submit" size="lg" variant="outline" className="h-11 w-full bg-background">
            <GoogleGlyph />
            Continue with Google
          </Button>
        </form>
      )}

      {hasBothMethods && (
        <div className="my-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-border" />
          <span className="text-xs font-medium text-muted-foreground">or use local dev access</span>
          <span className="h-px flex-1 bg-border" />
        </div>
      )}

      {allowEmailLogin && (
        <>
          <form action="/api/login" method="post" className={cn(!googleEnabled && "mt-6", "space-y-4")}>
            <div className="space-y-2">
              <Label htmlFor="email">Work email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="dave@company.com"
                autoComplete="email"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="displayName">Display name</Label>
              <Input
                id="displayName"
                name="displayName"
                type="text"
                placeholder="Dave"
                autoComplete="name"
                required
              />
            </div>

            <Button type="submit" size="lg" variant={googleEnabled ? "ghost" : "default"} className="h-11 w-full">
              Enter workspace
              <ArrowRightIcon className="size-4" />
            </Button>
          </form>

          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            Local dev access sets a signed session cookie without verifying identity.
          </p>
        </>
      )}

      {demoEnabled && (
        <>
          {(googleEnabled || allowEmailLogin) && (
            <div className="my-5 flex items-center gap-3">
              <span className="h-px flex-1 bg-border" />
              <span className="text-xs font-medium text-muted-foreground">or try the full demo workspace</span>
              <span className="h-px flex-1 bg-border" />
            </div>
          )}

          <form action="/api/demo-login" method="post" className="space-y-3">
            <Button type="submit" size="lg" variant="secondary" className="h-11 w-full">
              Try demo workspace
              <ArrowRightIcon className="size-4" />
            </Button>
          </form>

          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            Demo mode opens a seeded inbox and agenda with safe fake data for testing commands,
            AI, drafts, sends, and event workflows.
          </p>
        </>
      )}

      {!googleEnabled && !allowEmailLogin && (
        <p className="mt-6 rounded-md border border-border bg-muted/40 px-3 py-3 text-sm leading-relaxed text-muted-foreground">
          No sign-in method is configured. Set <code>GOOGLE_OAUTH_CLIENT_ID</code> and{" "}
          <code>GOOGLE_OAUTH_CLIENT_SECRET</code>, or enable <code>ALLOW_EMAIL_LOGIN</code> for local development.
        </p>
      )}
    </aside>
  );
}

function HeroCommandBoard() {
  return (
    <div className="motion-enter relative">
      <div className="motion-drift absolute -right-6 -top-6 hidden h-28 w-28 rounded-full border border-sidebar-border/70 sm:block" />
      <div className="motion-drift absolute -bottom-8 left-10 hidden h-16 w-36 rounded-full bg-sidebar-primary/20 sm:block" />

      <div className="motion-state relative rotate-[-1.5deg] rounded-xl border border-sidebar-border bg-sidebar-accent p-3 text-sidebar-foreground shadow-elevation-2">
        <div className="flex items-center justify-between gap-3 border-b border-sidebar-border pb-3">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-destructive" />
            <span className="size-2 rounded-full bg-sidebar-primary" />
            <span className="size-2 rounded-full bg-success" />
          </div>
          <span className="font-mono text-xs text-sidebar-foreground/58">command deck / live</span>
        </div>

        <div className="grid gap-3 pt-3 lg:grid-cols-[0.78fr_1fr]">
          <div className="space-y-3">
            <div className="rounded-lg bg-sidebar p-3">
              <p className="text-xs font-medium text-sidebar-foreground/58">Focus queue</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight">12 decisions</h2>
            </div>

            {PREVIEW_THREADS.slice(0, 2).map((thread, index) => (
              <div
                key={thread.subject}
                className="motion-enter-soft rounded-lg border border-sidebar-border bg-sidebar p-3"
                style={{ animationDelay: `${index * 60}ms` }}
              >
                <div className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-sidebar-primary" />
                  <p className="min-w-0 flex-1 truncate text-sm font-semibold">{thread.sender}</p>
                  <time className="font-mono text-xs text-sidebar-foreground/54">{thread.time}</time>
                </div>
                <p className="mt-2 truncate text-sm text-sidebar-foreground/76">{thread.subject}</p>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <div className="motion-state rounded-lg bg-card p-4 text-card-foreground">
              <div className="flex items-center gap-2">
                <SparklesIcon className="size-4 text-primary" />
                <p className="text-sm font-semibold">Agent proposal waiting</p>
              </div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Reply at 3:00 PM, update the calendar, and keep current attendees. Nothing leaves until approved.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground">
                  Approve
                </span>
                <span className="inline-flex h-8 items-center rounded-md border border-border px-3 text-sm font-medium">
                  Edit
                </span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-sidebar p-3">
                <p className="text-xs font-medium text-sidebar-foreground/58">Agenda</p>
                <p className="mt-2 text-sm font-semibold">Launch review at 3:00 PM</p>
              </div>
              <div className="rounded-lg bg-sidebar p-3">
                <p className="text-xs font-medium text-sidebar-foreground/58">Control</p>
                <p className="mt-2 text-sm font-semibold">Confirm before send</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="motion-state relative -mt-7 ml-auto w-[82%] rotate-[1.5deg] rounded-xl border border-border bg-card p-3 text-card-foreground shadow-elevation-1">
        <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
          <SearchIcon className="size-4 text-primary" />
          <span className="truncate">find every board thread with calendar impact</span>
          <span className="ml-auto hidden font-mono text-xs sm:inline">Cmd K</span>
        </div>
      </div>
    </div>
  );
}

function OperatingClaims() {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
      <article className="motion-surface rounded-xl bg-sidebar p-6 text-sidebar-foreground">
        <div>
          <p className="text-sm font-semibold text-sidebar-primary">The operating claim</p>
          <h3 className="mt-4 text-balance text-3xl font-semibold leading-tight tracking-[-0.02em] sm:text-4xl">
            Stop treating Gmail like a place to visit.
          </h3>
          <p className="mt-5 max-w-xl text-base leading-8 text-sidebar-foreground/72">
            NovusMail turns the queue into a control surface: priority mail, meeting context, command search, and agent
            proposals are visible before the next decision is made.
          </p>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {["Triage", "Schedule", "Confirm"].map((item) => (
            <div key={item} className="motion-state rounded-lg border border-sidebar-border bg-sidebar-accent p-3">
              <p className="text-xs text-sidebar-foreground/55">Mode</p>
              <p className="mt-2 text-lg font-semibold">{item}</p>
            </div>
          ))}
        </div>
      </article>

      <div className="grid gap-4">
        {PRODUCT_PILLARS.map((pillar, index) => {
          const Icon = pillar.icon;

          return (
            <article
              key={pillar.title}
              className="motion-enter-soft rounded-xl border border-border bg-card p-5 hover:border-primary/20"
              style={{ animationDelay: `${index * 55}ms` }}
            >
              <div className="flex gap-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
                  <Icon className="size-4" />
                </span>
                <div>
                  <h3 className="text-lg font-semibold tracking-tight">{pillar.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{pillar.body}</p>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function WorkflowBoard() {
  return (
    <ol className="mt-10 grid gap-4 lg:grid-cols-[0.9fr_1.1fr_0.9fr]">
      {WORKFLOW_STEPS.map((step, index) => (
        <li
          key={step.title}
          className={cn(
            "motion-enter-soft rounded-xl border border-border bg-background p-6",
            index === 1 && "bg-sidebar text-sidebar-foreground lg:-mt-8",
          )}
          style={{ animationDelay: `${index * 60}ms` }}
        >
          <span
            className={cn(
              "flex size-9 items-center justify-center rounded-md font-mono text-sm",
              index === 1
                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                : "bg-primary text-primary-foreground",
            )}
          >
            {index + 1}
          </span>
          <h3 className="mt-6 text-2xl font-semibold tracking-tight">{step.title}</h3>
          <p
            className={cn(
              "mt-3 text-sm leading-6",
              index === 1 ? "text-sidebar-foreground/70" : "text-muted-foreground",
            )}
          >
            {step.body}
          </p>
        </li>
      ))}
    </ol>
  );
}

function BuiltOnCorsair() {
  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_0.82fr] lg:items-center">
      <div className="motion-surface rounded-xl border border-border bg-card p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg bg-muted p-4">
            <MailIcon className="size-5 text-primary" />
            <h3 className="mt-5 text-base font-semibold">Gmail in context</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Inbox reads, thread detail, labels, draft and send flows, and search through Corsair&apos;s Gmail plugin.
            </p>
          </div>
          <div className="rounded-lg bg-sidebar p-4 text-sidebar-foreground">
            <CalendarDaysIcon className="size-5 text-sidebar-primary" />
            <h3 className="mt-5 text-base font-semibold">Calendar beside mail</h3>
            <p className="mt-2 text-sm leading-6 text-sidebar-foreground/68">
              Agenda lookup, availability, and event proposals stay attached to the thread that created them.
            </p>
          </div>
        </div>
      </div>

      <div className="motion-enter-soft">
        <p className="text-sm font-semibold text-primary">Built on Corsair</p>
        <h2 className="mt-3 text-balance text-4xl font-semibold leading-tight tracking-[-0.02em] sm:text-5xl">
          Real integrations, not a pasted inbox simulation.
        </h2>
        <p className="mt-5 text-pretty text-base leading-8 text-muted-foreground">
          NovusMail runs as a Next.js app over Gmail, Google Calendar, Postgres-backed cache, realtime refresh, and a
          proposal-oriented AI loop. The landing page is the promise; the workspace behind it is the proof.
        </p>
      </div>
    </div>
  );
}

function FinalCta() {
  return (
    <section className="bg-sidebar text-sidebar-foreground">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-5 py-14 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-3xl">
          <h2 className="text-balance text-4xl font-semibold leading-tight tracking-[-0.02em] sm:text-5xl">
            Put the next decision in one place.
          </h2>
          <p className="mt-4 text-base leading-7 text-sidebar-foreground/70">
            Start with Google auth or use the local dev entry path when running the app in development.
          </p>
        </div>
        <Button asChild size="lg" className="h-12 w-full bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 sm:w-fit">
          <Link href={ROUTES.start}>
            Open NovusMail
            <ArrowRightIcon className="size-4" />
          </Link>
        </Button>
      </div>
    </section>
  );
}

function LandingFooter() {
  return (
    <footer className="border-t border-white/10 bg-[#050410] py-16 text-zinc-400">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid gap-10 md:grid-cols-[1fr_minmax(auto,300px)]">
          <div className="space-y-4">
            <div className="text-white">
              <BrandMark tone="inverted" />
            </div>
            <p className="max-w-xs text-sm leading-relaxed text-zinc-500">
              A fresh command center for operators who live in the queue. 
              Manage email and calendar context from a single surface.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:gap-16">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-white">Product</p>
              <ul className="space-y-2 text-sm">
                <li><a href="#product" className="hover:text-white transition-colors text-zinc-400">Workspace</a></li>
                <li><a href="#workflow" className="hover:text-white transition-colors text-zinc-400">Triage Flow</a></li>
                <li><a href="#control" className="hover:text-white transition-colors text-zinc-400">AI Controls</a></li>
              </ul>
            </div>
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-white">Legal & Support</p>
              <ul className="space-y-2 text-sm">
                <li><Link href={ROUTES.privacy} className="hover:text-white transition-colors text-zinc-400">Privacy Policy</Link></li>
                <li><Link href={ROUTES.terms} className="hover:text-white transition-colors text-zinc-400">Terms of Service</Link></li>
                <li><a href="mailto:vinayrpdev@gmail.com" className="hover:text-white transition-colors text-zinc-400">Contact Support</a></li>
              </ul>
            </div>
          </div>
        </div>
        <div className="mt-16 flex flex-col gap-4 border-t border-white/5 pt-8 text-center text-xs sm:flex-row sm:justify-between sm:text-left text-zinc-500">
          <p>&copy; {new Date().getFullYear()} NovusMail. All rights reserved.</p>
          <p className="text-zinc-600">Powered by Corsair integrations.</p>
        </div>
      </div>
    </footer>
  );
}

function WorkspacePreview() {
  return (
    <div
      id="product"
      role="img"
      aria-label="NovusMail workspace preview showing inbox, message detail, agent proposal, and agenda panels."
      className="motion-surface scroll-mt-24 overflow-hidden rounded-xl border border-border bg-card text-card-foreground"
    >
      <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/45 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-destructive" />
          <span className="size-2.5 rounded-full bg-violet-soft" />
          <span className="size-2.5 rounded-full bg-success" />
        </div>
        <div className="hidden items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground sm:flex">
          <SearchIcon className="size-3.5" />
          Search mail, calendar, commands
        </div>
        <span className="font-mono text-xs text-muted-foreground">Cmd K</span>
      </div>

      <div className="grid min-h-[560px] lg:grid-cols-[168px_minmax(260px,0.78fr)_minmax(360px,1fr)_260px]">
        <aside className="motion-enter-soft hidden bg-landing-command p-4 text-landing-command-foreground lg:block">
          <BrandMark compact />
          <div className="mt-8 space-y-1.5 text-sm">
            {["Focus", "Unread", "Starred", "Later"].map((item, index) => (
              <div
                key={item}
                className={cn(
                  "motion-state flex items-center justify-between rounded-md px-3 py-2",
                  index === 0 ? "bg-white/10 text-white" : "text-white/66",
                )}
              >
                <span>{item}</span>
                <span className="font-mono text-xs">{[12, 7, 3, 28][index]}</span>
              </div>
            ))}
          </div>
          <div className="motion-state mt-8 rounded-lg bg-white/10 p-3">
            <p className="text-xs text-white/58">Sync state</p>
            <p className="mt-2 text-sm font-medium">Inbox live</p>
            <p className="mt-1 text-xs leading-relaxed text-white/62">Calendar refreshed 2m ago</p>
          </div>
        </aside>

        <section className="border-b border-border lg:border-b-0 lg:border-r">
          <div className="border-b border-border px-4 py-3">
            <p className="text-xs font-medium text-muted-foreground">Focus queue</p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight">12 threads need a decision</h2>
          </div>
          <div className="divide-y divide-border">
            {PREVIEW_THREADS.map((thread) => (
              <div
                key={thread.subject}
                className={cn("motion-state p-4", thread.active ? "bg-secondary" : "bg-card")}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      thread.active ? "bg-primary" : "bg-muted-foreground/45",
                    )}
                  />
                  <p className="min-w-0 flex-1 truncate text-sm font-semibold">{thread.sender}</p>
                  <time className="text-xs text-muted-foreground">{thread.time}</time>
                </div>
                <p className="mt-1 truncate text-sm font-medium">{thread.subject}</p>
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{thread.snippet}</p>
                <span
                  className={cn(
                    "mt-3 inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                    thread.active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                  )}
                >
                  {thread.state}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="min-w-0 bg-background">
          <div className="border-b border-border px-5 py-4">
            <p className="text-xs text-muted-foreground">Ari Morgan - ari@northstar.co</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">Can we move launch review to 3?</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground">
                Reply
              </span>
              <span className="rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium">
                Schedule
              </span>
              <span className="rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium">
                Archive
              </span>
            </div>
          </div>

          <div className="space-y-4 p-5">
            <article className="motion-state rounded-lg bg-card p-4">
              <p className="text-sm leading-relaxed text-muted-foreground">
                Can we move launch review to 3? The team needs one more pass on the migration notes before we lock the
                packet.
              </p>
            </article>

            <div className="motion-surface rounded-lg bg-landing-command p-4 text-landing-command-foreground">
              <div className="flex items-center gap-2">
                <SparklesIcon className="size-4 text-violet-soft" />
                <p className="text-sm font-semibold">Agent proposal</p>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-white/72">
                Draft a reply confirming 3:00 PM and prepare a 30 minute calendar update with the current attendee list.
              </p>
              <div className="motion-pulse mt-4 rounded-md bg-white/10 p-3">
                <p className="text-xs font-medium text-violet-soft">Pending confirmation</p>
                <p className="mt-1 text-sm leading-relaxed text-white/78">
                  No email sent. No calendar event changed until approved.
                </p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="inline-flex h-8 items-center rounded-md bg-violet-soft px-3 text-sm font-medium text-landing-command">
                  Approve
                </span>
                <span className="inline-flex h-8 items-center rounded-md bg-white/10 px-3 text-sm font-medium">
                  Edit
                </span>
              </div>
            </div>
          </div>
        </section>

        <aside className="hidden border-l border-border bg-card/55 xl:block">
          <div className="border-b border-border px-4 py-3">
            <p className="text-xs font-medium text-muted-foreground">Agenda</p>
            <h2 className="mt-1 text-base font-semibold">Upcoming</h2>
          </div>
          <div className="space-y-3 p-4">
            {PREVIEW_EVENTS.map((event) => (
              <div key={event.title} className="motion-state rounded-lg border border-border bg-card p-3">
                <p className="truncate text-sm font-semibold">{event.title}</p>
                <p className="mt-1 text-xs text-primary">{event.time}</p>
                <p className="mt-2 text-xs text-muted-foreground">{event.status}</p>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

export function AuthLanding() {
  return (
    <main className="landing-theme min-h-dvh bg-background text-foreground">
      <header className="motion-enter-soft sticky top-0 z-30 border-b border-sidebar-border bg-sidebar/96 text-sidebar-foreground backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">
          <BrandMark tone="inverted" />
          <div className="flex items-center gap-3">
            <nav className="hidden items-center gap-6 text-sm text-sidebar-foreground/64 md:flex" aria-label="Primary">
              <a className="motion-state hover:text-sidebar-foreground" href="#product">
                Product
              </a>
              <a className="motion-state hover:text-sidebar-foreground" href="#workflow">
                Workflow
              </a>
              <a className="motion-state hover:text-sidebar-foreground" href="#control">
                Control
              </a>
            </nav>
            <ThemeToggle simple />
            <Button
              asChild
              size="sm"
              className="bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90"
            >
              <Link href={ROUTES.start}>
                Start
                <ArrowRightIcon className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="overflow-hidden bg-sidebar text-sidebar-foreground">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-12 sm:px-8 sm:py-16 lg:grid-cols-[minmax(0,0.95fr)_minmax(420px,0.82fr)] lg:items-center lg:py-24">
          <div className="motion-enter min-w-0">
            <p className="inline-flex items-center gap-2 rounded-full border border-sidebar-border bg-sidebar-accent px-3 py-1 text-sm font-medium text-sidebar-primary">
              <SparklesIcon className="size-3.5" />
              Gmail and Calendar for operators who live in the queue
            </p>
            <h1 className="mt-7 max-w-5xl text-balance text-[clamp(3.8rem,9.2vw,6rem)] font-semibold leading-[0.92] tracking-[-0.038em]">
              A Fresh Command Center for Your Email and Calendar
            </h1>
            <p className="mt-7 max-w-2xl text-pretty text-lg leading-8 text-sidebar-foreground/72">
              Novus comes from the Latin for new, fresh, and young. NovusMail turns that idea into a faster mail
              workspace: priority threads, calendar context, command search, and proposal-based AI in one focused deck
              where every send and schedule change stays explicit.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="h-12 bg-sidebar-primary px-6 text-sidebar-primary-foreground hover:bg-sidebar-primary/90"
              >
                <Link href={ROUTES.start}>
                  Start with NovusMail
                  <ArrowRightIcon className="size-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 border-sidebar-border bg-sidebar-accent px-6 text-sidebar-foreground hover:bg-sidebar-accent/80"
              >
                <a href="#product">See the workspace</a>
              </Button>
            </div>

            <div className="mt-10 grid gap-3 text-sm text-sidebar-foreground/68 sm:grid-cols-3">
              {["Tenant scoped", "Keyboard first", "Confirm before send"].map((item) => (
                <div key={item} className="motion-enter-soft flex items-center gap-2">
                  <CheckCircle2Icon className="size-4 text-success" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <HeroCommandBoard />
        </div>

        <div className="mx-auto max-w-7xl px-5 pb-10 sm:px-8 sm:pb-14">
          <WorkspacePreview />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-22">
        <OperatingClaims />
      </section>

      <section id="workflow" className="scroll-mt-24 border-y border-border bg-card/45">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-22">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-primary">The daily loop</p>
            <h2 className="mt-3 text-balance text-3xl font-semibold leading-tight tracking-[-0.02em] sm:text-4xl">
              Scan, ask, approve. Keep moving.
            </h2>
            <p className="mt-4 text-pretty text-base leading-7 text-muted-foreground">
              NovusMail is not trying to replace the operator. It compresses the workspace around the decisions they
              already make, then makes every irreversible action visible.
            </p>
          </div>

          <WorkflowBoard />
        </div>
      </section>

      <section id="control" className="scroll-mt-24 bg-landing-command text-landing-command-foreground">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[0.82fr_1fr] lg:items-center lg:py-22">
          <div>
            <p className="text-sm font-semibold text-violet-soft">Control is the product</p>
            <h2 className="mt-3 text-balance text-3xl font-semibold leading-tight tracking-[-0.02em] sm:text-4xl">
              AI can prepare the work. You decide what leaves the app.
            </h2>
            <p className="mt-5 max-w-xl text-pretty text-base leading-8 text-white/72">
              The agent can read context, draft mail, and propose calendar changes. Sends and event creation still pass
              through the same explicit review paths as manual work.
            </p>
            <div className="mt-8 grid gap-3">
              {CONTROL_POINTS.map((point, index) => (
                <div
                  key={point}
                  className="motion-enter-soft flex items-center gap-3 text-sm text-white/78"
                  style={{ animationDelay: `${index * 40}ms` }}
                >
                  <CheckCircle2Icon className="size-4 shrink-0 text-violet-soft" />
                  <span>{point}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="motion-surface rounded-xl bg-white/10 p-5 ring-1 ring-white/12">
            <div className="motion-state rounded-lg bg-card p-4 text-card-foreground">
              <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Agent prepared</p>
                  <h3 className="mt-1 text-lg font-semibold tracking-tight">Reply and reschedule</h3>
                </div>
                <SparklesIcon className="size-5 text-primary" />
              </div>
              <div className="mt-4 space-y-3">
                <div className="rounded-md bg-muted p-3">
                  <p className="text-sm font-medium">Email draft</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Confirming 3:00 PM works and attaching the updated migration notes.
                  </p>
                </div>
                <div className="rounded-md bg-muted p-3">
                  <p className="text-sm font-medium">Calendar change</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Move launch review to today at 3:00 PM, keep current attendees.
                  </p>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground">
                  <SendIcon className="size-4" />
                  Approve send
                </span>
                <span className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm font-medium">
                  Edit first
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-22">
        <BuiltOnCorsair />
      </section>

      <FinalCta />
      <LandingFooter />
    </main>
  );
}
