'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import StreetView from '@/components/StreetView';
import GuessMap from '@/components/GuessMap';
import { getRandomLocation, calculateDistance, calculateScore } from '@/utils/gameLogic';
import { MapPin, Share2, Play, ChevronLeft } from 'lucide-react';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, setDoc, collection } from 'firebase/firestore';

export default function GamePage() {
  const router = useRouter();
  
  const [actualLocation, setActualLocation] = useState<{lat: number, lng: number} | null>(null);
  const [guessLocation, setGuessLocation] = useState<{lat: number, lng: number} | null>(null);
  const [gamePhase, setGamePhase] = useState<'playing' | 'guessing' | 'result'>('playing');
  const [roundId, setRoundId] = useState(0);
  const [score, setScore] = useState<number | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [hasSnapped, setHasSnapped] = useState(false);
  const [timeLeft, setTimeLeft] = useState(15);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const playBeep = useCallback((timeRemaining: number) => {
    try {
      if (!audioCtxRef.current) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          audioCtxRef.current = new AudioContextClass();
        }
      }
      const ctx = audioCtxRef.current;
      if (!ctx) return;

      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      const freq = timeRemaining === 0 ? 600 : (timeRemaining <= 3 ? 880 : 440); 
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      
      gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + (timeRemaining === 0 ? 0.3 : 0.1));
      
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + (timeRemaining === 0 ? 0.3 : 0.1));
    } catch (e) {
      console.warn('Audio play failed', e);
    }
  }, []);

  useEffect(() => {
    // Start game on mount
    setActualLocation(getRandomLocation());
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (gamePhase === 'playing' && hasSnapped && timeLeft > 0) {
      timer = setTimeout(() => {
        setTimeLeft(prev => {
          const newTime = prev - 1;
          playBeep(newTime);
          return newTime;
        });
      }, 1000);
    } else if (gamePhase === 'playing' && hasSnapped && timeLeft === 0) {
      setGamePhase('guessing');
    }
    return () => clearTimeout(timer);
  }, [gamePhase, hasSnapped, timeLeft, playBeep]);

  const handleLocationSnapped = (snapped: { lat: number; lng: number } | null) => {
    if (snapped) {
      setActualLocation(snapped);
      setHasSnapped(true);
      setTimeLeft(15);
      playBeep(15); // Beep on start
    } else {
      // If the 500m radius failed to find a street view, immediately reroll!
      setActualLocation(getRandomLocation());
    }
  };

  const handleGuess = async (guessObj: {lat: number, lng: number}) => {
    if (!actualLocation) return;
    
    const dist = calculateDistance(actualLocation, guessObj);
    const calculatedScore = calculateScore(dist);
    
    setGuessLocation(guessObj);
    setDistance(dist);
    setScore(calculatedScore);
    setGamePhase('result');

    // Save score if user is logged in
    const user = auth?.currentUser;
    if (user && db) {
      try {
        const todayStr = new Date().toISOString().split('T')[0]; // e.g., "2026-03-23"
        const dailyCollectionName = `daily_leaderboard_${todayStr.replace(/-/g, '_')}`;

        // 1. All-Time Leaderboard saving
        const userRef = doc(db, 'leaderboard', user.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          const data = userSnap.data();
          await setDoc(userRef, {
            username: user.displayName || 'Anonymous Islander',
            best_score: Math.max(data.best_score || 0, calculatedScore),
            total_score: (data.total_score || 0) + calculatedScore,
            total_games: (data.total_games || 0) + 1
          }, { merge: true });
        } else {
          await setDoc(userRef, {
            username: user.displayName || 'Anonymous Islander',
            best_score: calculatedScore,
            total_score: calculatedScore,
            total_games: 1
          });
        }

        // 2. Daily Leaderboard saving
        const dailyRef = doc(db, dailyCollectionName, user.uid);
        const dailySnap = await getDoc(dailyRef);
        
        if (dailySnap.exists()) {
          const dailyData = dailySnap.data();
          await setDoc(dailyRef, {
            username: user.displayName || 'Anonymous Islander',
            best_score: Math.max(dailyData.best_score || 0, calculatedScore),
            total_score: (dailyData.total_score || 0) + calculatedScore,
            total_games: (dailyData.total_games || 0) + 1
          }, { merge: true });
        } else {
          await setDoc(dailyRef, {
            username: user.displayName || 'Anonymous Islander',
            best_score: calculatedScore,
            total_score: calculatedScore,
            total_games: 1
          });
        }
      } catch (e) {
        console.error("Failed to save score", e);
      }
    }
  };

  const handlePlayAgain = () => {
    setActualLocation(getRandomLocation());
    setGuessLocation(null);
    setGamePhase('playing');
    setScore(null);
    setDistance(null);
    setRoundId(prev => prev + 1);
    setHasSnapped(false);
    setTimeLeft(15);
  };

  const handleShare = async () => {
    if (!db || distance === null || score === null || !actualLocation || !guessLocation) return;
    setIsSharing(true);
    try {
      // 1. Create a share tracker document in Firestore
      const shareDocRef = doc(collection(db, 'shares'));
      await setDoc(shareDocRef, {
        distance,
        score,
        actualLocation,
        guessLocation,
        createdAt: new Date().toISOString()
      });

      const shareUrl = `https://pei-guessr.vercel.app/share/${shareDocRef.id}`;
      const shareText = `I scored ${score} points and was only ${distance.toFixed(1)} km away on RedDirtRadar! Can you beat my Island-knowledge?`;

      // 2. Mobile Native Share (Pulls up OS share sheet for Facebook app, Twitter, iMessage, etc)
      if (navigator.share && /Mobi|Android/i.test(navigator.userAgent)) {
        try {
          await navigator.share({
            title: 'RedDirtRadar',
            text: shareText,
            url: shareUrl
          });
          setIsSharing(false);
          return;
        } catch (e) {
          // If they cancel out of the modal, fallback gently
        }
      }

      // 3. Desktop Fallback (Classic Facebook Sharer popup)
      const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
      window.open(fbUrl, 'facebook-share-dialog', 'width=800,height=600');
    } catch (e) {
      console.error("Share error", e);
    }
    setIsSharing(false);
  };

  if (!actualLocation) {
    return (
      <div className="min-h-screen bg-blue-50 flex items-center justify-center">
        <div className="text-3xl font-black text-blue-900 animate-pulse">Dropping you in PEI...</div>
      </div>
    );
  }

  return (
    <main className="relative w-full h-screen overflow-hidden bg-black font-sans">
      
      {/* Background StreetView */}
      <div className={`absolute inset-0 transition-opacity duration-700 ${gamePhase !== 'playing' ? 'opacity-40' : 'opacity-100'}`}>
        <StreetView 
          key={roundId} 
          position={actualLocation} 
          onLocationSnapped={handleLocationSnapped}
        />
      </div>

      {/* Top Bar overlay */}
      <div className="absolute top-0 left-0 right-0 p-4 md:p-6 flex justify-between items-start pointer-events-none z-10">
        <button 
          onClick={() => router.push('/')} 
          className="pointer-events-auto bg-white/90 backdrop-blur-md px-4 py-2 md:px-6 md:py-3 rounded-full shadow-xl text-blue-900 font-bold flex items-center gap-2 hover:bg-white transition-all hover:scale-105"
        >
          <ChevronLeft size={20} /> Quit
        </button>
        <div className="bg-red-600/90 backdrop-blur-md px-6 py-2 md:px-8 md:py-3 rounded-full shadow-2xl text-white font-black text-xl md:text-2xl border-2 border-white/50 tracking-wide">
          RedDirtRadar
        </div>
      </div>

      {/* Floating Map Button in Playing Phase */}
      {gamePhase === 'playing' && (
        <div className="absolute bottom-8 right-8 z-20 flex flex-col items-end gap-3">
          {hasSnapped && (
            <div className="bg-red-600/90 text-white px-6 py-2 rounded-xl font-bold text-xl md:text-2xl border-2 border-white/50 shadow-xl animate-pulse">
              {timeLeft}s remaining!
            </div>
          )}
          <button 
            onClick={() => setGamePhase('guessing')}
            className="flex items-center gap-3 bg-blue-600 hover:bg-blue-700 text-white px-8 py-5 rounded-full shadow-2xl font-black text-xl md:text-2xl transition-all hover:scale-105 hover:-translate-y-1 border-4 border-white/80"
          >
            <MapPin size={32} /> Make a Guess
          </button>
        </div>
      )}

      {/* Guessing Phase Overlay modal */}
      {gamePhase === 'guessing' && (
        <div className="absolute inset-4 md:inset-12 lg:inset-24 z-30 flex flex-col items-center animate-in fade-in zoom-in duration-300">
          <div className="w-full h-full rounded-3xl overflow-hidden shadow-2xl relative border-[4px] md:border-[12px] border-white bg-white">
            <button 
              onClick={() => setGamePhase('playing')}
              className="absolute top-4 left-4 md:top-6 md:left-6 z-40 bg-white/95 backdrop-blur px-3 py-2 md:px-6 md:py-3 rounded-full font-bold shadow-lg text-blue-900 hover:bg-blue-50 transition-colors border border-blue-100 flex items-center gap-1 md:gap-2"
            >
              <ChevronLeft size={18} />
              <span className="hidden md:inline">Back to Street View</span>
              <span className="inline md:hidden">Back</span>
            </button>
            <GuessMap onGuess={handleGuess} gamePhase="guessing" />
          </div>
        </div>
      )}

      {/* Result Phase Overlay */}
      {gamePhase === 'result' && (
        <div className="absolute inset-0 z-40 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-500">
          <div className="bg-white rounded-[2rem] w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] border-4 border-white">
            {/* Score Header */}
            <div className="bg-gradient-to-r from-blue-900 to-blue-800 text-white p-4 md:p-6 text-center shrink-0 border-b-4 border-yellow-400">
              <h2 className="text-4xl md:text-5xl font-black mb-1 md:mb-2 text-yellow-400 drop-shadow-md">{score} Points</h2>
              <p className="text-lg md:text-xl opacity-90 font-medium">You were {distance?.toFixed(1)} km away!</p>
            </div>
            
            {/* Map Result */}
            <div className="flex-1 relative bg-blue-50">
              <GuessMap onGuess={() => {}} guessLocation={guessLocation} actualLocation={actualLocation} gamePhase="result" />
            </div>

            {/* Actions */}
            <div className="bg-gray-100 p-6 md:p-8 flex flex-col md:flex-row gap-4 md:gap-6 justify-center shrink-0">
              <button 
                onClick={() => router.push('/')}
                className="flex-[0.5] md:max-w-[150px] flex items-center justify-center gap-2 px-6 py-5 bg-white hover:bg-gray-50 text-gray-700 font-bold rounded-full text-xl shadow-md transition-all border-2 border-gray-200"
              >
                <ChevronLeft size={24} /> Quit
              </button>
              <button 
                onClick={handlePlayAgain}
                className="flex-1 max-w-xs flex items-center justify-center gap-3 px-8 py-5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-full text-xl shadow-xl transition-all hover:scale-105 hover:-translate-y-1"
              >
                <Play size={28} /> Play Again
              </button>
              <button 
                onClick={handleShare}
                disabled={isSharing}
                className="flex-1 max-w-xs flex items-center justify-center gap-3 px-8 py-5 bg-[#1877F2] hover:bg-[#166FE5] disabled:bg-[#1877f2]/70 text-white font-black rounded-full text-xl shadow-xl transition-all hover:scale-105 hover:-translate-y-1"
              >
                <Share2 size={28} /> {isSharing ? 'Loading...' : 'Share'}
              </button>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}
