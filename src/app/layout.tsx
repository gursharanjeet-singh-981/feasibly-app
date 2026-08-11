import type { Metadata } from "next";
import "./globals.css";
import { StoreHydration } from "@/components/StoreHydration";

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
    // suppressHydrationWarning prevents false positives from browser extensions that modify <html>/<body>
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col font-sans" suppressHydrationWarning>
        <StoreHydration />
        {children}
      </body>
    </html>
  );
}
