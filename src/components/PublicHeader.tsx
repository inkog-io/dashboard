"use client";

import Link from "next/link";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { Shield } from "lucide-react";

export function PublicHeader() {
  return (
    <header className="h-14 border-b border-border bg-background px-6 flex items-center justify-between">
      <Link href="/" className="flex items-center gap-2 text-foreground">
        <Shield className="h-5 w-5 text-brand" />
        <span className="font-semibold text-lg">Inkog</span>
      </Link>

      <div className="flex items-center gap-4">
        <SignedIn>
          <Link
            href="/dashboard"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Dashboard
          </Link>
          <UserButton afterSignOutUrl="/" />
        </SignedIn>
        <SignedOut>
          <Link
            href="/sign-in"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign In
          </Link>
        </SignedOut>
      </div>
    </header>
  );
}
