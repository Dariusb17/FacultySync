import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FacultySync — Voice Agent for University Offices",
  description:
    "Multi-tenant Vapi voice agent that lets students book office-hours slots by phone.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ro">
      <body>{children}</body>
    </html>
  );
}
