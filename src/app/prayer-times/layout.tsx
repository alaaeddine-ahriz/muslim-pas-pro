import { Inter } from 'next/font/google';
import React from 'react';
import type { Metadata } from 'next';
import '../globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Horaires de Prière | Muslim Pas Pro',
  description: 'Consultez les horaires de prière des mosquées à proximité.'
};

export default function PrayerTimesLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <main className={`${inter.className} min-h-screen bg-gray-50`}>
      {children}
    </main>
  );
} 