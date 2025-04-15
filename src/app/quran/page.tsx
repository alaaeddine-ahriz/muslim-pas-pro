'use client';

import React, { useEffect, useState, useRef } from 'react';
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

interface Reciter {
  identifier: string;
  name: string;
  arabicName?: string;
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
  const [currentAyahIndex, setCurrentAyahIndex] = useState<number | null>(null);
  const [selectedReciter, setSelectedReciter] = useState<string>('ar.alafasy');
  const [isReciterMenuOpen, setIsReciterMenuOpen] = useState(false);
  const [audioProgress, setAudioProgress] = useState<number>(0);
  const [showTranslation, setShowTranslation] = useState<boolean>(true);
  const { theme, toggleTheme } = useTheme();
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  // Liste des récitateurs disponibles
  const reciters: Reciter[] = [
    { identifier: 'ar.alafasy', name: 'Mishary Rashid Alafasy', arabicName: 'مشاري راشد العفاسي' },
    { identifier: 'ar.abdurrahmaansudais', name: 'Abdurrahmaan As-Sudais', arabicName: 'عبدالرحمن السديس' },
    { identifier: 'ar.abdulbasitmurattal', name: 'Abdul Basit Murattal', arabicName: 'عبد الباسط عبد الصمد' },
    { identifier: 'ar.mahermuaiqly', name: 'Maher Al Muaiqly', arabicName: 'ماهر المعيقلي' },
    { identifier: 'ar.husary', name: 'Mahmoud Khalil Al-Husary', arabicName: 'محمود خليل الحصري' },
  ];

  useEffect(() => {
    fetchSurahs();
    
    // Charger le récitateur préféré depuis le localStorage
    const savedReciter = localStorage.getItem('selectedReciter');
    if (savedReciter) {
      setSelectedReciter(savedReciter);
    }
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
      
      // Récupérer les audios du récitateur sélectionné
      const audioResponse = await axios.get(`https://api.alquran.cloud/v1/surah/${surahNumber}/${selectedReciter}`);
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

  // Ajouter un useEffect pour gérer la lecture continue
  useEffect(() => {
    // Cette fonction sera déclenchée lorsque le playingAyah change ou devient null
    let timerId: NodeJS.Timeout | null = null;
    
    // Si on est en mode lecture complète et qu'aucun verset n'est en cours de lecture
    // (cela signifie que le verset précédent vient de se terminer)
    if (isPlayingFullSurah && playingAyah === null && currentAyahIndex !== null && currentAyahIndex < ayahs.length - 1) {
      // Attendre un court instant avant de passer au verset suivant (évite les problèmes de lecture)
      timerId = setTimeout(() => {
        if (currentAyahIndex !== null) {
          const nextIndex = currentAyahIndex + 1;
          if (nextIndex < ayahs.length) {
            const nextAyah = ayahs[nextIndex];
            playAyah(nextAyah.audio, nextAyah.number);
            setCurrentAyahIndex(nextIndex);
          }
        }
      }, 800);
    }
    
    // Nettoyage du timer si le composant se démonte ou si l'état change
    return () => {
      if (timerId) clearTimeout(timerId);
    };
  }, [playingAyah, isPlayingFullSurah, currentAyahIndex, ayahs]);

  // Fonction commune pour jouer un audio
  const playAyah = (audioUrl: string, ayahNumber: number) => {
    try {
      // Arrêter l'audio en cours si nécessaire
      if (audioElement) {
        audioElement.pause();
      }
      
      const audio = new Audio(audioUrl);
      
      // Quand l'audio se termine, mettre playingAyah à null
      // Ce changement déclenchera le useEffect ci-dessus
      audio.onended = () => {
        setPlayingAyah(null);
      };
      
      audio.play().catch(error => {
        console.error("Erreur lors de la lecture audio:", error);
        setPlayingAyah(null);
      });
      
      setAudioElement(audio);
      setPlayingAyah(ayahNumber);
    } catch (error) {
      console.error("Erreur lors de la création de l'audio:", error);
      setPlayingAyah(null);
    }
  };

  const handlePlayAudio = (audioUrl: string, ayahNumber: number) => {
    // Arrêter la lecture de la sourate complète si elle est en cours
    setIsPlayingFullSurah(false);
    setCurrentAyahIndex(0);
    
    // Utiliser la fonction commune
    playAyah(audioUrl, ayahNumber);
  };

  const handleStopAudio = () => {
    if (audioElement) {
      // Enlever les écouteurs d'événements avant d'arrêter l'audio
      const audio = audioElement;
      
      // Enlever tous les écouteurs d'événements possibles
      const newAudio = new Audio();
      newAudio.src = audio.src;
      
      // Pause de l'audio actuel
      audio.pause();
      
      setAudioElement(newAudio);
      setPlayingAyah(null);
      setIsPlayingFullSurah(false);
      setCurrentAyahIndex(null);
      
      // Effacer l'état de lecture sauvegardé
      if (selectedSurah) {
        clearPlaybackState(selectedSurah.number);
      }
    }
  };

  // Fonctions pour gérer le progrès audio
  const saveAudioProgress = (surahNumber: number, progress: number) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(`audio_progress_${surahNumber}`, progress.toString());
    }
  };

