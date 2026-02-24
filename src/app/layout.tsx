import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { PostHogProvider } from "@/components/PostHogProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Toaster } from "sonner";
import { CookieConsent } from "@/components/CookieConsent";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });
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
        <body className={`${inter.className} ${jetbrainsMono.variable}`}>
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
              <CookieConsent />
            </PostHogProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
