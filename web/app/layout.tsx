import { BASE } from "@/lib/types";
import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";
import { DataProvider } from "@/components/data-provider";
import { Shell } from "@/components/shell";
const dm = DM_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-dm",
});
export const metadata: Metadata = {
  title: {
    default: "Vorthos — A gallery of Magic art",
    template: "%s — Vorthos",
  },
  icons: { icon: BASE + "/icon.svg" },
  description:
    "A place to look at Magic: The Gathering art as art. Explore artworks, artists, moods and colours.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          rel="preload"
          href={BASE + "/data/head.json"}
          as="fetch"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href={BASE + "/data/meta.json"}
          as="fetch"
          crossOrigin="anonymous"
        />
      </head>
      <body className={dm.variable}>
        <DataProvider>
          <Shell>{children}</Shell>
        </DataProvider>
      </body>
    </html>
  );
}
