import type { Metadata } from "next";
import { Inter, Inter_Tight, JetBrains_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { PostHogProvider } from "@/components/PostHogProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Toaster } from "sonner";

import "./globals.css";

const inter = Inter({ subsets: ["latin"] });
const interTight = Inter_Tight({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700"],
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://app.inkog.io"),
  title: "Inkog Dashboard - Ship Safe Agents",
  description: "Scan. Ship. Comply. Detect vulnerabilities and governance gaps in AI agents before deployment.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body className={`${inter.className} ${interTight.variable} ${jetbrainsMono.variable} antialiased`}>
          <ThemeProvider>
            <PostHogProvider>
              {children}
              <Toaster
                position="bottom-right"
                toastOptions={{
                  duration: 5000,
                  classNames: {
                    toast: 'bg-card border border-border',
                    title: 'text-foreground',
                    description: 'text-muted-foreground',
                    error: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/50',
                    success: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800/50',
                    warning: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/50',
                    info: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/50',
                  },
                }}
                richColors
                closeButton
              />
              <SpeedInsights />
            </PostHogProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
