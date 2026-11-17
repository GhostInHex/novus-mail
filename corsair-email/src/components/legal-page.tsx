import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { PRIVACY_COPY, TERMS_COPY } from "@/components/legal-copy";

export function LegalPage({ kind }: { kind: "privacy" | "terms" }) {
  const copy = kind === "privacy" ? PRIVACY_COPY : TERMS_COPY;
  return (
    <main className="doop-auth">
      <SiteHeader />
      <section
        className="doop-legal doop-legal-source"
        aria-label={copy[0].text}
      >
        {copy.map(({ kind: role, text }) => {
          if (role === "title") return <h1 key={text}>{text}</h1>;
          if (role === "heading") return <h2 key={text}>{text}</h2>;
          return <p key={text}>{text}</p>;
        })}
      </section>
      <SiteFooter />
    </main>
  );
}
