'use client';

import React, { useEffect, useState } from 'react';
import { FaInfoCircle } from 'react-icons/fa';
import { useTheme } from '@/context/ThemeContext';
import SurahList from '@/components/SurahList';
import SurahContent from '@/components/SurahContent';
import { 
  Surah, 
  Ayah, 
  getAllSurahs, 
  getSurahWithEditions 
} from '@/services/alquran-api';

export default function QuranPage() {
  // State variables for surahs and selected surah
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [selectedSurah, setSelectedSurah] = useState<Surah | null>(null);
  const [ayahs, setAyahs] = useState<Ayah[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingAyahs, setLoadingAyahs] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { theme } = useTheme();

  // Fetch all surahs when component mounts
  useEffect(() => {
    fetchSurahs();
    
    // Optimizations for iOS devices when app is added to home screen
    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
    
    // @ts-ignore: 'standalone' exists on Safari iOS but not in standard type definition
    const isStandalone = typeof window !== 'undefined' && window.navigator && window.navigator.standalone === true;
    
    if (isIOS) {
      // When app is in standalone mode on iOS, we need to handle audio differently
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          // Audio handling for visibility change would be in SurahContent component
        }
      });
    }
    
    // For iOS, we need to enable audio playback in advance on first user interaction
    if (isIOS) {
      // Function to initialize audio on iOS
      const initializeIOSAudio = () => {
        const silentAudio = new Audio();
        silentAudio.src = "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4LjIwLjEwMAAAAAAAAAAAAAAA//tUwAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAABAAADQgD///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////8AAAA5TEFNRTMuMTAwBK8AAAAAAAAAABUgJAUHQQAB9gAAA0LJ5EPfAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
        silentAudio.volume = 0.001;
        silentAudio.autoplay = true;
        silentAudio.onended = () => {
          document.body.removeEventListener('click', initializeIOSAudio);
          document.body.removeEventListener('touchstart', initializeIOSAudio);
        };
        silentAudio.play().catch(err => console.log('Failed to initialize audio:', err));
      };

      // Add event listeners for first interaction
      document.body.addEventListener('click', initializeIOSAudio, { once: true });
      document.body.addEventListener('touchstart', initializeIOSAudio, { once: true });
      
      // Cleanup
      return () => {
        document.body.removeEventListener('click', initializeIOSAudio);
        document.body.removeEventListener('touchstart', initializeIOSAudio);
      };
    }
  }, []);

  // Fetch all surahs from the API
  const fetchSurahs = async () => {
    try {
      setLoading(true);
      const data = await getAllSurahs();
      setSurahs(data);
    } catch (err) {
      setError("Impossible de charger les sourates. Veuillez réessayer plus tard.");
    } finally {
      setLoading(false);
    }
  };

  // Fetch ayahs for a specific surah
  const fetchAyahs = async (surah: Surah) => {
    try {
      setLoadingAyahs(true);
      
      // Fetch the surah in multiple editions (Arabic text and French translation)
      const editionsResult = await getSurahWithEditions(surah.number, ['quran-uthmani', 'fr.hamidullah']);
      
      const arabicAyahs = editionsResult['quran-uthmani'] || [];
      const frenchAyahs = editionsResult['fr.hamidullah'] || [];
      
      // Combine the data
      const combinedAyahs = arabicAyahs.map((ayah, index) => ({
        ...ayah,
        translation: frenchAyahs[index]?.text || '',
      }));
      
      setAyahs(combinedAyahs);
    } catch (err) {
      setError("Impossible de charger les versets. Veuillez réessayer plus tard.");
    } finally {
      setLoadingAyahs(false);
    }
  };

  // Handle surah selection
  const handleSurahSelect = (surah: Surah) => {
    setSelectedSurah(surah);
    fetchAyahs(surah);
  };

  // Render the Quran page
  return (
    <div className="px-4 py-6">
      {!selectedSurah && (
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">Le Saint Coran</h1>
          <p className="text-gray-600 dark:text-gray-400">Explorer et écouter le Saint Coran</p>
        </div>
      )}

      {error && selectedSurah && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 p-4 rounded-xl mb-6 shadow-sm">
          <p>{error}</p>
        </div>
      )}

      {selectedSurah ? (
        <SurahContent
          surah={selectedSurah}
          ayahs={ayahs}
          loading={loadingAyahs}
          error={error}
          onBack={() => setSelectedSurah(null)}
        />
      ) : (
        <SurahList
          surahs={surahs}
          loading={loading}
          error={error}
          onSurahSelect={handleSurahSelect}
          onRetry={fetchSurahs}
        />
      )}
    </div>
  );
}