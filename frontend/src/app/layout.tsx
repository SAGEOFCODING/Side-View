import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SideView | Watch Together",
  description: "Synchronized long-distance watching with live emotional presence.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased dark"
    >
      <body className="min-h-full flex flex-col bg-black text-white">{children}</body>
    </html>
  );
}
