import type { Metadata, Viewport } from "next";
import { Sora, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const sora = Sora({ variable: "--font-sora", subsets: ["latin"], weight: ["600", "700", "800"] });
const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"], weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: "Dawai Bill Checker — دوائی بل چیکر",
  description: "Scan the pharmacy QR, upload your doctor's slip or type medicine names, and see your medicine bill before you buy. Budget-friendly bill adjustment in Urdu and Roman Urdu.",
};

// Pinch-zoom deliberately ENABLED: no user-scalable=no and no maximum-scale.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sora.variable} ${jakarta.variable}`}>
      <body className="min-h-screen bg-white text-neutral-900 antialiased">
        <div className="overflow-x-clip">{children}</div>
      </body>
    </html>
  );
}
