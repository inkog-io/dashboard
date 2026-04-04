import { SignUp } from "@clerk/nextjs";
import { RefCapture } from "./ref-capture";

export default function SignUpPage({
  searchParams,
}: {
  searchParams: { redirect_url?: string; ref?: string };
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      {searchParams.ref && <RefCapture code={searchParams.ref} />}
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
