import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ElectIQ — Election Intelligence Platform",
  description:
    "AI-powered election intelligence, observation, integrity, and analytics platform.",
};

// Inter is loaded via a runtime <link> rather than next/font/google so the
// production build does not require build-time network access to Google
// Fonts — useful for restricted or air-gapped build environments. Swap this
// for next/font/google (self-hosted, zero layout shift) if your build
// environment has normal internet access and you prefer that approach.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
