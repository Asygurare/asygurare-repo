// app/(public)/layout.tsx
import Footer from "@/src/components/footer/Footer";
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
        id="google-tag-manager"
        type="text/plain"
        data-cookieconsent="statistics,marketing"
        strategy="afterInteractive"
      >
        {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-57N8M6RB');`}
      </Script>
      <noscript>
        <iframe
          data-cookieconsent="statistics,marketing"
          data-src="https://www.googletagmanager.com/ns.html?id=GTM-57N8M6RB"
          height="0"
          width="0"
          style={{ display: "none", visibility: "hidden" }}
        />
      </noscript>
      <Navbar />
      <main>{children}</main>
      <Footer/>
    </>
  );
}