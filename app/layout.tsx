import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import { MEET_ICON_URL } from "@/lib/meet-brand";
import "./globals.css";

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
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
    <html lang="en" className={`${roboto.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
