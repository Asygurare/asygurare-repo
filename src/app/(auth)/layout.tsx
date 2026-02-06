// app/(auth)/layout.tsx
export default function AuthLayout({
    children,
  }: {
    children: React.ReactNode;
  }) {
    return (
      <div className="bg-[#ece7e2] min-h-screen">
        {children}
      </div>
    );
  }