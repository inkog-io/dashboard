import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { ActivationGuard } from "@/components/ActivationGuard";
import { GitHubAutoLinker } from "@/components/GitHubAutoLinker";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();

  if (!user) {
    redirect("/sign-in");
  }

  const userEmail = user.emailAddresses[0]?.emailAddress;

  return (
    <DashboardShell userEmail={userEmail}>
      <GitHubAutoLinker />
      <ActivationGuard>
        {children}
      </ActivationGuard>
    </DashboardShell>
  );
}
