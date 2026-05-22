import type { Metadata } from "next";
import { Cinzel, DM_Sans } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import JsonLd from "@/components/JsonLd";
import { websiteSchema, organizationSchema } from "@/lib/schema";

const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-cinzel",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-dm-sans",
  display: "swap",
});

const SITE_NAME = "Chronotector";
const SITE_URL = "https://chronotector.com";
const SITE_DESCRIPTION = "Chrono Odyssey MMO News & Guides";

export const metadata: Metadata = {
  title: { default: SITE_NAME, template: `%s - Chrono Odyssey | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  openGraph: {
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    siteName: SITE_NAME,
    url: SITE_URL,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`h-full antialiased ${cinzel.variable} ${dmSans.variable}`}>
      <body className="min-h-full flex flex-col">
        <JsonLd data={[websiteSchema(), organizationSchema()]} />
        <Header siteName={SITE_NAME} />
        <main className="flex-1">{children}</main>
        <Footer siteName={SITE_NAME} />
      </body>
    </html>
  );
}
