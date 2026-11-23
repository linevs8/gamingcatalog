import type { Metadata } from "next";
import "./playquill-bundle.css";
import GamingHQ from "@/components/GamingHQ";

export const metadata: Metadata = {
  title: "Playquill",
  description: "A personal game journal and library."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><GamingHQ />{children}</body></html>;
}
