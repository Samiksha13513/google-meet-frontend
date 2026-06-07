import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { MEET_ICON_URL } from "@/lib/meet-brand";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Google Meet",
  description: "Google Meet video meetings",
  icons: {
    icon: MEET_ICON_URL,
    shortcut: MEET_ICON_URL,
    apple: MEET_ICON_URL,
  },
  openGraph: {
    title: "Google Meet",
    description: "Google Meet video meetings",
    images: [MEET_ICON_URL],
  },
  twitter: {
    card: "summary",
    title: "Google Meet",
    description: "Google Meet video meetings",
    images: [MEET_ICON_URL],
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
