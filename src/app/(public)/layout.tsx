// app/(public)/layout.tsx
import Navbar from "@/src/components/navbar/Navbar";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Navbar />
      <main>{children}</main>
      {/* Aquí podrías añadir un Footer más adelante */}
    </>
  );
}