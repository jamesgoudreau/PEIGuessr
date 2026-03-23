'use client';

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { Crown } from 'lucide-react';

interface ScoreEntry {
  id: string;
  username: string;
  best_score: number;
  total_score: number;
  total_games: number;
}

export default function Leaderboard() {
  const [activeTab, setActiveTab] = useState<'today' | 'allTime'>('today');
  const [scores, setScores] = useState<ScoreEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db) {
       setLoading(false);
       return;
    }
    
    setLoading(true);
    let collectionName = 'leaderboard';
    if (activeTab === 'today') {
      const todayStr = new Date().toISOString().split('T')[0];
      collectionName = `daily_leaderboard_${todayStr.replace(/-/g, '_')}`;
    }

    const q = query(collection(db, collectionName), orderBy('total_score', 'desc'), limit(10));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedScores = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ScoreEntry[];
      setScores(fetchedScores);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching leaderboard", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [activeTab]);

  if (loading) {
    return <div className="animate-pulse text-blue-800 p-4 font-bold">Loading top Island guessers...</div>;
  }

  return (
    <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden border border-white/50 mt-4 w-full">
      <div className="p-4 md:p-5 flex justify-between items-center bg-white/40">
        <div className="font-black text-blue-900 text-lg uppercase tracking-widest pl-1 shadow-sm">Leaderboard</div>
        <div className="flex gap-1 bg-white rounded-full p-1 shadow-inner border border-gray-100">
          <button 
            onClick={() => setActiveTab('today')}
            className={`px-4 py-1.5 rounded-full font-bold text-xs transition-colors ${activeTab === 'today' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-800'}`}
          >
            Today's Best
          </button>
          <button 
            onClick={() => setActiveTab('allTime')}
            className={`px-4 py-1.5 rounded-full font-bold text-xs transition-colors ${activeTab === 'allTime' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-800'}`}
          >
            All-Time
          </button>
        </div>
      </div>
      <div className="p-3">
        {scores.length === 0 ? (
          <p className="text-gray-500 text-center p-6 italic font-medium">No scores yet. Be the first to conquer the Island!</p>
        ) : (
          <ul className="space-y-3">
            {scores.map((score, index) => (
              <li 
                key={score.id} 
                className={`flex justify-between items-center p-3 rounded-2xl ${
                  index === 0 ? 'bg-gradient-to-r from-yellow-200 via-yellow-300 to-yellow-500 border border-yellow-400 shadow-md' : 
                  index === 1 ? 'bg-gradient-to-r from-gray-100 via-gray-200 to-gray-300 border border-gray-300' :
                  index === 2 ? 'bg-gradient-to-r from-orange-100 via-orange-200 to-orange-300 border border-orange-300' : 'bg-white/60 border border-white shadow-sm'
                }`}
              >
                <div className="flex items-center gap-3">
                  {index === 0 ? (
                    <div className="font-black text-xl text-yellow-800 flex items-center justify-center w-10 h-10 relative">
                      <Crown size={24} fill="currentColor" className="absolute opacity-30 transform -translate-y-2 translate-x-2" />
                      #{index + 1}
                    </div>
                  ) : (
                    <div className={`font-black text-xl w-10 text-center ${index === 1 ? 'text-gray-600' : index === 2 ? 'text-orange-800' : 'text-blue-900/50'}`}>#{index + 1}</div>
                  )}
                  <span className="font-bold text-gray-900 text-lg truncate max-w-[120px] md:max-w-[200px]">{score.username}</span>
                </div>
                <div className="text-right flex flex-col items-end">
                  <div className="font-black text-gray-900 text-xl leading-none">{score.total_score || score.best_score} pts total</div>
                  <div className="text-xs font-semibold text-gray-800 leading-tight mt-1">Best: {score.best_score} | {score.total_games} games</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
