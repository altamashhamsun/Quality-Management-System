import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Quality Management System",
  description: "ISO 9001 Compliant Quality Management System",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
