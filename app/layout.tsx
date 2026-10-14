import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gaming HQ — Your games, your space",
  description: "A calmer home for your game library, personal categories, notes and links."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
