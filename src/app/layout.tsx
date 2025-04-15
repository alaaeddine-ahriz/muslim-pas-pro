import type { Metadata } from "next";
import { Rubik } from "next/font/google";
import "./globals.css";
import BottomNavigation from "@/components/BottomNavigation";
import { ThemeProvider } from "@/context/ThemeContext";

const rubik = Rubik({ 
  subsets: ["latin"],
  display: "swap",
  variable: "--font-rubik",
});

export const metadata: Metadata = {
  title: 'Muslim Prayer App',
  description: 'Application pour les prières musulmanes, le Coran et la direction de la Qibla',
  manifest: '/manifest.json',
  themeColor: '#10b981',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Muslim Prayer App',
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="scroll-smooth">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <link rel="icon" href="/icons/icon-192x192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Muslim Prayer App" />
        <meta name="theme-color" content="#10b981" />
        
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(
                    function(registration) {
                      console.log('Service Worker registration successful with scope: ', registration.scope);
                    },
                    function(err) {
                      console.log('Service Worker registration failed: ', err);
                    }
                  );
                });
              }
            `
          }}
        />
      </head>
      <body className={`${rubik.className} bg-gray-50 dark:bg-gray-900 transition-colors duration-200`}>
        <ThemeProvider>
          <main className="max-w-md mx-auto min-h-screen pb-20 relative">
            {children}
            <BottomNavigation />
          </main>
        </ThemeProvider>
      </body>
    </html>
  )
}
