import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { PostHogProvider } from "@/components/PostHogProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Inkog Dashboard - Ship Safe Agents",
  description: "Scan. Ship. Comply. Detect vulnerabilities and governance gaps in AI agents before deployment.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body className={inter.className}>
          <ThemeProvider>
            <PostHogProvider>
              {children}
              <Toaster
                position="bottom-right"
                toastOptions={{
                  duration: 5000,
                  classNames: {
                    toast: 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700',
                    title: 'text-gray-900 dark:text-gray-100',
                    description: 'text-gray-500 dark:text-gray-400',
                    error: 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800',
                    success: 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800',
                    warning: 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800',
                    info: 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800',
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
