import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Motive · Vehicle Service Intelligence",
  description: "Your garage, service history and next maintenance — connected.",
};
export default function Layout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
