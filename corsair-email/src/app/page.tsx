import { AuthLanding } from "@/components/auth-landing";
import { ROUTES } from "@/lib/routes";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const session = await getSession();

  if (session) {
    redirect(ROUTES.dashboard);
  }

  return <AuthLanding />;
}
