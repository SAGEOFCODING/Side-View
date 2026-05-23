import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { TitleBar } from "@/components/TitleBar";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#09090b",
};

export const metadata: Metadata = {
  title: "SideView | Watch Together",
  description: "Synchronized long-distance watching with live emotional presence. P2P screen sharing and video chat — no signup required.",
  openGraph: {
    title: "SideView | Watch Together",
    description: "Synchronized screen sharing with live emotional presence. Watch together, feel together.",
    type: "website",
    siteName: "SideView",
  },
  twitter: {
    card: "summary_large_image",
    title: "SideView | Watch Together",
    description: "Synchronized screen sharing with live emotional presence.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`h-full antialiased dark ${inter.variable}`}
    >
      <body className="min-h-full flex flex-col bg-black text-white font-sans">
        <TitleBar />
        {children}
      </body>
    </html>
  );
}
