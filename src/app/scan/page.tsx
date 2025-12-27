import { redirect } from "next/navigation";

export default function ScanRedirect() {
  // Redirect to the dashboard scan page
  // Clerk middleware will handle authentication
  redirect("/dashboard/scan");
}
