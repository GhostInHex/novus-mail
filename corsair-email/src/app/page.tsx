import { LandingPage } from "@/components/landing/landing-page";
import { ROUTES } from "@/lib/routes";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function HomePage({
  searchParams = Promise.resolve({}),
}: {
  searchParams?: Promise<{ landing?: string }>;
}) {
  const { landing } = await searchParams;
  const session = await getSession();

  if (session && landing !== "1") {
    redirect(ROUTES.dashboard);
  }

  return <LandingPage />;
}
