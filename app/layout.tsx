// app/layout.tsx
import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import localFont from "next/font/local"; // Cal Sans suele ser local o importada así
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
  title: "Techguros | El Copiloto del Asesor",
  description: "Software especializado en seguros con IA, CRM y Funnels.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${calSans.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}