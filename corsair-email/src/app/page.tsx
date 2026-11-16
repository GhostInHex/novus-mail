import { LandingPage } from "@/components/landing/landing-page";
import { ROUTES } from "@/lib/routes";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const session = await getSession();

  if (session) {
    redirect(ROUTES.dashboard);
  }

  return <LandingPage />;
}
