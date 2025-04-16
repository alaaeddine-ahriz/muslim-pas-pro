'use client';

import React, { useEffect, useState, useRef } from 'react';
import { FaPlay, FaPause, FaSearch, FaBookOpen, FaInfoCircle, FaArrowLeft, FaMicrophone, FaChevronDown, FaLanguage, FaFont, FaPlus, FaMinus, FaCog } from 'react-icons/fa';
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
  number: number | string;
  numberInSurah: number;
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
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [currentAyahIndex, setCurrentAyahIndex] = useState<number | null>(null);
  const [selectedReciter, setSelectedReciter] = useState<string>('ar.alafasy');
  const [isReciterMenuOpen, setIsReciterMenuOpen] = useState(false);
  const [audioProgress, setAudioProgress] = useState<number>(0);
  const [showTranslation, setShowTranslation] = useState<boolean>(true);
  const [textSizeLevel, setTextSizeLevel] = useState<number>(2); // 0: small, 1: medium, 2: normal, 3: large, 4: larger
  const [showTextSizeControls, setShowTextSizeControls] = useState<boolean>(false);
  const { theme, toggleTheme } = useTheme();
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const currentIndexRef = useRef<number>(0);
  const [currentAyah, setCurrentAyah] = useState<number | null>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

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
    
    // Optimisations pour les appareils iOS lorsque l'app est ajoutée à l'écran d'accueil
    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
    
    // Vérifie si l'application est en mode standalone (ajoutée à l'écran d'accueil sur iOS)
    // @ts-ignore: 'standalone' existe sur Safari iOS mais pas dans la définition de type standard
    const isStandalone = typeof window !== 'undefined' && window.navigator && window.navigator.standalone === true;
    
    if (isIOS) {
      // Lorsque l'app est en mode standalone sur iOS, nous devons gérer l'audio différemment
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden' && currentAudioRef.current && !currentAudioRef.current.paused) {
          // Sauvegarder l'état avant de mettre en pause
          if (selectedSurah) {
            const currentTime = currentAudioRef.current.currentTime;
            const duration = currentAudioRef.current.duration || 1;
            const progress = currentTime / duration;
            
            localStorage.setItem(`surah-${selectedSurah.number}-progress`, progress.toString());
            localStorage.setItem(`surah-${selectedSurah.number}-time`, currentTime.toString());
            localStorage.setItem(`surah-${selectedSurah.number}-paused`, "true");
          }
          // Nous ne mettons pas en pause car sur iOS cela peut stopper définitivement l'audio
        }
      });
    }

    // Load saved text size
    const savedTextSize = localStorage.getItem('textSizeLevel');
    if (savedTextSize) {
      setTextSizeLevel(parseInt(savedTextSize));
    }

    // Add click outside handler for settings panel
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setShowTextSizeControls(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
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
      
      // Réinitialiser l'audio en cours si nécessaire
      if (audioElement) {
        audioElement.pause();
        setPlayingAyah(null);
      }
      
      // Réinitialiser tous les états de lecture
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
      }
      setIsPlayingFullSurah(false);
      setCurrentAyahIndex(null);
      currentIndexRef.current = 0;
      setAudioProgress(0);
      setCurrentAyah(null);
      
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
        number: ayah.number.toString(), // Assurer que le numéro contient le numéro de surah
        numberInSurah: ayah.numberInSurah,
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
      // Précharger l'audio de la sourate complète
      const reciterBaseUrl = reciters.find(r => r.identifier === selectedReciter)?.identifier || 'ar.alafasy';
      const fullSurahUrl = `https://cdn.islamic.network/quran/audio-surah/128/${reciterBaseUrl}/${surahNumber}.mp3`;
      
      // Créer un élément audio caché pour précharger
      const preloadAudio = new Audio();
      preloadAudio.preload = 'auto';
      preloadAudio.src = fullSurahUrl;
      
      // Pour iOS, nous devons charger un petit morceau puis mettre en pause
      const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
      if (isIOS) {
        try {
          // Tenter de charger un peu d'audio puis mettre en pause immédiatement
          preloadAudio.volume = 0.01; // Volume presque inaudible
          await preloadAudio.play();
          setTimeout(() => {
            preloadAudio.pause();
            preloadAudio.volume = 1.0;
          }, 50);
        } catch (err) {
          console.log('Préchargement iOS nécessite une interaction utilisateur');
        }
      }
    } catch (e) {
      // Ignorer les erreurs de préchargement
      console.log('Erreur lors du préchargement:', e);
    }
  };

  const handleSurahSelect = (surah: Surah) => {
    // Mettre à jour la sourate sélectionnée
    setSelectedSurah(surah);
    
    // Charger les versets (fetchAyahs contient maintenant toute la logique de réinitialisation)
    fetchAyahs(surah.number);
    
    // Précharger les audios
    prechargeSurahAudio(surah.number);
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
            playAyah(nextAyah.audio, nextAyah.numberInSurah);
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
      
      // Pause de l'audio actuel
      audio.pause();
      
      // Ne pas réinitialiser complètement les références si on est en mode lecture de sourate
      if (!isPlayingFullSurah) {
        // Enlever tous les écouteurs d'événements possibles
        const newAudio = new Audio();
        newAudio.src = audio.src;
        setAudioElement(newAudio);
        setPlayingAyah(null);
        setCurrentAyahIndex(null);
        
        // Effacer l'état de lecture sauvegardé
        if (selectedSurah) {
          clearPlaybackState(selectedSurah.number);
        }
      } else {
        setPlayingAyah(null);
      }
    }
    
    // Mettre en pause l'audio référencé par currentAudioRef
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      
      // Sauvegarder l'état actuel pour permettre la reprise
      if (selectedSurah && isPlayingFullSurah) {
        const currentTime = currentAudioRef.current.currentTime;
        const duration = currentAudioRef.current.duration || 1;
        const progress = currentTime / duration;
        
        localStorage.setItem(`surah-${selectedSurah.number}-progress`, progress.toString());
        localStorage.setItem(`surah-${selectedSurah.number}-time`, currentTime.toString());
        localStorage.setItem(`surah-${selectedSurah.number}-paused`, "true");
      }
    }
    
    setIsPlayingFullSurah(false);
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
    
    // Si l'audio est déjà en cours de lecture, le mettre en pause
    if (isPlayingFullSurah) {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        
        // Sauvegarder l'état de lecture pour pouvoir reprendre plus tard
        const currentTime = currentAudioRef.current.currentTime;
        const duration = currentAudioRef.current.duration || 1;
        const progress = currentTime / duration;
        
        if (selectedSurah) {
          localStorage.setItem(`surah-${selectedSurah.number}-progress`, progress.toString());
          localStorage.setItem(`surah-${selectedSurah.number}-time`, currentTime.toString());
          localStorage.setItem(`surah-${selectedSurah.number}-paused`, "true");
        }
      }
      setIsPlayingFullSurah(false);
      return;
    }
    
    // Arrêter l'audio en cours si nécessaire
    if (audioElement) {
      audioElement.pause();
      setPlayingAyah(null);
    }
    
    // Indiquer que l'audio est en cours de chargement
    setIsAudioLoading(true);
    
    // Réinitialiser la référence audio si nécessaire
    if (!currentAudioRef.current) {
      currentAudioRef.current = new Audio();
    }
    
    const reciterBaseUrl = reciters.find(r => r.identifier === selectedReciter)?.identifier || 'ar.alafasy';
    
    // Vérifier si nous avons un état de lecture sauvegardé pour cette sourate
    const savedPaused = localStorage.getItem(`surah-${selectedSurah.number}-paused`);
    const savedTime = localStorage.getItem(`surah-${selectedSurah.number}-time`);
    
    // Construire l'URL pour la sourate complète (utiliser 128kbps pour un chargement plus rapide)
    const fullSurahUrl = `https://cdn.islamic.network/quran/audio-surah/128/${reciterBaseUrl}/${selectedSurah.number}.mp3`;
    
    // Mettre à jour la source audio
    if (currentAudioRef.current) {
      // Configurer les événements d'audio avant de définir la source
      currentAudioRef.current.onloadstart = () => {
        setIsAudioLoading(true);
      };
      
      currentAudioRef.current.oncanplaythrough = () => {
        setIsAudioLoading(false);
      };
      
      currentAudioRef.current.onwaiting = () => {
        setIsAudioLoading(true);
      };
      
      currentAudioRef.current.onplaying = () => {
        setIsAudioLoading(false);
        setIsPlayingFullSurah(true);
      };
      
      currentAudioRef.current.onerror = (e) => {
        console.error('Erreur audio:', e);
        setIsAudioLoading(false);
        setIsPlayingFullSurah(false);
      };
      
      currentAudioRef.current.onended = () => {
        setIsPlayingFullSurah(false);
        setIsAudioLoading(false);
        
        // Réinitialiser les états quand la lecture est terminée
        if (selectedSurah) {
          localStorage.removeItem(`surah-${selectedSurah.number}-paused`);
          localStorage.removeItem(`surah-${selectedSurah.number}-time`);
          localStorage.removeItem(`surah-${selectedSurah.number}-progress`);
        }
      };
      
      currentAudioRef.current.ontimeupdate = () => {
        if (currentAudioRef.current && selectedSurah) {
          const currentTime = currentAudioRef.current.currentTime;
          const duration = currentAudioRef.current.duration || 1;
          const progress = currentTime / duration;
          
          setAudioProgress(progress);
          
          // Mise à jour périodique pour sauvegarder la progression
          if (Math.floor(currentTime) % 5 === 0) { // Sauvegarder toutes les 5 secondes environ
            localStorage.setItem(`surah-${selectedSurah.number}-time`, currentTime.toString());
            localStorage.setItem(`surah-${selectedSurah.number}-progress`, progress.toString());
          }
        }
      };
      
      // Définir la source après avoir configuré tous les écouteurs d'événements
      currentAudioRef.current.src = fullSurahUrl;
      
      // Si nous étions en train de lire cette sourate et que nous l'avons mise en pause, reprendre
      if (savedPaused === "true" && savedTime) {
        const timeToStart = parseFloat(savedTime);
        if (!isNaN(timeToStart)) {
          currentAudioRef.current.currentTime = timeToStart;
        }
      } else {
        // Sinon commencer du début
        currentAudioRef.current.currentTime = 0;
        
        // Réinitialiser l'état sauvegardé
        if (selectedSurah) {
          localStorage.removeItem(`surah-${selectedSurah.number}-paused`);
          localStorage.removeItem(`surah-${selectedSurah.number}-time`);
          localStorage.removeItem(`surah-${selectedSurah.number}-progress`);
        }
      }
      
      // Jouer l'audio
      try {
        // Sur iOS, nous devons utiliser une approche différente pour la lecture après un événement utilisateur
        const playPromise = currentAudioRef.current.play();
        
        if (playPromise !== undefined) {
          playPromise.then(() => {
            // La lecture a démarré avec succès
            setIsPlayingFullSurah(true);
            setIsAudioLoading(false);
          }).catch(err => {
            console.error('Erreur lors de la lecture:', err);
            
            // Sur iOS Safari, nous pouvons avoir besoin d'un interaction utilisateur
            // Nous allons donc essayer de charger l'audio sans le jouer
            if (currentAudioRef.current) {
              currentAudioRef.current.load();
            }
            setIsPlayingFullSurah(false);
            setIsAudioLoading(false);
          });
        }
      } catch (err) {
        console.error('Erreur de lecture:', err);
        setIsPlayingFullSurah(false);
        setIsAudioLoading(false);
      }
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
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        setPlayingAyah(null);
        setIsPlayingFullSurah(false);
      }
      
      fetchAyahs(selectedSurah.number);
    }
  };

  // Fonction pour vérifier la disponibilité d'un récitateur pour une sourate
  const checkReciterAvailability = async (reciterId: string, surahNumber: number) => {
    try {
      const response = await axios.head(`https://api.alquran.cloud/v1/surah/${surahNumber}/${reciterId}`);
      return response.status === 200;
    } catch (error) {
      return false;
    }
  };
  
  // État pour stocker les récitateurs disponibles pour la sourate actuelle
  const [availableReciters, setAvailableReciters] = useState<string[]>([]);
  
  // Vérifier les récitateurs disponibles lorsqu'une sourate est sélectionnée
  useEffect(() => {
    if (selectedSurah) {
      const checkAllReciters = async () => {
        setIsReciterMenuOpen(false);
        // Commencer avec un récitateur par défaut disponible pour toutes les sourates
        const available = ['ar.alafasy']; // Alafasy est généralement disponible pour toutes les sourates
        
        // Vérifier la disponibilité pour les autres récitateurs
        for (const reciter of reciters) {
          if (reciter.identifier !== 'ar.alafasy') { // On a déjà ajouté Alafasy
            const isAvailable = await checkReciterAvailability(reciter.identifier, selectedSurah.number);
            if (isAvailable) {
              available.push(reciter.identifier);
            }
          }
        }
        
        setAvailableReciters(available);
        
        // Si le récitateur actuel n'est pas disponible, passer au premier disponible
        if (available.length > 0 && !available.includes(selectedReciter)) {
          handleReciterChange(available[0]);
        }
      };
      
      checkAllReciters();
    }
  }, [selectedSurah]);

  // Fonction pour obtenir l'URL audio d'une ayah spécifique
  const getAudioUrl = (surahNumber: number, ayahNumber: number, reciter: string): string => {
    return `https://cdn.islamic.network/quran/audio/128/${reciter}/${surahNumber}:${ayahNumber}.mp3`;
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

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const getTextSize = () => {
    switch (textSizeLevel) {
      case 0: return { arabic: 'text-lg', translation: 'text-xs' };
      case 1: return { arabic: 'text-xl', translation: 'text-sm' };
      case 2: return { arabic: 'text-2xl', translation: 'text-base' };
      case 3: return { arabic: 'text-3xl', translation: 'text-lg' };
      case 4: return { arabic: 'text-4xl', translation: 'text-xl' };
      default: return { arabic: 'text-2xl', translation: 'text-base' };
    }
  };

  const increaseTextSize = () => {
    if (textSizeLevel < 4) {
      const newSize = textSizeLevel + 1;
      setTextSizeLevel(newSize);
      localStorage.setItem('textSizeLevel', newSize.toString());
    }
  };

  const decreaseTextSize = () => {
    if (textSizeLevel > 0) {
      const newSize = textSizeLevel - 1;
      setTextSizeLevel(newSize);
      localStorage.setItem('textSizeLevel', newSize.toString());
    }
  };

  const handleTextSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSize = parseInt(e.target.value);
    setTextSizeLevel(newSize);
    localStorage.setItem('textSizeLevel', newSize.toString());
  };

  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!currentAudioRef.current || !isPlayingFullSurah) return;
    
    // Obtenir les dimensions et la position du clic par rapport à la barre de progression
    const progressBar = e.currentTarget;
    const rect = progressBar.getBoundingClientRect();
    const clickPosition = e.clientX - rect.left;
    const progressBarWidth = rect.width;
    
    // Calculer la position relative du clic (0 à 1)
    const seekPosition = clickPosition / progressBarWidth;
    
    // Appliquer la position à l'audio
    const duration = currentAudioRef.current.duration;
    if (duration) {
      currentAudioRef.current.currentTime = duration * seekPosition;
      setAudioProgress(seekPosition);
      
      // Sauvegarder l'état de lecture
      if (selectedSurah) {
        localStorage.setItem(`surah-${selectedSurah.number}-time`, (duration * seekPosition).toString());
        localStorage.setItem(`surah-${selectedSurah.number}-progress`, seekPosition.toString());
      }
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
    <div className="min-h-screen pb-16">
      <button
        onClick={() => setSelectedSurah(null)}
        className="flex items-center text-gray-600 dark:text-gray-400 mb-6 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
      >
        <FaArrowLeft className="mr-2" /> Retour à la liste des sourates
      </button>

      {selectedSurah && (
        <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-lg p-6 mb-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
                {selectedSurah.englishName}
              </h1>
              <p className="text-lg text-gray-600 dark:text-gray-300 mt-1">{selectedSurah.englishNameTranslation}</p>
            </div>
            <div className="text-right">
              <h2 className="font-arabic text-4xl text-gray-800 dark:text-white mb-1">{selectedSurah.name}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {selectedSurah.revelationType === 'Meccan' ? 'Mecquoise' : 'Médinoise'} • {selectedSurah.numberOfAyahs} versets
              </p>
            </div>
          </div>
          
          <div className="flex items-center justify-between gap-3 mb-6">
            <button
              onClick={handlePlayFullSurah}
              className={`flex-1 px-4 py-3 rounded-xl flex items-center justify-center space-x-3 transition-colors ${
                isAudioLoading 
                  ? 'bg-yellow-100/70 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400' 
                  : isPlayingFullSurah 
                    ? 'bg-red-100/70 dark:bg-red-500/20 text-red-700 dark:text-red-400' 
                    : 'bg-emerald-100/70 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400'
              }`}
            >
              {isAudioLoading ? (
                <>
                  <div className="h-5 w-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-lg font-medium">Chargement...</span>
                </>
              ) : isPlayingFullSurah ? (
                <>
                  <FaPause size={20} />
                  <span className="text-lg font-medium">Pause</span>
                </>
              ) : (
                <>
                  <FaPlay size={20} />
                  <span className="text-lg font-medium">Lire</span>
                </>
              )}
            </button>

            <div className="relative">
              <button
                onClick={() => setIsReciterMenuOpen(!isReciterMenuOpen)}
                className="h-full px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 flex items-center justify-center"
              >
                <FaMicrophone size={20} />
                <FaChevronDown size={12} className="ml-2" />
              </button>
              
              {isReciterMenuOpen && (
                <div className="absolute right-0 z-10 mt-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg">
                  {reciters
                    .filter(reciter => availableReciters.includes(reciter.identifier))
                    .map(reciter => (
                      <button
                        key={reciter.identifier}
                        onClick={() => handleReciterChange(reciter.identifier)}
                        className={`w-full text-left px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                          selectedReciter === reciter.identifier ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        <div>{reciter.name}</div>
                        <div className="text-xs text-gray-500">{reciter.arabicName}</div>
                      </button>
                    ))}
                </div>
              )}
            </div>

            <div className="relative" ref={settingsRef}>
              <button
                onClick={() => setShowTextSizeControls(!showTextSizeControls)}
                className={`h-full px-4 py-3 rounded-xl ${
                  showTextSizeControls ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' : 'bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300'
                } flex items-center justify-center`}
              >
                <FaCog size={20} />
              </button>
              
              {showTextSizeControls && (
                <div className="absolute right-0 top-full mt-2 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10 w-64">
                  <div className="flex flex-col space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-700 dark:text-gray-300 flex items-center">
                        <FaLanguage size={18} className="mr-2" /> 
                        Traduction
                      </span>
                      <button 
                        onClick={() => setShowTranslation(!showTranslation)}
                        className={`w-12 h-6 rounded-full flex items-center transition-colors ${
                          showTranslation ? 'bg-blue-500 justify-end' : 'bg-gray-300 dark:bg-gray-600 justify-start'
                        }`}
                      >
                        <span className={`w-5 h-5 rounded-full mx-0.5 ${showTranslation ? 'bg-white' : 'bg-gray-100 dark:bg-gray-400'}`}></span>
                      </button>
                    </div>
                    
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-700 dark:text-gray-300 flex items-center">
                          <FaFont size={16} className="mr-2" /> 
                          Taille du texte
                        </span>
                      </div>
                      <div className="mb-1 flex justify-between text-xs text-gray-500">
                        <span>Petit</span>
                        <span>Grand</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="4" 
                        value={textSizeLevel} 
                        onChange={handleTextSizeChange}
                        className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                      />
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          Taille: {textSizeLevel === 0 ? 'Très petit' : 
                                   textSizeLevel === 1 ? 'Petit' : 
                                   textSizeLevel === 2 ? 'Normal' : 
                                   textSizeLevel === 3 ? 'Grand' : 'Très grand'}
                        </span>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {textSizeLevel + 1}/5
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Barre de progression audio pour la sourate entière */}
          {isPlayingFullSurah && currentAudioRef.current && (
            <div className="mb-6 w-full">
              <div 
                className="relative h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden cursor-pointer"
                onClick={handleProgressBarClick}
              >
                <div 
                  className="absolute left-0 top-0 h-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${audioProgress * 100}%` }}
                ></div>
              </div>
              <div className="flex justify-between mt-2 text-sm text-gray-500 dark:text-gray-400">
                <span>{formatTime(currentAudioRef.current.currentTime)}</span>
                <span>{currentAudioRef.current.duration ? formatTime(currentAudioRef.current.duration) : 'Chargement...'}</span>
              </div>
            </div>
          )}

          {loadingAyahs ? (
            <div className="flex justify-center py-12">
              <div className="w-10 h-10 border-4 border-emerald-200 dark:border-gray-700 border-t-emerald-500 rounded-full animate-spin"></div>
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-500">{error}</div>
          ) : (
            <div className="space-y-4">
              {ayahs.map((ayah) => {
                const textSize = getTextSize();
                return (
                  <div 
                    key={ayah.number.toString()} 
                    id={`verse-${ayah.numberInSurah}`} 
                    className={`py-3 ${
                      currentAyah === ayah.numberInSurah ? 'bg-emerald-50/70 dark:bg-emerald-900/10 rounded-lg px-3 -mx-3' : ''
                    } ${ayah.numberInSurah !== ayahs.length ? 'border-b border-gray-200 dark:border-gray-700/30' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="bg-emerald-50 dark:bg-gray-800/70 text-emerald-700 dark:text-emerald-400 font-medium rounded-full w-8 h-8 flex items-center justify-center text-xs">
                        {ayah.numberInSurah}
                      </div>
                      <button
                        aria-label={playingAyah === ayah.numberInSurah ? "Pause" : "Play"}
                        onClick={() => playingAyah === ayah.numberInSurah ? handleStopAudio() : handlePlayAudio(ayah.audio, ayah.numberInSurah)}
                        className="bg-emerald-50 dark:bg-gray-800/70 text-emerald-700 dark:text-emerald-400 rounded-full p-2"
                      >
                        {playingAyah === ayah.numberInSurah ? <FaPause size={10} /> : <FaPlay size={10} />}
                      </button>
                    </div>
                    <p className={`text-right font-arabic leading-relaxed text-gray-800 dark:text-white py-1 ${textSize.arabic}`}>{ayah.text}</p>
                    {showTranslation && ayah.translation && (
                      <p className={`mt-2 text-gray-600 dark:text-gray-400 leading-relaxed ${textSize.translation}`}>{ayah.translation}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );

  // Pour iOS, nous devons activer la lecture audio à l'avance lors de la première interaction utilisateur
  useEffect(() => {
    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
    if (isIOS) {
      // Fonction pour initialiser l'audio sur iOS
      const initializeIOSAudio = () => {
        const silentAudio = new Audio();
        silentAudio.src = "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4LjIwLjEwMAAAAAAAAAAAAAAA//tUwAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAABAAADQgD///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////8AAAA5TEFNRTMuMTAwBK8AAAAAAAAAABUgJAUHQQAB9gAAA0LJ5EPfAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
        silentAudio.volume = 0.001;
        silentAudio.autoplay = true;
        silentAudio.onended = () => {
          document.body.removeEventListener('click', initializeIOSAudio);
          document.body.removeEventListener('touchstart', initializeIOSAudio);
        };
        silentAudio.play().catch(err => console.log('Échec de l\'initialisation audio:', err));
      };

      // Ajouter les écouteurs d'événements pour la première interaction
      document.body.addEventListener('click', initializeIOSAudio, { once: true });
      document.body.addEventListener('touchstart', initializeIOSAudio, { once: true });
      
      // Nettoyage
      return () => {
        document.body.removeEventListener('click', initializeIOSAudio);
        document.body.removeEventListener('touchstart', initializeIOSAudio);
      };
    }
  }, []);

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