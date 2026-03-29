import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { AuthProvider } from "@/contexts/auth-context";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "MC — Medical Consultation",
  description: "Professional clinical case consultation for physicians.",
  applicationName: "MC",
};

export const viewport: Viewport = {
  themeColor: "#0d6b6b",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} min-h-dvh antialiased`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
