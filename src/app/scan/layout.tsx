import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Scan Your AI Agent - Inkog",
  description:
    "Free security scan for AI agent code. Detect prompt injection, data poisoning, missing oversight, and more. Zero setup, results in 60 seconds.",
  openGraph: {
    title: "Scan Your AI Agent for Vulnerabilities",
    description:
      "Free security scan for AI agent code. Detect prompt injection, data poisoning, missing oversight, and more.",
    type: "website",
    siteName: "Inkog",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Inkog AI Agent Security Scanner" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Scan Your AI Agent for Vulnerabilities",
    description:
      "Free security scan for AI agent code. Zero setup, results in 60 seconds.",
    images: ["/og-image.png"],
  },
};

export default function ScanLayout({ children }: { children: React.ReactNode }) {
  return children;
}
