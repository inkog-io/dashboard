import { SignUp } from "@clerk/nextjs";

export default function SignUpPage({
  searchParams,
}: {
  searchParams: { redirect_url?: string };
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <SignUp
        forceRedirectUrl={searchParams.redirect_url || "/dashboard/scan"}
        appearance={{
          elements: {
            rootBox: "mx-auto",
            card: "shadow-lg",
          },
        }}
      />
    </div>
  );
}
