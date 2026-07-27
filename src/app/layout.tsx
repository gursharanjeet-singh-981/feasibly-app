import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Feasibly — Project Estimation Tool",
  description:
    "Build accurate design-to-code project estimates in minutes using structured inputs tailored for design workflows.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
