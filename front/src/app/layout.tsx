import type { Metadata, Viewport } from "next";
import { DM_Sans, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";

import { SmoothScroll } from "@/components/system/SmoothScroll";

import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-dm-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "verenice — tu equipo de marketing, mientras dormís.",
  description:
    "Verenice es un agente de marketing autónomo para emprendedores. Lee tus ventas, propone campañas y trabaja mientras dormís.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="es"
      className={`${dmSans.variable} ${jetbrainsMono.variable} ${instrumentSerif.variable}`}
    >
      <body>
        <SmoothScroll />
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            className:
              "!bg-bg-card !text-ink !border !border-line !shadow-lift !rounded-xl !font-sans",
            duration: 4000,
          }}
          richColors={false}
          closeButton
        />
      </body>
    </html>
  );
}