  const getAudioProgress = (surahNumber: number): number => {
    if (typeof window !== 'undefined') {
      const savedProgress = localStorage.getItem(`audio_progress_${surahNumber}`);
      return savedProgress ? parseFloat(savedProgress) : 0;
    }
    return 0;
  };

  const handlePlayFullSurah = () => {
    if (!selectedSurah) return;
    
    // Déclarer currentIndex au début de la fonction
    let currentIndex = 0;
    
    // Si déjà en lecture et qu'on appuie à nouveau, c'est pour mettre en pause
    if (isPlayingFullSurah && audioElement) {
      audioElement.pause();
      setIsPlayingFullSurah(false);
      
      // Sauvegarder l'état de lecture et l'avancement actuel
      const currentProgress = audioProgress;
      
      // Stocker ces informations pour reprendre plus tard
      savePlaybackState(selectedSurah.number, {
        progress: currentProgress,
        verseIndex: currentIndex,
        surahNumber: selectedSurah.number,
        isPaused: true
      });
      
      return;
    }
    
    // Vérifier s'il y a un état de lecture sauvegardé
    const savedState = getPlaybackState(selectedSurah.number);
    
    // Si nous avons un état sauvegardé et qu'il est en pause, reprendre la lecture
    if (savedState && savedState.isPaused && savedState.surahNumber === selectedSurah.number) {
      currentIndex = savedState.verseIndex || 0;
      // Ne pas remettre l'audio à zéro, reprendre là où on s'était arrêté
      setAudioProgress(savedState.progress || 0);
    } else {
      // Nouvel état, commencer du début
      currentIndex = 0;
      setAudioProgress(0);
    }
    
    // Arrêter l'audio en cours si nécessaire
    if (audioElement) {
      audioElement.pause();
      setPlayingAyah(null);
    }
    
    // Créer un nouvel élément audio
    const audio = new Audio();
    setAudioElement(audio);
    currentAudioRef.current = audio;
    
    // Préparer la liste de lecture des versets
    const ayahsToPlay = [...ayahs];
    
    // Jouer le verset correspondant
    if (ayahsToPlay.length > 0) {
      audio.src = ayahsToPlay[currentIndex].audio;
      setIsPlayingFullSurah(true);
      
      // Définir les fonctions de mise à jour de progression et de gestion de fin de verset
      const updateProgress = () => {
        if (audio.duration > 0 && ayahsToPlay.length > 0) {
          // Calculer la progression globale en tenant compte des versets précédents
          const verseProgress = audio.currentTime / audio.duration;
          const versesComplete = currentIndex / ayahsToPlay.length;
          const verseContribution = 1 / ayahsToPlay.length;
          
          // La progression totale est la somme des versets complets + la progression du verset en cours
          const totalProgress = versesComplete + (verseProgress * verseContribution);
          setAudioProgress(totalProgress);
          
          // Sauvegarder l'état régulièrement
          if (Math.floor(audio.currentTime) % 5 === 0 && audio.currentTime > 0) {
            savePlaybackState(selectedSurah.number, {
              progress: totalProgress,
              verseIndex: currentIndex,
              surahNumber: selectedSurah.number,
              isPaused: false
            });
          }
        }
      };
      
      const handleVerseEnd = () => {
        currentIndex++;
        
        // Si nous avons d'autres versets à jouer
        if (currentIndex < ayahsToPlay.length) {
          // Sauvegarder le progrès à chaque fin de verset
          const progress = currentIndex / ayahsToPlay.length;
          savePlaybackState(selectedSurah.number, {
            progress: progress,
            verseIndex: currentIndex,
            surahNumber: selectedSurah.number,
            isPaused: false
          });
          
          // Jouer le prochain verset immédiatement
          audio.src = ayahsToPlay[currentIndex].audio;
          // Commencer la lecture immédiatement pour éviter les délais
          const playPromise = audio.play();
          
          // Gérer la promesse de lecture pour éviter les erreurs
          if (playPromise !== undefined) {
            playPromise.catch(e => {
              console.error("Erreur lors de la lecture audio:", e);
              setIsPlayingFullSurah(false);
            });
          }
        } else {
          // Tous les versets ont été joués
          setIsPlayingFullSurah(false);
          setAudioProgress(0);
          // Effacer l'état de lecture sauvegardé
          clearPlaybackState(selectedSurah.number);
          
          // Nettoyer les écouteurs d'événements
          audio.removeEventListener('timeupdate', updateProgress);
          audio.removeEventListener('ended', handleVerseEnd);
        }
      };
      
      // Ajouter les écouteurs d'événements
      audio.addEventListener('timeupdate', updateProgress);
      audio.addEventListener('ended', handleVerseEnd);
      
      // Commencer la lecture
      audio.play().catch(e => {
        console.error("Erreur lors de la lecture audio:", e);
        setIsPlayingFullSurah(false);
      });
    }
  };

