import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Workflow DevKit Minimal",
  description: "Minimal Vercel Workflow DevKit example project.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
