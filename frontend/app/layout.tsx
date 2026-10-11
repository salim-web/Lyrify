import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lyrify - Real-Time Synced Lyrics",
  description: "Transform any audio track into fluid, word-synced karaoke lyrics.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="antialiased bg-black text-white font-sans">
        {children}
      </body>
    </html>
  );
}
