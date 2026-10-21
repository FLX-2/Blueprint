import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import { ServiceWorker } from "@/components/offline";
import { DEFAULT_THEME, themeInitScript } from "@/lib/theme";
import "./globals.css";
import { ViewTransitionGuard } from "@/components/view-transition-guard";
import { AiStatusProvider } from "@/components/ai-status";
import { liveAiEnabled } from "@/lib/ai/status";

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Blueprint",
    template: "%s · Blueprint",
  },
  description:
    "Paste any strength program and it runs itself. Ask your training history anything.",
  // Added to the home screen on iOS, it opens full screen like an app (icon: app/apple-icon.png).
  appleWebApp: { capable: true, title: "Blueprint", statusBarStyle: "black" },
};

export const viewport: Viewport = {
  // Dark by default, so the browser chrome and status bar match the app.
  themeColor: "#121311",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-theme={DEFAULT_THEME}
      suppressHydrationWarning
      className={`${newsreader.variable} ${geist.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full">
        <AiStatusProvider live={liveAiEnabled()}>{children}</AiStatusProvider>
        <ServiceWorker />
        <ViewTransitionGuard />
      </body>
    </html>
  );
}
