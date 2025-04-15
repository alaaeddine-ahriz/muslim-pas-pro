import type { Metadata } from "next";
import { Rubik } from "next/font/google";
import "./globals.css";
import BottomNavigation from "@/components/BottomNavigation";

const rubik = Rubik({ 
  subsets: ["latin"],
  weight: ['300', '400', '500', '600', '700'] 
});

export const metadata: Metadata = {
  title: "Muslim Companion",
  description: "Application d'accompagnement pour les musulmans",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className={`${rubik.className} bg-gray-50`}>
        <main className="max-w-md mx-auto min-h-screen pb-20 relative">
          {children}
          <BottomNavigation />
        </main>
      </body>
    </html>
  );
}
