"use client";

import { useEffect } from "react";

/** Captures the referral code from URL and stores in localStorage */
export function RefCapture({ code }: { code: string }) {
  useEffect(() => {
    if (code) {
      localStorage.setItem("inkog_referred_by", code);
    }
  }, [code]);

  return null;
}
