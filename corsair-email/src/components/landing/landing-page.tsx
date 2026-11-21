"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { AsciiMountainsHero } from "@/components/landing/ascii-mountains";
import { AsciiDissolveImage } from "@/components/landing/ascii-dissolve-image";

import { useTheme } from "@/components/theme-provider";
import { ROUTES } from "@/lib/routes";
import "./landing-page.css";
import { ProductDemo } from "./product-demo";

function LandingFeatureIcon({ number }: { number: string }) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-4 w-4 text-[var(--text-secondary)]">
    {number === "01" ? <><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></> : number === "02" ? <><path d="M9.937 15.5a2 2 0 0 0-1.437-1.438l-6.135-1.582a.5.5 0 0 1 0-.96L8.5 9.937A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .96 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.582a.5.5 0 0 1 0 .96L15.5 14.063a2 2 0 0 0-1.438 1.437l-1.582 6.135a.5.5 0 0 1-.96 0z" /><path d="M20 3v4m2-2h-4M4 17v2m1-1H3" /></> : <><path d="m12.83 2.18 8.55 4.86a1.1 1.1 0 0 1 0 1.92l-8.55 4.86a1.69 1.69 0 0 1-1.66 0L2.62 8.96a1.1 1.1 0 0 1 0-1.92l8.55-4.86a1.69 1.69 0 0 1 1.66 0Z" /><path d="m2 12 9.17 5.18a1.69 1.69 0 0 0 1.66 0L22 12M2 17l9.17 5.18a1.69 1.69 0 0 0 1.66 0L22 17" /></>}
  </svg>;
}

