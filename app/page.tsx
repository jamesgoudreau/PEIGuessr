'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth, googleProvider } from '@/lib/firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, sendEmailVerification } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Leaderboard from '@/components/Leaderboard';
import { MapPin, LogIn, LogOut, Play } from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  // Auth Form State
  const [authMode, setAuthMode] = useState<'main'|'login'|'signup'>('main');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);

  const [needsName, setNeedsName] = useState(false);
  const [customName, setCustomName] = useState('');

  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser && db && authMode !== 'signup') {
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (!userDoc.exists()) {
            setNeedsName(true);
            setCustomName(currentUser.displayName || '');
          } else {
            setNeedsName(false);
          }
        } catch (e) {
          console.error("Error fetching user doc", e);
        }
      }
    });
    return () => unsubscribe();
  }, [authMode]);

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !db) return;
    setAuthLoading(true);
    setAuthError('');
    try {
      if (customName) {
        await updateProfile(user, { displayName: customName });
        await setDoc(doc(db, 'users', user.uid), { displayName: customName, createdAt: new Date() });
      }
      setNeedsName(false);
    } catch (error: any) {
      setAuthError(error.message || "Failed to save Display Name.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!auth) return alert("Firebase not configured!");
    setAuthError('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      setAuthError(error.message || "Google sign-in failed.");
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    setAuthError('');
    setAuthLoading(true);
    
    try {
      if (authMode === 'signup') {
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCred.user, { displayName: name });
        if (db) await setDoc(doc(db, 'users', userCred.user.uid), { displayName: name, createdAt: new Date() });
        await sendEmailVerification(userCred.user);
        setVerificationSent(true);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (error: any) {
      setAuthError(error.message || "Authentication failed.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (user) {
      try {
        await sendEmailVerification(user);
        setVerificationSent(true);
      } catch (error: any) {
        setAuthError("Please wait a moment before requesting another email.");
      }
    }
  };

  const handleSignOut = () => {
    if (!auth) return;
    signOut(auth);
    setEmail(''); setPassword(''); setName(''); setAuthError(''); setVerificationSent(false); setNeedsName(false);
  };

  return (
    <main className="min-h-screen bg-cover bg-center flex flex-col items-center justify-center py-12 px-4 relative font-sans" style={{ backgroundImage: "url('/bg-pei.png')" }}>
      
      <div className="z-10 w-full flex flex-col items-center max-w-lg">
        
        {/* Main Glass Card */}
        <div className="bg-white/80 backdrop-blur-2xl p-8 md:p-10 rounded-[2rem] shadow-2xl border border-white/50 flex flex-col items-center w-full">
          
          <div className="text-center mb-8">
            <h1 className="flex items-center justify-center text-5xl md:text-6xl font-black tracking-tighter drop-shadow-sm mb-4">
              <span className="text-red-600">Red</span>
              <span className="text-blue-900 flex items-center tracking-tight">
                D
                <div className="relative inline-flex items-center flex-col mx-[2px]">
                  <MapPin className="text-red-600 fill-white absolute -top-[1.4rem] z-10 drop-shadow-sm" size={26} strokeWidth={2.5} />
                  <span className="relative z-0">i</span>
                </div>
                rtRadar
              </span>
            </h1>
            <p className="text-lg text-gray-800 font-medium max-w-[300px] mx-auto">
              Dropped somewhere on Prince Edward Island. Can you figure out where you are?
            </p>
          </div>

        {/* Auth & Play Actions */}
        <div className="flex flex-col items-center w-full">
          {user ? (
            needsName ? (
              <form onSubmit={handleSaveName} className="w-full flex flex-col items-center bg-white/90 p-6 md:p-8 rounded-2xl border border-blue-200 shadow-xl text-center animate-in fade-in duration-300">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 mb-4 shadow-inner">
                  <MapPin size={32} />
                </div>
                <h2 className="text-2xl font-black text-gray-900 mb-2 tracking-tight">Choose your Handle</h2>
                <p className="text-gray-700 font-medium mb-6">
                  What should we call you on the global leaderboard?
                </p>
                {authError && <div className="bg-red-50 text-red-600 p-3 w-full rounded-xl shadow-sm border border-red-200 text-sm font-bold text-center mb-4">{authError}</div>}
                
                <input 
                  type="text" 
                  required 
                  placeholder="Islander Handle" 
                  value={customName} 
                  onChange={e => setCustomName(e.target.value)}
                  className="w-full p-4 rounded-xl border-2 border-gray-200 focus:border-blue-500 outline-none font-bold text-gray-900 placeholder:text-gray-400 mb-6 text-center shadow-sm" 
                />
                
                <button 
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-black rounded-xl transition-all shadow-md text-lg"
                >
                  {authLoading ? 'Saving...' : 'Save & Continue'}
                </button>
              </form>
            ) : !user.emailVerified ? (
              <div className="w-full flex flex-col items-center bg-white/90 p-6 rounded-2xl border border-yellow-300 shadow-sm text-center">
                <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center text-yellow-600 mb-4 shadow-inner">
                  <MapPin size={32} />
                </div>
                <h2 className="text-2xl font-black text-gray-900 mb-2 tracking-tight">Verify your email!</h2>
                <p className="text-gray-700 font-medium mb-6">
                  We've sent a verification link to <span className="font-bold">{user.email}</span>. You must click the incoming link before you can start exploring the Island!
                </p>
                {authError && <p className="text-red-500 text-sm font-bold mb-4">{authError}</p>}
                {verificationSent && <p className="text-emerald-600 text-sm font-bold mb-4 border border-emerald-200 bg-emerald-50 p-2 rounded-lg">Verification resent successfully! Check your inbox/spam.</p>}
                
                <div className="flex flex-col w-full gap-3">
                  <button 
                    onClick={() => window.location.reload()}
                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl transition-all shadow-md flex justify-center gap-2 items-center text-lg hover:scale-[1.02]"
                  >
                    I've Verified It!
                  </button>
                  <button 
                    onClick={handleResendVerification}
                    className="w-full py-3 bg-blue-100 hover:bg-blue-200 text-blue-800 font-bold rounded-xl transition-all shadow-sm flex justify-center gap-2 items-center"
                  >
                    Resend Verification Link
                  </button>
                  <button 
                    onClick={handleSignOut}
                    className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold rounded-xl transition-all"
                  >
                    Sign Out & Change Acct
                  </button>
                </div>
              </div>
            ) : (
              <div className="w-full flex flex-col items-center">
                <div className="flex items-center justify-between gap-4 mb-8 bg-white/90 w-full p-4 rounded-xl border border-gray-200 shadow-sm cursor-pointer hover:bg-white" onClick={handleSignOut} title="Click to sign out">
                  <div className="flex items-center gap-4">
                    {user.photoURL ? (
                      <img src={user.photoURL} alt="Avatar" className="w-12 h-12 rounded-full shadow-sm" />
                    ) : (
                      <div className="w-12 h-12 bg-blue-100 rounded-full font-black text-blue-900 flex items-center justify-center text-2xl uppercase">
                        {user.displayName?.charAt(0) || 'I'}
                      </div>
                    )}
                    <div className="flex-1 overflow-hidden text-left">
                      <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Welcome back,</p>
                      <p className="font-black text-gray-900 text-xl truncate">{user.displayName || 'Islander'}</p>
                    </div>
                  </div>
                  <div className="text-gray-400 font-black px-2">&gt;</div>
                </div>
                
                <button 
                  onClick={() => router.push('/game')}
                  className="w-full py-5 bg-gradient-to-b from-red-500 to-red-700 text-white font-black text-3xl rounded-2xl shadow-[0_8px_0_rgb(153,27,27)] active:shadow-[0_0px_0_rgb(153,27,27)] active:translate-y-[8px] transition-all flex items-center justify-center gap-3"
                >
                  <Play fill="currentColor" size={32} /> Start Exploring
                </button>
              </div>
            )
          ) : (
            <div className="w-full flex flex-col items-center">
              {authMode === 'main' && (
                <div className="w-full flex flex-col items-center animate-in fade-in duration-300">
                  <p className="mb-8 text-center text-gray-800 font-bold text-lg">
                    Sign in to save your scores to the global leaderboard!
                  </p>
                  <button 
                    onClick={handleGoogleSignIn}
                    className="w-full py-5 bg-blue-600 hover:bg-blue-700 text-white font-black text-2xl rounded-2xl shadow-[0_8px_0_0_#1e3a8a] active:shadow-[0_0px_0_0_#1e3a8a] active:translate-y-[8px] transition-all flex items-center justify-center gap-4 mb-6"
                  >
                    <div className="bg-white p-1 rounded-full shadow-sm flex items-center justify-center">
                      <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-7 h-7" alt="Google" />
                    </div>
                    Sign in with Google
                  </button>

                  <div className="relative w-full text-center mt-2 mb-6">
                    <hr className="border-gray-200 border-2 absolute w-full top-1/2 rounded" />
                    <span className="px-6 text-gray-500 bg-white/80 backdrop-blur text-sm font-black relative z-10 tracking-widest uppercase rounded-full">OR</span>
                  </div>

                  <button 
                    onClick={() => router.push('/game')}
                    className="w-full py-4 bg-white hover:bg-gray-50 text-gray-700 font-black text-xl rounded-2xl transition-colors border-2 border-gray-200 shadow-sm mb-6"
                  >
                    Play as Guest
                  </button>

                  <button 
                    onClick={() => setAuthMode('login')}
                    className="text-gray-500 hover:text-blue-700 font-bold text-sm underline decoration-2 underline-offset-4 transition-colors"
                  >
                    Prefer email and password? Sign In / Sign Up
                  </button>
                </div>
              )}

              {(authMode === 'login' || authMode === 'signup') && (
                <form onSubmit={handleEmailAuth} className="w-full flex flex-col gap-3 bg-white/90 p-6 md:p-8 rounded-2xl border border-gray-100 shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <h3 className="font-black text-gray-900 text-2xl mb-4 text-center">
                    {authMode === 'login' ? 'Sign In with Email' : 'Create an Account'}
                  </h3>
                  
                  {authError && <div className="bg-red-50 text-red-600 p-3 rounded-xl shadow-sm border border-red-200 text-sm font-bold text-center mb-2">{authError}</div>}
                  
                  {authMode === 'signup' && (
                    <input 
                      type="text" 
                      required 
                      placeholder="Display Name" 
                      value={name} 
                      onChange={e => setName(e.target.value)}
                      className="w-full p-4 rounded-xl border-2 border-gray-200 focus:border-blue-500 outline-none font-bold text-gray-900 placeholder:text-gray-400 placeholder:font-medium transition-colors bg-white shadow-sm" 
                    />
                  )}
                  <input 
                    type="email" 
                    required 
                    placeholder="Email Address" 
                    value={email} 
                    onChange={e => setEmail(e.target.value)}
                    className="w-full p-4 rounded-xl border-2 border-gray-200 focus:border-blue-500 outline-none font-bold text-gray-900 placeholder:text-gray-400 placeholder:font-medium transition-colors bg-white shadow-sm" 
                  />
                  <input 
                    type="password" 
                    required 
                    placeholder="Password" 
                    value={password} 
                    onChange={e => setPassword(e.target.value)}
                    className="w-full p-4 rounded-xl border-2 border-gray-200 focus:border-blue-500 outline-none font-bold text-gray-900 placeholder:text-gray-400 placeholder:font-medium transition-colors bg-white shadow-sm" 
                  />
                  
                  <button 
                    type="submit" 
                    disabled={authLoading}
                    className="w-full py-4 mt-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-black text-xl rounded-xl shadow-md hover:shadow-lg transition-all"
                  >
                    {authLoading ? 'Processing...' : authMode === 'login' ? 'Sign In' : 'Create Account'}
                  </button>
                  
                  <div className="flex flex-col items-center gap-3 mt-4">
                    <button 
                      type="button" 
                      onClick={() => { setAuthMode(authMode === 'login' ? 'signup' : 'login'); setAuthError(''); }}
                      className="text-blue-700 hover:text-red-600 font-bold text-sm underline decoration-2 underline-offset-4"
                    >
                      {authMode === 'login' ? "Don't have an account? Sign Up" : 'Already have an account? Sign In'}
                    </button>
                    
                    <button 
                      type="button" 
                      onClick={() => { setAuthMode('main'); setAuthError(''); }}
                      className="text-gray-400 hover:text-gray-600 font-bold text-xs uppercase tracking-widest mt-2"
                    >
                      ← Back to Options
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
        </div>

        {/* Leaderboard */}
        <Leaderboard />

      </div>
    </main>
  );
}
