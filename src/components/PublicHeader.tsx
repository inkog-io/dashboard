"use client";

import Link from "next/link";
import Image from "next/image";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";

export function PublicHeader() {
  return (
    <header className="h-14 border-b border-border bg-background px-6 flex items-center justify-between">
      <Link href="/" className="flex items-center gap-2.5 text-foreground">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
          <Image
            src="/favicon.svg"
            alt="Inkog"
            width={32}
            height={32}
            className="w-8 h-8"
          />
        </div>
        <span className="font-semibold text-lg">Inkog</span>
      </Link>

      <div className="flex items-center gap-3">
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
          <Button asChild size="sm" className="h-8">
            <Link href="/sign-up">Get Started Free</Link>
          </Button>
        </SignedOut>
      </div>
    </header>
  );
}
