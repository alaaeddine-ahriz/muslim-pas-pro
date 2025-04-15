'use client';

import { useEffect, useState } from 'react';
import { FaPlay, FaPause, FaSearch, FaBookOpen, FaInfoCircle, FaSun, FaMoon } from 'react-icons/fa';
import axios from 'axios';
import { useTheme } from '@/context/ThemeContext';

interface Surah {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  numberOfAyahs: number;
  revelationType: string;
}

interface Ayah {
  number: number;
  text: string;
  audio: string;
  translation?: string;
}

export default function QuranPage() {
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [filteredSurahs, setFilteredSurahs] = useState<Surah[]>([]);
  const [selectedSurah, setSelectedSurah] = useState<Surah | null>(null);
  const [ayahs, setAyahs] = useState<Ayah[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingAyahs, setLoadingAyahs] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playingAyah, setPlayingAyah] = useState<number | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isPlayingFullSurah, setIsPlayingFullSurah] = useState(false);
  const [currentAyahIndex, setCurrentAyahIndex] = useState(0);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    fetchSurahs();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredSurahs(surahs);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredSurahs(
        surahs.filter(
          surah => 
            surah.englishName.toLowerCase().includes(query) ||
            surah.englishNameTranslation.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, surahs]);

  const fetchSurahs = async () => {
    try {
      setLoading(true);
      const response = await axios.get('https://api.alquran.cloud/v1/surah');
      setSurahs(response.data.data);
      setFilteredSurahs(response.data.data);
    } catch (err) {
      setError("Impossible de charger les sourates. Veuillez réessayer plus tard.");
    } finally {
      setLoading(false);
    }
  };

  const fetchAyahs = async (surahNumber: number) => {
    try {
      setLoadingAyahs(true);
      
      // Récupérer le texte arabe
      const arabicResponse = await axios.get(`https://api.alquran.cloud/v1/surah/${surahNumber}`);
      const arabicAyahs = arabicResponse.data.data.ayahs;
      
      // Récupérer la traduction française
      const frenchResponse = await axios.get(`https://api.alquran.cloud/v1/surah/${surahNumber}/fr.hamidullah`);
      const frenchAyahs = frenchResponse.data.data.ayahs;
      
      // Récupérer les audios (utiliser un récitateur populaire)
      const audioResponse = await axios.get(`https://api.alquran.cloud/v1/surah/${surahNumber}/ar.alafasy`);
      const audioAyahs = audioResponse.data.data.ayahs;
      
      // Combiner les données
      const combinedAyahs = arabicAyahs.map((ayah: any, index: number) => ({
        number: ayah.numberInSurah,
        text: ayah.text,
        translation: frenchAyahs[index].text,
        audio: audioAyahs[index].audio,
      }));
      
      setAyahs(combinedAyahs);
    } catch (err) {
      setError("Impossible de charger les versets. Veuillez réessayer plus tard.");
    } finally {
      setLoadingAyahs(false);
    }
  };

  // Préchargement des audios pour une meilleure expérience utilisateur
  const prechargeSurahAudio = async (surahNumber: number) => {
    try {
      // On ne précharge que les 10 premiers versets pour économiser les ressources
      const limit = 10;
      const audioResponse = await axios.get(`https://api.alquran.cloud/v1/surah/${surahNumber}/ar.alafasy`);
      const audioAyahs = audioResponse.data.data.ayahs.slice(0, limit);
      
      // Précharger silencieusement les audios
      audioAyahs.forEach((ayah: any) => {
        try {
          const audioElement = new Audio();
          audioElement.preload = 'auto';
          audioElement.src = ayah.audio;
          // Pas besoin d'ajouter à DOM ou de jouer
        } catch (e) {
          // Ignorer les erreurs de préchargement
        }
      });
    } catch (e) {
      // Ignorer les erreurs de préchargement
    }
  };

  const handleSurahSelect = (surah: Surah) => {
    setSelectedSurah(surah);
    fetchAyahs(surah.number);
    
    // Précharger les audios
    prechargeSurahAudio(surah.number);
    
    // Arrêter l'audio en cours si nécessaire
    if (audioElement) {
      audioElement.pause();
      setPlayingAyah(null);
    }
  };

  const handlePlayAudio = (audioUrl: string, ayahNumber: number) => {
    // Arrêter l'audio en cours si nécessaire
    if (audioElement) {
      audioElement.pause();
    }

    // Arrêter la lecture de la sourate complète si elle est en cours
    setIsPlayingFullSurah(false);

    // Créer et jouer le nouvel audio
    try {
      const audio = new Audio(audioUrl);
      audio.onended = () => setPlayingAyah(null);
      
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.error("Erreur lors de la lecture du verset:", error);
          setPlayingAyah(null);
        });
      }
      
      setAudioElement(audio);
      setPlayingAyah(ayahNumber);
    } catch (error) {
      console.error("Erreur lors de la création de l'audio:", error);
      setPlayingAyah(null);
    }
  };

  const handleStopAudio = () => {
    if (audioElement) {
      audioElement.pause();
      setPlayingAyah(null);
      setIsPlayingFullSurah(false);
    }
  };

  const playNextAyah = () => {
    if (!isPlayingFullSurah || currentAyahIndex >= ayahs.length - 1) {
      setIsPlayingFullSurah(false);
      setPlayingAyah(null);
      setCurrentAyahIndex(0);
      return;
    }

    const nextIndex = currentAyahIndex + 1;
    const nextAyah = ayahs[nextIndex];
    
    if (audioElement) {
      audioElement.pause();
    }
    
    try {
      const audio = new Audio(nextAyah.audio);
      audio.onended = playNextAyah;
      
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            console.log(`Lecture de l'ayah ${nextAyah.number}`);
          })
          .catch(error => {
            console.error("Erreur lors de la lecture:", error);
            // En cas d'erreur, passer au verset suivant après un court délai
            setTimeout(() => playNextAyah(), 500);
          });
      }
      
      setAudioElement(audio);
      setPlayingAyah(nextAyah.number);
      setCurrentAyahIndex(nextIndex);
    } catch (error) {
      console.error("Erreur lors de la création de l'audio:", error);
      // En cas d'erreur, passer au verset suivant après un court délai
      setTimeout(() => playNextAyah(), 500);
    }
  };

  const handlePlayFullSurah = () => {
    if (ayahs.length === 0) return;
    
    // Arrêter l'audio en cours si nécessaire
    if (audioElement) {
      audioElement.pause();
    }
    
    setIsPlayingFullSurah(true);
    setCurrentAyahIndex(0);
    
    try {
      const firstAyah = ayahs[0];
      const audio = new Audio(firstAyah.audio);
      audio.onended = playNextAyah;
      
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            console.log(`Lecture de l'ayah ${firstAyah.number}`);
          })
          .catch(error => {
            console.error("Erreur lors de la lecture:", error);
            // En cas d'erreur, passer au verset suivant après un court délai
            setTimeout(() => playNextAyah(), 500);
          });
      }
      
      setAudioElement(audio);
      setPlayingAyah(firstAyah.number);
    } catch (error) {
      console.error("Erreur lors de la création de l'audio:", error);
      // En cas d'erreur, passer au verset suivant après un court délai
      setTimeout(() => playNextAyah(), 500);
    }
  };

  const renderSurahsList = () => (
    <div>
      <div className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-900 pb-4">
        <div className="relative mb-4">
          <input
            type="text"
            placeholder="Rechercher une sourate..."
            className="w-full px-4 py-3 pl-10 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 focus:border-transparent text-gray-800 dark:text-gray-200"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {filteredSurahs.map((surah) => (
          <button
            key={surah.number}
            onClick={() => handleSurahSelect(surah)}
            className="flex justify-between items-center bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-center">
              <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center mr-3">
                <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">{surah.number}</span>
              </div>
              <div className="text-left">
                <div className="font-medium text-gray-800 dark:text-gray-200">{surah.englishName}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{surah.englishNameTranslation}</div>
              </div>
            </div>
            <div className="flex flex-col items-end">
              <div className="text-right font-arabic text-xl text-gray-800 dark:text-gray-200">{surah.name}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{surah.numberOfAyahs} versets</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );

  const renderSurahContent = () => (
    <div>
      <button
        onClick={() => setSelectedSurah(null)}
        className="flex items-center mb-6 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
      >
        <svg className="w-4 h-4 mr-1" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M19 12H5M5 12L12 19M5 12L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Retour aux sourates
      </button>
      
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm dark:shadow-gray-950/50 p-5 mb-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start">
          <div className="mb-3 sm:mb-0">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">{selectedSurah?.englishName}</h2>
            <p className="text-gray-500 dark:text-gray-400">{selectedSurah?.englishNameTranslation}</p>
          </div>
          <div className="text-left sm:text-right">
            <div className="text-2xl font-arabic mb-1 text-gray-800 dark:text-gray-200">{selectedSurah?.name}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">{selectedSurah?.numberOfAyahs} versets</div>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
          <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mb-3 sm:mb-0">
            <FaBookOpen className="mr-1" />
            <span>{selectedSurah?.revelationType === 'Meccan' ? 'Révélée à La Mecque' : 'Révélée à Médine'}</span>
          </div>
          <div className="flex items-center">
            <div className="text-sm text-gray-500 dark:text-gray-400 mr-3">Sourate {selectedSurah?.number}</div>
            <button
              onClick={isPlayingFullSurah ? handleStopAudio : handlePlayFullSurah}
              className="flex items-center px-3 py-1 bg-emerald-100 dark:bg-emerald-800/50 text-emerald-600 dark:text-emerald-400 rounded-lg hover:bg-emerald-200 dark:hover:bg-emerald-800/80 transition-colors"
            >
              {isPlayingFullSurah ? <FaPause size={12} className="mr-1" /> : <FaPlay size={12} className="mr-1" />}
              <span className="text-sm font-medium">{isPlayingFullSurah ? 'Arrêter' : 'Lecture complète'}</span>
            </button>
          </div>
        </div>
      </div>

      {loadingAyahs ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 dark:border-emerald-400"></div>
        </div>
      ) : (
        <div className="space-y-4">
          {ayahs.map((ayah) => (
            <div key={ayah.number} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm dark:shadow-gray-950/50 overflow-hidden">
              <div className="p-4 bg-emerald-50 dark:bg-emerald-900/30 flex justify-between items-center">
                <div className="flex items-center">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-800/50 flex items-center justify-center mr-2">
                    <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{ayah.number}</span>
                  </div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">Verset {ayah.number}</span>
                </div>
                <button
                  onClick={() => playingAyah === ayah.number ? handleStopAudio() : handlePlayAudio(ayah.audio, ayah.number)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-800/50 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-800/80 transition-colors"
                >
                  {playingAyah === ayah.number ? <FaPause size={12} /> : <FaPlay size={12} />}
                </button>
              </div>
              <div className="p-4">
                <p className="text-right font-arabic text-xl leading-loose mb-4 text-gray-800 dark:text-gray-200">{ayah.text}</p>
                <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed italic">{ayah.translation}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (error && !surahs.length) {
    return (
      <div className="px-4 py-6">
        <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 p-4 rounded-xl mb-6 shadow-sm flex items-start">
          <FaInfoCircle className="text-red-500 dark:text-red-400 mr-3 mt-1" />
          <div>
            <p className="font-medium mb-1">Erreur de chargement</p>
            <p>{error}</p>
            <button
              onClick={fetchSurahs}
              className="mt-2 bg-red-100 hover:bg-red-200 dark:bg-red-800/30 dark:hover:bg-red-800/50 text-red-700 dark:text-red-400 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Réessayer
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">Le Saint Coran</h1>
        <p className="text-gray-600 dark:text-gray-400">Explorer et écouter le Saint Coran</p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 p-4 rounded-xl mb-6 shadow-sm">
          <p>{error}</p>
        </div>
      )}

      {selectedSurah ? renderSurahContent() : renderSurahsList()}
    </div>
  );
} 