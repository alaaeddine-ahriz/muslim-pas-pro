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
  const reciterMenuRef = useRef<HTMLDivElement>(null);

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

    // Add click outside handler for both settings and reciter panels
    const handleClickOutside = (event: MouseEvent) => {
      // Close settings panel if clicked outside
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setShowTextSizeControls(false);
      }
      
      // Close reciter panel if clicked outside
      if (reciterMenuRef.current && !reciterMenuRef.current.contains(event.target as Node)) {
        setIsReciterMenuOpen(false);
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
    
    // Déclarer startIndex au début de la fonction
    let startIndex = 0;
    
    // Si déjà en lecture et qu'on appuie à nouveau, c'est pour mettre en pause
    if (isPlayingFullSurah && audioElement) {
      audioElement.pause();
      setIsPlayingFullSurah(false);
      
      // Sauvegarder l'état de lecture et l'avancement actuel
      const currentProgress = audioProgress;
      
      // Stocker ces informations pour reprendre plus tard
      savePlaybackState(selectedSurah.number, {
        progress: currentProgress,
        verseIndex: currentIndexRef.current,
        surahNumber: selectedSurah.number,
        isPaused: true
      });
      
      return;
    }
    
    // Vérifier s'il y a un état de lecture sauvegardé
    const savedState = getPlaybackState(selectedSurah.number);
    
    // Si nous avons un état sauvegardé et qu'il est en pause, reprendre la lecture
    if (savedState && savedState.isPaused && savedState.surahNumber === selectedSurah.number) {
      startIndex = savedState.verseIndex || 0;
      // Ne pas remettre l'audio à zéro, reprendre là où on s'était arrêté
      setAudioProgress(savedState.progress || 0);
    } else {
      // Nouvel état, commencer du début
      startIndex = 0;
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
    currentIndexRef.current = startIndex;
    
    // Indiquer que l'audio est en cours de chargement
    setIsAudioLoading(true);
    
    const reciterBaseUrl = reciters.find(r => r.identifier === selectedReciter)?.identifier || 'ar.alafasy';
    
    // Construire l'URL pour la sourate complète (utiliser 128kbps pour un chargement plus rapide)
    const fullSurahUrl = `https://cdn.islamic.network/quran/audio-surah/128/${reciterBaseUrl}/${selectedSurah.number}.mp3`;
    
    // Configurer les événements d'audio avant de définir la source
    audio.onloadstart = () => {
      setIsAudioLoading(true);
    };
    
    audio.oncanplaythrough = () => {
      setIsAudioLoading(false);
    };
    
    audio.onwaiting = () => {
      setIsAudioLoading(true);
    };
    
    audio.onplaying = () => {
      setIsAudioLoading(false);
      setIsPlayingFullSurah(true);
    };
    
    audio.onerror = (e) => {
      console.error('Erreur audio:', e);
      setIsAudioLoading(false);
      setIsPlayingFullSurah(false);
    };
    
    audio.onended = () => {
      setIsPlayingFullSurah(false);
      setIsAudioLoading(false);
      
      // Réinitialiser les états quand la lecture est terminée
      if (selectedSurah) {
        clearPlaybackState(selectedSurah.number);
      }
    };
    
    audio.ontimeupdate = () => {
      if (audio && selectedSurah) {
        const currentTime = audio.currentTime;
        const duration = audio.duration || 1;
        const progress = currentTime / duration;
        
        setAudioProgress(progress);
        
        // Mise à jour périodique pour sauvegarder la progression
        if (Math.floor(currentTime) % 5 === 0) { // Sauvegarder toutes les 5 secondes environ
          savePlaybackState(selectedSurah.number, {
            progress: progress,
            verseIndex: currentIndexRef.current,
            surahNumber: selectedSurah.number,
            isPaused: false,
            time: currentTime
          });
        }
      }
    };
    
    // Définir la source après avoir configuré tous les écouteurs d'événements
    audio.src = fullSurahUrl;
    
    // Si nous avons un état sauvegardé avec une position spécifique
    if (savedState && savedState.time) {
      const timeToStart = parseFloat(savedState.time.toString());
      if (!isNaN(timeToStart)) {
        audio.currentTime = timeToStart;
      }
    }
    
    // Jouer l'audio
    try {
      // Sur iOS, nous devons utiliser une approche différente pour la lecture après un événement utilisateur
      const playPromise = audio.play();
      
      if (playPromise !== undefined) {
        playPromise.then(() => {
          // La lecture a démarré avec succès
          setIsPlayingFullSurah(true);
          setIsAudioLoading(false);
        }).catch(err => {
          console.error('Erreur lors de la lecture:', err);
          
          // Sur iOS Safari, nous pouvons avoir besoin d'un interaction utilisateur
          // Nous allons donc essayer de charger l'audio sans le jouer
          audio.load();
          setIsPlayingFullSurah(false);
          setIsAudioLoading(false);
        });
      }
    } catch (err) {
      console.error('Erreur de lecture:', err);
      setIsPlayingFullSurah(false);
      setIsAudioLoading(false);
    }
  };

  // Fonction pour gérer le changement de récitateur
  const handleReciterChange = (reciterId: string) => {
    // Better verification that the reciter is available
    if (!availableReciters.includes(reciterId)) {
      console.warn(`Reciter ${reciterId} is not available for this surah`);
      return;
    }
    
    setSelectedReciter(reciterId);
    setIsReciterMenuOpen(false);
    
    // Save the preference
    try {
      localStorage.setItem('selectedReciter', reciterId);
    } catch (error) {
      console.error("Error saving reciter preference:", error);
    }
    
    // Reload ayahs with the new reciter if a surah is selected
    if (selectedSurah) {
      // Stop current audio
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
      // First try to check with HEAD request
      try {
        const response = await axios.head(`https://api.alquran.cloud/v1/surah/${surahNumber}/${reciterId}`);
        return response.status === 200;
      } catch (headError) {
        // If HEAD fails, try a GET request to a specific ayah instead
        const testResponse = await axios.get(`https://cdn.islamic.network/quran/audio/128/${reciterId}/${surahNumber}:1.mp3`, {
          responseType: 'blob',
          timeout: 5000 // 5-second timeout
        });
        return testResponse.status === 200;
      }
    } catch (error) {
      console.log(`Reciter ${reciterId} not available for surah ${surahNumber}`);
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
        setAvailableReciters([]); // Clear the list first
        
        // Show loading state
        const loadingReciters = ['ar.alafasy']; // Consider Alafasy always available initially
        setAvailableReciters(loadingReciters);
        
        // Check each reciter in parallel
        const reciterChecks = reciters.map(async reciter => {
          if (reciter.identifier === 'ar.alafasy') return reciter.identifier; // Always include Alafasy
          
          const isAvailable = await checkReciterAvailability(reciter.identifier, selectedSurah.number);
          if (isAvailable) {
            return reciter.identifier;
          }
          return null;
        });
        
        // Wait for all checks to complete
        const availableResults = await Promise.all(reciterChecks);
        const available = availableResults.filter(id => id !== null) as string[];
        
        setAvailableReciters(available);
        
        // If current reciter is not available, switch to first available
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
    const newSize = parseFloat(e.target.value);
    setTextSizeLevel(newSize);
    // Store only integer values in localStorage to maintain compatibility
    localStorage.setItem('textSizeLevel', Math.round(newSize).toString());
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
          
          <div className="flex items-center justify-between gap-2 mb-6">
            <button
              onClick={handlePlayFullSurah}
              className={`h-12 flex-1 px-3 py-2 rounded-lg flex items-center justify-center space-x-2 transition-colors ${
                isAudioLoading 
                  ? 'bg-yellow-100/70 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400' 
                  : isPlayingFullSurah 
                    ? 'bg-red-100/70 dark:bg-red-500/20 text-red-700 dark:text-red-400' 
                    : 'bg-emerald-100/70 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400'
              }`}
            >
              {isAudioLoading ? (
                <>
                  <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-base font-medium">Chargement...</span>
                </>
              ) : isPlayingFullSurah ? (
                <>
                  <FaPause size={16} />
                  <span className="text-base font-medium">Pause</span>
                </>
              ) : (
                <>
                  <FaPlay size={16} />
                  <span className="text-base font-medium">Lire</span>
                </>
              )}
            </button>

            <div className="relative" ref={reciterMenuRef}>
              <button
                onClick={() => {
                  setIsReciterMenuOpen(!isReciterMenuOpen);
                  // Close other menu if open
                  setShowTextSizeControls(false);
                }}
                className={`h-12 w-12 rounded-lg ${
                  isReciterMenuOpen 
                    ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                    : 'bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300'
                } flex items-center justify-center`}
              >
                <FaMicrophone size={16} />
              </button>
              
              {isReciterMenuOpen && (
                <div className="absolute right-0 z-10 mt-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
                  {availableReciters.length === 0 ? (
                    <div className="p-3 text-center text-gray-500 dark:text-gray-400">
                      <div className="h-5 w-5 border-2 border-current border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                      Chargement des récitateurs...
                    </div>
                  ) : (
                    reciters.map(reciter => {
                      const isAvailable = availableReciters.includes(reciter.identifier);
                      return (
                        <button
                          key={reciter.identifier}
                          onClick={() => isAvailable && handleReciterChange(reciter.identifier)}
                          className={`w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                            !isAvailable 
                              ? 'opacity-50 cursor-not-allowed text-gray-400 dark:text-gray-600' 
                              : selectedReciter === reciter.identifier 
                                ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' 
                                : 'text-gray-700 dark:text-gray-300'
                          }`}
                          disabled={!isAvailable}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-sm">{reciter.name}</div>
                              <div className="text-xs text-gray-500">{reciter.arabicName}</div>
                            </div>
                            {!isAvailable && <span className="text-xs bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded-full">Indisponible</span>}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            <div className="relative" ref={settingsRef}>
              <button
                onClick={() => {
                  setShowTextSizeControls(!showTextSizeControls);
                  // Close other menu if open
                  setIsReciterMenuOpen(false);
                }}
                className={`h-12 w-12 rounded-lg ${
                  showTextSizeControls ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' : 'bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300'
                } flex items-center justify-center`}
              >
                <FaCog size={16} />
              </button>
              
              {showTextSizeControls && (
                <div className="absolute right-0 top-full mt-2 p-3 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10 w-64">
                  <div className="flex flex-col space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700 dark:text-gray-300 flex items-center">
                        <FaLanguage size={16} className="mr-2" /> 
                        Traduction
                      </span>
                      <button 
                        onClick={() => setShowTranslation(!showTranslation)}
                        className={`w-10 h-5 rounded-full flex items-center transition-colors ${
                          showTranslation ? 'bg-blue-500 justify-end' : 'bg-gray-300 dark:bg-gray-600 justify-start'
                        }`}
                      >
                        <span className={`w-4 h-4 rounded-full mx-0.5 ${showTranslation ? 'bg-white' : 'bg-gray-100 dark:bg-gray-400'}`}></span>
                      </button>
                    </div>
                    
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-700 dark:text-gray-300 flex items-center">
                          <FaFont size={14} className="mr-2" /> 
                          Taille du texte
                        </span>
                      </div>
                      
                      <div className="mt-2">
                        <div className="flex justify-between px-1 mb-1">
                          {[0, 1, 2, 3, 4].map(step => (
                            <div 
                              key={step}
                              className={`w-1 h-3 rounded-full ${textSizeLevel >= step ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                            ></div>
                          ))}
                        </div>
                        <input 
                          type="range" 
                          min="0" 
                          max="4" 
                          step="1"
                          value={textSizeLevel} 
                          onChange={handleTextSizeChange}
                          className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                          style={{
                            background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${textSizeLevel / 4 * 100}%, #e5e7eb ${textSizeLevel / 4 * 100}%, #e5e7eb 100%)`,
                          }}
                        />
                        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1 px-1">
                          <span>Petit</span>
                          <span>Normal</span>
                          <span>Grand</span>
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
            <div className="mb-4 w-full">
              <div 
                className="relative h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden cursor-pointer"
                onClick={handleProgressBarClick}
              >
                <div 
                  className="absolute left-0 top-0 h-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${audioProgress * 100}%` }}
                ></div>
              </div>
              <div className="flex justify-between mt-1 text-xs text-gray-500 dark:text-gray-400">
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