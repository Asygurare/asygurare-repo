// app/layout.tsx
import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import localFont from "next/font/local"; // Cal Sans suele ser local o importada así
import Script from "next/script";
import "./globals.css";

// Configuración de fuentes
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Nota: Si Cal_Sans no te carga desde google, asegúrate de tener el paquete instalado 
// o usarlo como variable CSS correctamente.
const calSans = { variable: "--font-cal-sans" }; 

export const metadata: Metadata = {
  title: "Asygurare | El Copiloto del Asesor",
  description: "El ecosistema de seguros para el asesor moderno.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${calSans.variable} ${geistMono.variable} antialiased`}>
        <Script
          id="Cookiebot"
          src="https://consent.cookiebot.com/uc.js"
          data-cbid="46100342-644f-4d6b-834b-75f8c5230dfa"
          data-blockingmode="auto"
          type="text/javascript"
          strategy="afterInteractive"
        />
        {children}
      </body>
    </html>
  );
}