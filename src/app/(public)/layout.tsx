// app/(public)/layout.tsx
import Navbar from "@/src/components/navbar/Navbar";
import Script from "next/script";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Script
        id="Cookiebot"
        src="https://consent.cookiebot.com/uc.js"
        data-cbid="46100342-644f-4d6b-834b-75f8c5230dfa"
        data-blockingmode="auto"
        type="text/javascript"
        strategy="beforeInteractive"
      />
      <Navbar />
      <main>{children}</main>
      {/* Aquí podrías añadir un Footer más adelante */}
    </>
  );
}