export function LandingPage() {
  const { resolvedTheme: theme, setResolvedTheme } = useTheme();
  const [proposalConfirmed, setProposalConfirmed] = useState(false);
  const [proposalInstant, setProposalInstant] = useState(false);

  const toggleTheme = () =>
    setResolvedTheme(theme === "dark" ? "light" : "dark");

  const isDark = theme === "dark";
  const brandName = "NovusMail";
  const imgDir = `/images/${theme}`;

  return (
    <div
      className="landing-page selection:bg-[var(--btn-bg)] selection:text-[var(--btn-text)]"
      data-theme-mode={theme}
    >
      <a className="landing-skip" href="#main-content">
        Skip to content
      </a>
      {/* Top Navbar */}
      <header className="relative z-20 mx-auto flex max-w-6xl items-center justify-between px-6 py-5 text-xs">
        <a
          href="#"
          className="font-serif-display text-2xl tracking-tight text-[var(--text-primary)] transition-opacity hover:opacity-80"
        >
          {brandName}
        </a>

        <nav className="hidden items-center gap-8 text-[var(--text-secondary)] md:flex">
          <a
            href="#workspace"
            className="transition-colors hover:text-[var(--text-primary)]"
          >
            {isDark ? "Workspace" : "Features"}
          </a>
          <a
            href="#how-it-works"
            className="transition-colors hover:text-[var(--text-primary)]"
          >
            How it works
          </a>
          <a
            href="#control"
            className="transition-colors hover:text-[var(--text-primary)]"
          >
            {isDark ? "Your control" : "For creators"}
          </a>
        </nav>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleTheme}
            className="nm-control"
            aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
          >
            {isDark ? "Light mode" : "Dark mode"}
          </button>
          <a
            href={ROUTES.start}
            className="hidden px-2 text-xs text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] sm:inline"
          >
            Sign in
          </a>
          <a href={ROUTES.start} className="nm-glaze" data-tone="silver" data-size="small">
            Get started
          </a>
        </div>
      </header>

      {/* Hero Section with High-Density Side-Framed ASCII Mountains */}
      <main id="main-content">
        <section className="relative overflow-hidden pt-6 pb-6">
          <AsciiMountainsHero theme={theme} cellSize={6} centerGap={0.28} />
          <img
            className="landing-hero-poster"
            src={`${imgDir}/doop-hero.png`}
            alt=""
            aria-hidden="true"
            width={1440}
            height={873}
          />

          <div className="pointer-events-none relative z-10 mx-auto flex max-w-3xl flex-col items-center px-6 pt-3 pb-7 text-center">
            <h1 className="font-serif-display text-5xl leading-[0.94] tracking-tight text-[var(--text-primary)] sm:text-6xl md:text-[68px]">
              Less inbox. More headspace.
              <br />
              Make room for your day.
            </h1>

            <p className="mt-4 max-w-md text-xs leading-relaxed text-[var(--text-secondary)] sm:text-[13px]">
              {isDark ? (
                <>
                  Your email, your calendar, and an assistant that prepares the
                  next step.
                  <br className="hidden sm:inline" /> A calmer way to get
                  through the work behind your work.
                </>
              ) : (
                <>
                  NovusMail helps you control, organize, and get more from your
                  inbox with less effort.
                  <br className="hidden sm:inline" /> A calmer, more focused way
                  to manage the emails that actually matter.
                </>
              )}
            </p>

            <a href="#workspace" className="pointer-events-auto mt-6 nm-glaze">
              {isDark ? "Find your focus" : "Try NovusMail free"}
            </a>

          </div>

          <ProductDemo theme={theme} />
        </section>

        {/* Integration Bar */}
        <section className="mx-auto max-w-5xl px-6 py-7">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border-subtle)] pb-6 landing-integrations text-xs text-[var(--text-secondary)]">
            <span>Works with the tools you already use</span>
            <div className="flex items-center gap-12 font-serif-display text-xl text-[var(--text-primary)]">
              <span>Gmail</span>
              <span>Google Calendar</span>
            </div>
            <span>
              {isDark ? "Connected through Corsair" : "Connects through OAuth"}
            </span>
          </div>
        </section>

        {/* Editorial Statement */}
        <section
          id="how-it-works"
          className="mx-auto max-w-3xl px-6 pt-8 pb-6 text-center"
        >
          <h2 className="font-serif-display text-4xl leading-[1.02] tracking-tight sm:text-5xl">
            Conversations become plans.
            <br />
            Plans become an open afternoon.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-xs leading-relaxed text-[var(--text-secondary)]">
            {isDark
              ? "Find the thread. Prepare the reply. Make time for what comes next. Your context stays together, and the final say stays yours."
              : "From quick replies to bigger next steps, NovusMail keeps the context, reduces noise, and turns today's messages into time for what matters."}
          </p>
        </section>

        {/* Full-Bleed Misty Mountain Ridge Section */}
        <section className="group relative my-6 h-[380px] w-full overflow-hidden sm:h-[430px]">
          <AsciiDissolveImage
            src={`${imgDir}/misty-ridge.webp`}
            reducedMotionSrc={`${imgDir}/doop-misty-ridge.png`}
            alt="Misty monochrome mountain valleys"
            theme={theme}
            variant="fullbleed"
          />

          <div className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-r from-[var(--bg-page)]/92 via-[var(--bg-page)]/40 to-transparent" />

          <div className="relative z-10 mx-auto flex h-full max-w-5xl flex-col justify-center px-6">
            <h3 className="font-serif-display text-4xl leading-[1.0] tracking-tight sm:text-5xl">
              The assistant prepares.
              <br />
              You decide.
            </h3>
            <p className="mt-4 max-w-xs text-xs leading-relaxed text-[var(--text-secondary)]">
              {isDark
                ? "A reply is a draft. A meeting is a proposal. Review every detail before it leaves your workspace."
                : "A simple, thoughtful assistant for your inbox. It helps you stay ahead without taking over your decisions."}
            </p>
            <a
              href="#control"
              className="mt-5 w-fit border-b border-[var(--text-primary)] pb-0.5 text-xs italic text-[var(--text-primary)] transition-opacity hover:opacity-75"
            >
              {isDark
                ? "Nothing sent without your review"
                : "See how your inbox can feel calmer"}
            </a>
          </div>
        </section>

        {/* Three-Column Feature Cards */}
        <section id="workspace" className="mx-auto max-w-5xl px-6 py-14">
          <div className="text-center">
            <h2 className="font-serif-display text-4xl tracking-tight sm:text-5xl">
              One calm place for your day.
            </h2>
            <p className="mt-2 text-xs text-[var(--text-secondary)]">
              {isDark
                ? "Less switching between tabs. More context for every next step."
                : "Less context switching, more flow. Your inbox, tasks, and notes in one place."}
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
            {[
              {
                num: "01",
                title: "Read with context",
                body: isDark
                  ? "Priority threads, unread messages, and drafts in one focused inbox."
                  : "See the key details, related messages, and to-dos in one focused view.",
              },
              {
                num: "02",
                title: isDark
                  ? "Draft with an assistant"
                  : "Draft with intention",
                body: isDark
                  ? "Prepare a reply using the conversation already in front of you."
                  : "Create clear, on-brand replies in seconds with the right context.",
              },
              {
                num: "03",
                title: "Make time together",
                body: isDark
                  ? "Check your agenda and review a proposed meeting beside the thread."
                  : "Turn long email threads into plans and next steps without the back and forth.",
              },
            ].map((card) => {
              return (
                <div
                  key={card.num}
                  className="landing-feature group rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 transition-colors duration-200"
                >
                  <div className="mb-4 flex items-center justify-between text-[11px] font-mono-ascii text-[var(--text-muted)]">
                    <span>{isDark ? card.num : ""}</span>
                    <LandingFeatureIcon number={card.num} />
                  </div>
                  <h3 className="font-serif-display text-2xl text-[var(--text-primary)]">
                    {card.title}
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)]">
                    {card.body}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Split Command Section with Alpine Peak Stock Image */}
        <section id="control" className="mx-auto max-w-5xl px-6 py-12">
          <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-12">
            <div className="md:col-span-5">
              <h2 className="font-serif-display text-4xl leading-[1.02] tracking-tight sm:text-5xl">
                A small command.
                <br />A little more afternoon.
              </h2>
              <p className="mt-4 text-xs leading-relaxed text-[var(--text-secondary)]">
                {isDark
                  ? `Ask in your own words. ${brandName} brings the conversation and calendar together, then prepares a next step you can review.`
                  : "Ask a question, draft a reply, or turn a long thread into an action with a simple command. NovusMail is designed to give you time back, not more to manage."}
              </p>
              <a href={ROUTES.start} className="mt-6 nm-glaze">
                {isDark ? "Open your workspace" : "Create your first command"}
              </a>
            </div>

            <div className="md:col-span-7">
              <div className="group relative h-[290px] overflow-hidden rounded-[22px] sm:h-[320px]">
                <AsciiDissolveImage
                  src={`${imgDir}/alpine-peak.webp`}
                  reducedMotionSrc={`${imgDir}/doop-alpine-peak.png`}
                  alt="Alpine mountain peak above misty pine forest"
                  theme={theme}
                  variant="card"
                />

                <div className="relative z-10 flex h-full items-center justify-center p-5">
                  <div className="w-full max-w-xs rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card-elevated)]/92 p-4 shadow-2xl backdrop-blur-xl">
                    <div className="border-b border-[var(--border-subtle)] pb-2.5 text-[11px] text-[var(--text-secondary)]">
                      {isDark
                        ? "Schedule a launch review with Ari"
                        : "/create a plan for next week with N..."}
                    </div>
                    <div className="mt-2.5 flex items-center justify-between text-[11px]">
                      <span className="text-[var(--text-secondary)]">
                        {isDark ? "Calendar checked" : "Create the plan"}
                      </span>
                      <span className="landing-status inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium">
                        <Check className="h-3 w-3" />{" "}
                        {isDark ? "Free at 3 PM" : "Takes ~30s"}
                      </span>
                    </div>
                    <div className="landing-proposal-title mt-3 font-serif-display text-xl text-[var(--text-primary)]">
                      <span
                        aria-hidden={proposalConfirmed}
                        className={proposalConfirmed ? "invisible" : undefined}
                      >
                        Launch review
                      </span>
                      <span
                        aria-hidden={!proposalConfirmed}
                        className={!proposalConfirmed ? "invisible" : undefined}
                      >
                        Proposal ready for review
                      </span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
                      Today · 3:00–3:30 PM · Ari Morgan
                    </div>
                    <button
                      type="button"
                      onClick={(event) => {
                        setProposalInstant(event.detail === 0);
                        setProposalConfirmed((prev) => !prev);
                      }}
                      className="landing-proposal-action mt-4 w-full nm-glaze"
                      data-confirmed={proposalConfirmed}
                      data-instant={proposalInstant}
                      data-tone="sage"
                      data-size="small"
                      aria-pressed={proposalConfirmed}
                    >
                      <Check
                        className="landing-proposal-check h-3.5 w-3.5"
                        aria-hidden="true"
                      />
                      {proposalConfirmed
                        ? "Proposal ready to send"
                        : isDark
                          ? "Review proposal"
                          : "Run the command"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Bottom Panoramic CTA Banner */}
        <section id="get-started" className="mx-auto max-w-5xl px-6 pt-8 pb-16">
          <div className="group relative h-[240px] overflow-hidden rounded-[22px] sm:h-[260px]">
            <AsciiDissolveImage
              src={`${imgDir}/panorama.webp`}
              reducedMotionSrc={`${imgDir}/doop-panorama.png`}
              alt="Panoramic misty mountain ridges"
              theme={theme}
              variant="banner"
            />
            <div className="pointer-events-none absolute inset-0 z-[1] bg-[var(--bg-page)]/20" />
            <div className="relative z-10 flex h-full flex-col items-center justify-center px-6 text-center">
              <h2 className="font-serif-display text-4xl leading-[1.02] tracking-tight text-[var(--text-primary)] sm:text-5xl">
                Your next open afternoon
                <br />
                starts here.
              </h2>
              <a href={ROUTES.start} className="mt-5 nm-glaze">
                {isDark ? "Meet your workspace" : "Meet your inbox again"}
              </a>
            </div>
          </div>
        </section>
      </main>
      {/* Minimal Footer */}
      <footer className="border-t border-[var(--border-subtle)]">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-xs text-[var(--text-secondary)]">
          <span className="font-serif-display text-lg text-[var(--text-primary)]">
            {brandName}
          </span>
          <span>
            {isDark
              ? "A little less inbox. A little more day."
              : "A calmer inbox leads to a freer, more open day."}
          </span>
          <div className="flex items-center gap-6">
            <a
              href={ROUTES.privacy}
              className="transition-colors hover:text-[var(--text-primary)]"
            >
              Privacy
            </a>
            <a
              href={ROUTES.terms}
              className="transition-colors hover:text-[var(--text-primary)]"
            >
              Terms
            </a>
            <a
              href="https://github.com/GhostInHex/novus-mail/issues"
              className="transition-colors hover:text-[var(--text-primary)]"
            >
              Get in touch
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