  // Fonction pour gérer le changement de récitateur
  const handleReciterChange = (reciterId: string) => {
    setSelectedReciter(reciterId);
    setIsReciterMenuOpen(false);
    
    // Sauvegarder la préférence du récitateur
    try {
      localStorage.setItem('selectedReciter', reciterId);
    } catch (error) {
      console.error("Erreur lors de l'enregistrement du récitateur:", error);
    }
    
    // Si une sourate est déjà sélectionnée, recharger ses versets avec le nouveau récitateur
    if (selectedSurah) {
      // Arrêter l'audio en cours si nécessaire
      if (audioElement) {
        audioElement.pause();
        setPlayingAyah(null);
        setIsPlayingFullSurah(false);
      }
      
      fetchAyahs(selectedSurah.number);
    }
  };

  // Fonction pour obtenir l'URL audio d'une ayah spécifique
  const getAudioUrl = (surahNumber: number, ayahNumber: number, reciter: string): string => {
    return `https://cdn.islamic.network/quran/audio/${reciter}/${surahNumber}/${ayahNumber}.mp3`;
  };

  // Fonctions pour gérer l'état de lecture
  const savePlaybackState = (surahNumber: number, state: any) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(`playback_state_${surahNumber}`, JSON.stringify(state));
    }
  };

  const getPlaybackState = (surahNumber: number): any => {
    if (typeof window !== 'undefined') {
      const state = localStorage.getItem(`playback_state_${surahNumber}`);
      return state ? JSON.parse(state) : null;
    }
    return null;
  };

  const clearPlaybackState = (surahNumber: number) => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(`playback_state_${surahNumber}`);
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
        
        {/* Barre de progression pour la lecture complète */}
        {isPlayingFullSurah && (
          <div className="mt-4 w-full">
            <div className="relative w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="absolute top-0 left-0 h-full bg-emerald-500 dark:bg-emerald-400 rounded-full"
                style={{ width: `${audioProgress * 100}%` }}
              ></div>
            </div>
          </div>
        )}
        
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
          <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mb-3 sm:mb-0">
            <div className="flex items-center mr-4">
              <FaBookOpen className="mr-1" />
              <span>{selectedSurah?.revelationType === 'Meccan' ? 'Révélée à La Mecque' : 'Révélée à Médine'}</span>
            </div>
            <button 
              onClick={() => setShowTranslation(!showTranslation)}
              className={`flex items-center px-3 py-1 text-xs rounded-full ${showTranslation ? 'bg-emerald-100 dark:bg-emerald-800/50 text-emerald-600 dark:text-emerald-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}
            >
              {showTranslation ? 'Masquer traduction' : 'Afficher traduction'}
            </button>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center">
            <div className="relative mb-2 sm:mb-0 sm:mr-3 w-full sm:w-auto">
              <button
                onClick={() => setIsReciterMenuOpen(!isReciterMenuOpen)}
                className="flex items-center justify-between px-3 py-2 w-full sm:w-auto bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm"
              >
                <span className="mr-2">
                  {reciters.find(r => r.identifier === selectedReciter)?.name || 'Récitateur'}
                </span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                </svg>
              </button>
              
              {isReciterMenuOpen && (
                <div className="absolute right-0 mt-1 z-10 w-full sm:w-64 bg-white dark:bg-gray-800 shadow-lg rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                  {reciters.map(reciter => (
                    <button
                      key={reciter.identifier}
                      onClick={() => handleReciterChange(reciter.identifier)}
                      className={`w-full text-left px-4 py-3 text-sm ${selectedReciter === reciter.identifier ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                    >
                      <div>{reciter.name}</div>
                      {reciter.arabicName && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 font-arabic">{reciter.arabicName}</div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            <div className="flex items-center w-full sm:w-auto mt-2 sm:mt-0">
              <div className="text-sm text-gray-500 dark:text-gray-400 mr-3">Sourate {selectedSurah?.number}</div>
              <button
                onClick={isPlayingFullSurah ? handleStopAudio : handlePlayFullSurah}
                className="flex items-center justify-center w-full sm:w-auto px-4 py-2 bg-emerald-100 dark:bg-emerald-800/50 text-emerald-600 dark:text-emerald-400 rounded-lg hover:bg-emerald-200 dark:hover:bg-emerald-800/80 transition-colors"
              >
                {isPlayingFullSurah ? <FaPause size={12} className="mr-2" /> : <FaPlay size={12} className="mr-2" />}
                <span className="text-sm font-medium">{isPlayingFullSurah ? 'Arrêter' : 'Lecture complète'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {loadingAyahs ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 dark:border-emerald-400"></div>
        </div>
      ) : (
        <div className="space-y-6">
          {ayahs.map((ayah) => (
            <div key={ayah.number} className="pb-4 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-800/50 text-xs font-medium text-emerald-600 dark:text-emerald-400 mr-2">
                    {ayah.number}
                  </span>
                </span>
                <button
                  onClick={() => playingAyah === ayah.number ? handleStopAudio() : handlePlayAudio(ayah.audio, ayah.number)}
                  className="w-7 h-7 flex items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-800/50 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-800/80 transition-colors"
                >
                  {playingAyah === ayah.number ? <FaPause size={10} /> : <FaPlay size={10} />}
                </button>
              </div>
              <p className="text-right font-arabic text-xl leading-loose text-gray-800 dark:text-gray-200">{ayah.text}</p>
              {showTranslation && ayah.translation && (
                <p className="mt-2 text-gray-700 dark:text-gray-300 text-sm leading-relaxed">{ayah.translation}</p>
              )}
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
      {!selectedSurah && (
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">Le Saint Coran</h1>
          <p className="text-gray-600 dark:text-gray-400">Explorer et écouter le Saint Coran</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 p-4 rounded-xl mb-6 shadow-sm">
          <p>{error}</p>
        </div>
      )}

      {selectedSurah ? renderSurahContent() : renderSurahsList()}
    </div>
  );
} 