import type { Metadata } from "next";
import { Rubik } from "next/font/google";
import "./globals.css";
import BottomNavigation from "@/components/BottomNavigation";
import { ThemeProvider } from "@/context/ThemeContext";

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
    <html lang="fr" className="scroll-smooth">
      <body className={`${rubik.className} bg-gray-50 dark:bg-gray-900 transition-colors duration-200`}>
        <ThemeProvider>
          <main className="max-w-md mx-auto min-h-screen pb-20 relative">
            {children}
            <BottomNavigation />
          </main>
        </ThemeProvider>
      </body>
    </html>
  );
}
