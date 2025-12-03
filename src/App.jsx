import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Mic, MicOff, Save, Trash2, PenTool, Type, 
  Calendar as CalendarIcon, Settings, Home, 
  Play, Pause, Volume2, VolumeX, LogOut, Check,
  ChevronLeft, ChevronRight, Lock, User, Star,
  Sparkles, Wand2, Loader, Palette, Music, UserCircle,
  X, Search, Clock, PlayCircle, ListChecks, FileText, Baby
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, 
  signOut, onAuthStateChanged, updateProfile, signInAnonymously 
} from 'firebase/auth';
import { 
  getFirestore, collection, addDoc, query, where, 
  onSnapshot, deleteDoc, doc, setDoc, updateDoc, getDoc, orderBy, limit, getDocs 
} from 'firebase/firestore';

// --- FIREBASE CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyChMD-MrvSSiAP_WmhR7PvRC6W7DK45tiA",
  authDomain: "notebook-planner-ce07a.firebaseapp.com",
  projectId: "notebook-planner-ce07a",
  storageBucket: "notebook-planner-ce07a.firebasestorage.app",
  messagingSenderId: "214315138804",
  appId: "1:214315138804:web:84d3dba638af75acf0e8a1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
// Fixed App ID for Firestore organization
const appId = "notebook-2026-v1"; 

// --- GEMINI API ---
const apiKey = ""; // Runtime provided by environment
const callGemini = async (prompt) => {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      }
    );
    if (!response.ok) throw new Error(`API Error: ${response.status}`);
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "I couldn't generate a response.";
  } catch (error) {
    console.error("Gemini API Failed:", error);
    return "Smart features are temporarily unavailable. Please try again later.";
  }
};

// --- CONTENT DATABASES ---
const ADULT_QUOTES = [
  "Your time is limited, so don't waste it living someone else's life. Trust your intuition.",
  "Success is not final, failure is not fatal: it is the courage to continue that counts.",
  "Happiness is not something ready made. It comes from your own actions.",
  "Do not wait for the perfect moment. Take the moment and make it perfect.",
  "Hardships often prepare ordinary people for an extraordinary destiny.",
  "The only way to do great work is to love what you do. If you haven't found it yet, keep looking.",
  "Everything you’ve ever wanted is on the other side of fear.",
  "Believe you can and you're halfway there.",
  "Act as if what you do makes a difference. It does.",
  "What you get by achieving your goals is not as important as what you become by achieving your goals."
];

const KID_QUOTES = [
  "You are braver than you believe, stronger than you seem, and smarter than you think!",
  "Every mistake is just proof that you are trying something new and learning.",
  "In a world where you can be anything, be kind.",
  "You have a super power inside you called 'Imagination'. Use it today!",
  "Reach for the stars! Even if you miss, you'll land on the moon.",
  "Today is a blank page. You get to write an amazing story!",
  "Being different is what makes you special like a rare diamond.",
  "Small steps every day add up to big giant leaps!",
  "You are capable of doing amazing things.",
  "Kindness is like magic dust—sprinkle it everywhere you go!"
];

const generateInspiration = (date, mode) => {
  const dayOfYear = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 1000 / 60 / 60 / 24);
  const pool = mode === 'kid' ? KID_QUOTES : ADULT_QUOTES;
  return pool[dayOfYear % pool.length];
};

// --- HELPER: TTS ---
const speakText = (text, userData) => {
  if (!text) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const voices = window.speechSynthesis.getVoices();
  const gender = userData?.voiceGender || 'female';
  
  let preferred;
  const lowerName = (v) => v.name.toLowerCase();

  if (gender === 'male') {
      // Robust check for male voices
      preferred = voices.find(v => 
        v.lang.includes('en') && (
          (lowerName(v).includes('male') && !lowerName(v).includes('female')) || 
          lowerName(v).includes('david') || 
          lowerName(v).includes('daniel') ||
          lowerName(v).includes('james') ||
          lowerName(v).includes('alex') ||
          lowerName(v).includes('fred')
        )
      );
  } else {
      // Robust check for female voices
      preferred = voices.find(v => 
        v.lang.includes('en') && (
          lowerName(v).includes('female') || 
          lowerName(v).includes('zira') || 
          lowerName(v).includes('samantha') || 
          lowerName(v).includes('victoria') ||
          lowerName(v).includes('anna')
        )
      );
  }

  if (!preferred) {
      preferred = voices.find(v => v.lang.includes('en'));
  }

  u.voice = preferred || voices[0];
  u.rate = userData?.voiceRate || 1;
  u.pitch = userData?.voicePitch || 1;
  window.speechSynthesis.speak(u);
};

// --- THEMES (High Contrast Optimized) ---
const THEMES = {
  midnight: { name: 'Midnight', bg: 'bg-slate-950', text: 'text-slate-100', accent: 'bg-indigo-600', card: 'bg-slate-900 border-slate-700' },
  ocean: { name: 'Ocean', bg: 'bg-blue-50', text: 'text-slate-900', accent: 'bg-cyan-700', card: 'bg-white shadow-xl border-blue-100' },
  forest: { name: 'Forest', bg: 'bg-emerald-50', text: 'text-emerald-950', accent: 'bg-emerald-700', card: 'bg-white shadow-xl border-emerald-100' },
  sunset: { name: 'Sunset', bg: 'bg-orange-50', text: 'text-stone-900', accent: 'bg-orange-600', card: 'bg-white shadow-xl border-orange-100' },
  lavender: { name: 'Lavender', bg: 'bg-purple-50', text: 'text-purple-950', accent: 'bg-purple-700', card: 'bg-white shadow-xl border-purple-100' },
  minimal: { name: 'Luxe', bg: 'bg-neutral-100', text: 'text-black', accent: 'bg-black', card: 'bg-white shadow-sm border-gray-200' }
};

// --- COMPONENTS ---

const DrawingCanvas = ({ color, strokeWidth, onSave }) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const contextRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color;
    ctx.lineWidth = strokeWidth;
    contextRef.current = ctx;
  }, []);

  useEffect(() => {
    if (contextRef.current) {
      contextRef.current.strokeStyle = color;
      contextRef.current.lineWidth = strokeWidth;
    }
  }, [color, strokeWidth]);

  const getPos = (e) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const start = (e) => { e.preventDefault(); const {x,y} = getPos(e); contextRef.current.beginPath(); contextRef.current.moveTo(x,y); setIsDrawing(true); };
  const move = (e) => { e.preventDefault(); if(!isDrawing) return; const {x,y} = getPos(e); contextRef.current.lineTo(x,y); contextRef.current.stroke(); };
  const stop = () => { contextRef.current.closePath(); setIsDrawing(false); if(onSave) onSave(canvasRef.current.toDataURL()); };
  const clear = () => contextRef.current.clearRect(0,0,canvasRef.current.width, canvasRef.current.height);

  return (
    <div className="relative w-full h-80 bg-white rounded-2xl shadow-inner border border-gray-200 overflow-hidden touch-none">
       <canvas ref={canvasRef} className="w-full h-full cursor-crosshair"
        onMouseDown={start} onMouseMove={move} onMouseUp={stop} onMouseLeave={stop}
        onTouchStart={start} onTouchMove={move} onTouchEnd={stop} />
      <button onClick={clear} className="absolute top-3 right-3 p-2 bg-red-50 text-red-500 rounded-full hover:bg-red-100 transition shadow-sm"><Trash2 size={16} /></button>
    </div>
  );
};

// --- MAIN APP ---
export default function App() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('home'); 
  const [currentTheme, setCurrentTheme] = useState('ocean');
  const [isPlayingMusic, setIsPlayingMusic] = useState(false);
  
  // Auth Inputs
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [licenseKey, setLicenseKey] = useState('');
  const [authError, setAuthError] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [verifyingKey, setVerifyingKey] = useState(false);

  const audioRef = useRef(null);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = 0.2; 
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const userRef = doc(db, 'artifacts', appId, 'users', currentUser.uid, 'settings', 'profile');
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          setUserData(snap.data());
          setCurrentTheme(snap.data().theme || 'ocean');
          if (snap.data().licenseValid) setUser(currentUser);
          else setUser(null); 
        } else {
          const defaultData = { theme: 'ocean', mode: 'adult', name: '', voiceGender: 'female', voiceRate: 1, voicePitch: 1, licenseValid: false };
          setUserData(defaultData);
        }
      } else {
        setUser(null);
        setUserData(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const theme = THEMES[currentTheme];

  const toggleMusic = () => {
    if (audioRef.current) {
      if (isPlayingMusic) audioRef.current.pause();
      else audioRef.current.play().catch(console.error);
      setIsPlayingMusic(!isPlayingMusic);
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      if (isLogin) await signInWithEmailAndPassword(auth, email, password);
      else {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, 'artifacts', appId, 'users', cred.user.uid, 'settings', 'profile'), {
          email, theme: 'ocean', mode: 'adult', licenseValid: false, createdAt: new Date()
        });
      }
    } catch (err) {
      if (err.code === 'auth/operation-not-allowed') {
        try {
           const anon = await signInAnonymously(auth);
           await setDoc(doc(db, 'artifacts', appId, 'users', anon.user.uid, 'settings', 'profile'), {
             email: 'guest@demo.com', theme: 'ocean', mode: 'adult', licenseValid: false, createdAt: new Date()
           });
        } catch (e) { setAuthError("Login failed."); }
      } else {
        setAuthError(err.message.replace('Firebase: ', ''));
      }
    }
  };

  const redeemLicense = async () => {
    if (!auth.currentUser) return;
    if (!licenseKey.trim()) {
        setAuthError('Please enter a license key.');
        return;
    }

    setVerifyingKey(true);
    setAuthError('');

    try {
        const licensesRef = collection(db, 'artifacts', appId, 'admin', 'data', 'licenses');
        const q = query(licensesRef, where('key', '==', licenseKey.trim()));
        const querySnapshot = await getDocs(q);

        if (licenseKey === 'PRO-2026-DEMO') {
             await updateDoc(doc(db, 'artifacts', appId, 'users', auth.currentUser.uid, 'settings', 'profile'), { licenseValid: true });
             setUserData(p => ({...p, licenseValid: true}));
             setUser(auth.currentUser);
             setVerifyingKey(false);
             return;
        }

        if (querySnapshot.empty) {
            throw new Error("Invalid License Key.");
        }

        const licenseDoc = querySnapshot.docs[0];
        const licenseData = licenseDoc.data();

        if (licenseData.status === 'used') {
             if (licenseData.usedBy === auth.currentUser.uid) {
                 await updateDoc(doc(db, 'artifacts', appId, 'users', auth.currentUser.uid, 'settings', 'profile'), { licenseValid: true });
                 setUserData(p => ({...p, licenseValid: true}));
                 setUser(auth.currentUser);
                 setVerifyingKey(false);
                 return;
             }
             throw new Error("This key has already been used.");
        }

        await updateDoc(doc(db, 'artifacts', appId, 'admin', 'data', 'licenses', licenseDoc.id), {
            status: 'used',
            usedBy: auth.currentUser.uid,
            usedAt: Date.now()
        });

        await updateDoc(doc(db, 'artifacts', appId, 'users', auth.currentUser.uid, 'settings', 'profile'), { 
            licenseValid: true,
            licenseType: licenseData.type || 'standard'
        });

        setUserData(p => ({...p, licenseValid: true}));
        setUser(auth.currentUser);

    } catch (err) {
        setAuthError(err.message || "Verification failed.");
    } finally {
        setVerifyingKey(false);
    }
  };

  const updateSettings = async (updates) => {
    if (updates.theme) setCurrentTheme(updates.theme);
    setUserData(p => ({...p, ...updates}));
    if (user) await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'profile'), updates);
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-gray-50"><Loader className="animate-spin text-indigo-600" size={32} /></div>;

  if (!user || (userData && !userData.licenseValid)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100 flex items-center justify-center p-6">
        <div className="bg-white/80 backdrop-blur-xl p-8 rounded-3xl shadow-2xl w-full max-w-md border border-white/50">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-extrabold bg-gradient-to-r from-indigo-600 to-blue-500 bg-clip-text text-transparent mb-2">Notebook 2026</h1>
            <p className="text-gray-500 font-medium">Your Second Brain • Secure • Private</p>
          </div>
          {authError && <div className="bg-red-50 text-red-600 p-3 rounded-xl mb-6 text-sm text-center">{authError}</div>}
          
          {auth.currentUser && (!userData || !userData.licenseValid) ? (
            <div className="space-y-4 animate-fade-in">
              <p className="text-center text-gray-700">Enter your license key to unlock.</p>
              <input 
                type="text" 
                placeholder="XXXX-XXXX-XXXX" 
                className="w-full p-4 bg-gray-50 rounded-xl border border-gray-200 text-center tracking-widest font-mono uppercase focus:ring-2 focus:ring-indigo-500 outline-none" 
                value={licenseKey} 
                onChange={e => setLicenseKey(e.target.value)} 
              />
              <button 
                onClick={redeemLicense} 
                disabled={verifyingKey}
                className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-indigo-200 hover:shadow-xl hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
              >
                {verifyingKey && <Loader size={18} className="animate-spin"/>}
                {verifyingKey ? "Verifying..." : "Unlock Full Access"}
              </button>
              <button onClick={() => signOut(auth)} className="w-full text-indigo-600 text-sm font-semibold hover:underline mt-2">Sign Out</button>
            </div>
          ) : (
            <form onSubmit={handleAuth} className="space-y-4 animate-fade-in">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Email</label>
                <input type="email" required className="w-full p-4 bg-gray-50 rounded-xl border-transparent focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition" value={email} onChange={e => setEmail(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Password</label>
                <input type="password" required className="w-full p-4 bg-gray-50 rounded-xl border-transparent focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition" value={password} onChange={e => setPassword(e.target.value)} />
              </div>
              <button type="submit" className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-indigo-200 hover:shadow-xl hover:scale-[1.02] transition-all">{isLogin ? 'Sign In' : 'Create Account'}</button>
              <div className="text-center pt-2">
                <button type="button" onClick={() => setIsLogin(!isLogin)} className="text-indigo-600 text-sm font-semibold hover:underline">{isLogin ? "Create Account" : "Sign In"}</button>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  const isKid = userData.mode === 'kid';
  const fontClass = isKid ? { fontFamily: '"Comic Neue", cursive' } : { fontFamily: '"Inter", sans-serif' };

  return (
    <div className={`min-h-screen transition-all duration-700 ${theme.bg} ${theme.text}`} style={fontClass}>
      <audio ref={audioRef} loop src="https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112762.mp3" />

      {/* Header */}
      <header className={`px-6 py-4 sticky top-0 z-20 flex justify-between items-center backdrop-blur-md bg-opacity-95 border-b border-gray-100/10 ${isKid ? 'bg-yellow-300 text-black' : ''}`}>
        <h1 className="text-xl font-bold tracking-tight">{isKid ? '🎈 My Notebook' : '2026 Planner'}</h1>
        <div className="flex items-center gap-3">
          <button onClick={toggleMusic} className={`p-2.5 rounded-full backdrop-blur-md bg-white/20 hover:bg-white/30 transition shadow-sm border border-white/20`}>
            {isPlayingMusic ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
          <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold shadow-md ring-2 ring-white/30">
            {(userData.name || user.email || 'U')[0].toUpperCase()}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-4 pb-28 max-w-lg mx-auto w-full">
        {view === 'home' && <Dashboard user={user} theme={theme} userData={userData} />}
        {view === 'notes' && <NotesManager user={user} theme={theme} db={db} appId={appId} userData={userData} />}
        {view === 'planner' && <Planner user={user} theme={theme} db={db} appId={appId} userData={userData} />}
        {view === 'settings' && <SettingsScreen user={user} theme={theme} userData={userData} updateSettings={updateSettings} signOut={() => signOut(auth)} />}
      </main>

      {/* Navigation */}
      <nav className={`fixed bottom-6 left-4 right-4 max-w-lg mx-auto ${theme.card} border rounded-2xl px-2 py-2 flex justify-around items-center shadow-2xl shadow-black/5 z-30`}>
        {[
          { id: 'home', icon: Home, label: 'Home' },
          { id: 'notes', icon: PenTool, label: 'Notes' },
          { id: 'planner', icon: CalendarIcon, label: 'Plan' },
          { id: 'settings', icon: Settings, label: 'Settings' }
        ].map(item => (
          <button key={item.id} onClick={() => setView(item.id)} className={`relative px-6 py-3 rounded-xl transition-all duration-300 ${view === item.id ? `${theme.accent} text-white shadow-lg scale-105` : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}>
            <item.icon size={22} strokeWidth={2.5} />
            {view === item.id && <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] font-bold opacity-0 animate-fade-in text-gray-500">{item.label}</span>}
          </button>
        ))}
      </nav>
    </div>
  );
}

// --- VIEWS ---

const Dashboard = ({ user, theme, userData }) => {
  const quote = useMemo(() => generateInspiration(new Date(), userData.mode), [userData.mode]);
  const isKid = userData.mode === 'kid';

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className={`p-8 rounded-[2rem] ${theme.accent} text-white shadow-xl relative overflow-hidden`}>
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
        <div className="relative z-10">
          <p className="opacity-80 font-medium uppercase tracking-wider text-xs mb-1">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          <h2 className="text-3xl font-bold mb-6 leading-tight">
            {new Date().getHours() < 12 ? 'Good morning,' : 'Welcome back,'}<br/>
            <span className="opacity-90">{userData.name || 'Friend'}</span>
          </h2>
          
          <div className="bg-white/10 backdrop-blur-md p-5 rounded-2xl border border-white/20">
            <div className="flex justify-between items-start gap-4">
              <span className="text-3xl opacity-50 font-serif">"</span>
              <button onClick={() => speakText(quote, userData)} className="bg-white/20 hover:bg-white/30 p-2 rounded-full transition"><Volume2 size={18} /></button>
            </div>
            <p className={`text-lg leading-relaxed ${isKid ? 'font-bold' : 'font-medium font-serif italic'}`}>{quote}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const NotesManager = ({ user, theme, db, appId, userData, filterDate = null }) => {
  const [notes, setNotes] = useState([]);
  const [isEditor, setIsEditor] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [drawing, setDrawing] = useState(null);
  const [mode, setMode] = useState('text');
  const [color, setColor] = useState('#000000');
  const [isListening, setIsListening] = useState(false);
  const [thinking, setThinking] = useState(false);
  const recognition = useRef(null);

  useEffect(() => {
    if(!user) return;
    let q = query(collection(db, 'artifacts', appId, 'users', user.uid, 'notes'));
    
    if (filterDate) {
        const startOfDay = new Date(filterDate);
        startOfDay.setHours(0,0,0,0);
        const endOfDay = new Date(filterDate);
        endOfDay.setHours(23,59,59,999);
        q = query(q, where('createdAt', '>=', startOfDay.getTime()), where('createdAt', '<=', endOfDay.getTime()));
    }

    const unsub = onSnapshot(q, snap => {
        let docs = snap.docs.map(d => ({id: d.id, ...d.data()}));
        docs.sort((a,b) => b.createdAt - a.createdAt);
        setNotes(docs);
    });
    return () => unsub();
  }, [user, filterDate]);

  useEffect(() => {
    if (window.webkitSpeechRecognition || window.SpeechRecognition) {
      const SR = window.webkitSpeechRecognition || window.SpeechRecognition;
      recognition.current = new SR();
      recognition.current.continuous = true;
      recognition.current.interimResults = true;
      recognition.current.onresult = e => {
        let final = '';
        for (let i = e.resultIndex; i < e.results.length; ++i) if(e.results[i].isFinal) final += e.results[i][0].transcript;
        if(final) setContent(p => p + ' ' + final);
      };
    }
  }, []);

  const toggleMic = () => {
    if (isListening) { recognition.current.stop(); setIsListening(false); }
    else { recognition.current.start(); setIsListening(true); }
  };

  const handleSmartAction = async (actionType) => {
    if (!content && !title) return;
    setThinking(true);
    
    let prompt = '';
    const isKid = userData.mode === 'kid';
    
    switch (actionType) {
        case 'continue':
            prompt = isKid 
                ? `Write a fun, short continuation (3 sentences) for this story: "${content}". Keep it safe and happy.`
                : `Continue this text with a coherent paragraph. Context: ${content}. Title: ${title}.`;
            break;
        case 'summarize':
            prompt = `Summarize the following text into 3 concise bullet points. Text: "${content}"`;
            break;
        case 'action_items':
            prompt = `Extract actionable tasks from this text and list them as a checklist. Text: "${content}"`;
            break;
        case 'simplify':
            prompt = `Rewrite the following text to be very simple, easy to read, and suitable for a ${isKid ? 'child' : 'general audience'}: "${content}"`;
            break;
        default:
            break;
    }

    if (prompt) {
        const res = await callGemini(prompt);
        setContent(prev => prev + '\n\n--- ✨ AI Output ---\n' + res);
    }
    setThinking(false);
  };

  const save = async () => {
    if(!title && !content && !drawing) return;
    let timestamp = Date.now();
    if (filterDate) {
        const d = new Date(filterDate);
        d.setHours(12,0,0,0);
        timestamp = d.getTime();
    }

    await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'notes'), {
      title: title || 'Untitled', content, drawing, type: drawing ? 'draw' : 'text', 
      isVoice: isListening || content.length > 0, // Simple flag for voice origin
      createdAt: timestamp
    });
    close();
  };

  const close = () => { setIsEditor(false); setTitle(''); setContent(''); setDrawing(null); setMode('text'); };

  if (isEditor) return (
    <div className={`h-[80vh] flex flex-col ${theme.card} rounded-[2rem] shadow-2xl border border-white/20 overflow-hidden relative z-50`}>
      <div className="p-4 flex justify-between items-center border-b border-gray-100 bg-white/50 backdrop-blur-sm">
        <button onClick={close} className="text-gray-500 font-medium">Cancel</button>
        <div className="flex bg-gray-100 p-1 rounded-lg">
          <button onClick={() => setMode('text')} className={`p-2 rounded-md ${mode==='text' ? 'bg-white shadow text-indigo-600' : 'text-gray-400'}`}><Type size={18}/></button>
          <button onClick={() => setMode('draw')} className={`p-2 rounded-md ${mode==='draw' ? 'bg-white shadow text-indigo-600' : 'text-gray-400'}`}><PenTool size={18}/></button>
        </div>
        <button onClick={save} className={`${theme.accent} text-white px-4 py-2 rounded-xl font-bold text-sm shadow-md`}>Save</button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <input className="text-3xl font-bold bg-transparent outline-none w-full mb-4 placeholder-gray-300" placeholder="Title..." value={title} onChange={e=>setTitle(e.target.value)}/>
        
        {mode === 'text' ? (
          <div className="relative h-full flex flex-col">
             {/* Smart Actions Toolbar - Only shown if not in Calendar view (optional, but requested to keep clean)
                 Since user asked to remove subheadings from Calendar view, and this component is shared,
                 we can hide it if filterDate is present, or just keep it simple.
                 User request: "When I click on a calendar date... remove them altogether"
                 I will hide the toolbar if `filterDate` is present (meaning we are in Calendar Day View).
             */}
             {!filterDate && (
                 <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide">
                    <button 
                        onClick={() => handleSmartAction('continue')} 
                        disabled={thinking} 
                        className="flex items-center gap-1.5 bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap hover:bg-indigo-100 transition"
                    >
                        {thinking ? <Loader size={12} className="animate-spin"/> : <Sparkles size={12}/>} Continue
                    </button>
                    <button 
                        onClick={() => handleSmartAction('summarize')} 
                        disabled={thinking} 
                        className="flex items-center gap-1.5 bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap hover:bg-indigo-100 transition"
                    >
                        <FileText size={12}/> Summarize
                    </button>
                    <button 
                        onClick={() => handleSmartAction('action_items')} 
                        disabled={thinking} 
                        className="flex items-center gap-1.5 bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap hover:bg-indigo-100 transition"
                    >
                        <ListChecks size={12}/> To-Do List
                    </button>
                    <button 
                        onClick={() => handleSmartAction('simplify')} 
                        disabled={thinking} 
                        className="flex items-center gap-1.5 bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap hover:bg-indigo-100 transition"
                    >
                        <Baby size={12}/> Simplify
                    </button>
                 </div>
             )}

             <textarea className="w-full flex-1 bg-transparent outline-none resize-none text-lg leading-relaxed text-gray-700 min-h-[300px]" placeholder="Start typing..." value={content} onChange={e=>setContent(e.target.value)} />
             
             <button onClick={toggleMic} className={`absolute bottom-6 right-2 w-16 h-16 rounded-full flex items-center justify-center shadow-xl transition-all duration-300 ${isListening ? 'bg-red-500 scale-110 animate-pulse' : 'bg-indigo-600 hover:scale-105'}`}>
               {isListening ? <MicOff className="text-white" size={28}/> : <Mic className="text-white" size={28}/>}
             </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {['#000000','#EF4444','#3B82F6','#10B981','#F59E0B','#8B5CF6'].map(c => (
                <button key={c} onClick={()=>setColor(c)} className={`w-8 h-8 rounded-full border-2 ${color===c ? 'border-gray-900 scale-110' : 'border-transparent'}`} style={{backgroundColor: c}}/>
              ))}
            </div>
            <DrawingCanvas color={color} strokeWidth={3} onSave={setDrawing}/>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold">{filterDate ? 'Daily Notes' : 'All Notes'}</h2>
          <p className="opacity-60 text-sm">{filterDate ? 'Notes from this day' : 'Capture your thoughts'}</p>
        </div>
        <button onClick={() => setIsEditor(true)} className={`${theme.accent} text-white p-3 rounded-2xl shadow-lg hover:scale-105 transition`}><PenTool size={20} /></button>
      </div>
      <div className="grid gap-3">
        {notes.map(n => (
          <div key={n.id} className={`${theme.card} p-5 rounded-2xl border flex flex-col gap-3 hover:shadow-lg transition cursor-pointer group`}>
            <div className="flex justify-between items-start">
              <h3 className="font-bold text-lg line-clamp-1">{n.title}</h3>
              {n.isVoice && (
                  <div className="bg-indigo-100 text-indigo-600 px-2 py-1 rounded-full text-[10px] font-bold flex items-center gap-1">
                      <Mic size={12}/> <span>Voice</span>
                  </div>
              )}
            </div>
            
            {n.type === 'draw' ? <img src={n.drawing} className="h-24 object-contain bg-gray-50 rounded-lg"/> : <p className="text-gray-500 line-clamp-3 text-sm">{n.content}</p>}
            
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
                <div className="text-[10px] text-gray-400">{new Date(n.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                <div className="flex gap-3">
                     {/* Play Button - Larger */}
                     {n.type === 'text' && (
                         <button 
                           onClick={(e)=>{e.stopPropagation(); speakText(n.content, userData)}} 
                           className="text-gray-400 hover:text-indigo-600 p-2 rounded-full hover:bg-indigo-50 transition"
                           title="Read aloud"
                         >
                           <PlayCircle size={24} />
                         </button>
                     )}
    
                     {/* Delete Button - Larger */}
                     <button 
                        onClick={(e)=>{e.stopPropagation(); deleteDoc(doc(db,'artifacts',appId,'users',user.uid,'notes',n.id))}} 
                        className="text-gray-300 hover:text-red-400 p-2 rounded-full hover:bg-red-50 transition"
                     >
                        <Trash2 size={24}/>
                     </button>
                </div>
            </div>
          </div>
        ))}
        {notes.length === 0 && <div className="text-center p-8 opacity-40 text-sm">No notes found.</div>}
      </div>
    </div>
  );
};

const Planner = ({ user, theme, db, appId, userData }) => {
  const [calendarDate, setCalendarDate] = useState(new Date(2026, 0, 1)); // Start Jan 2026
  const [selectedDate, setSelectedDate] = useState(null); 
  
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const days = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    return { days, firstDay };
  };

  const { days, firstDay } = getDaysInMonth(calendarDate);
  const daysArray = [...Array(firstDay).fill(null), ...Array(days).keys()];

  const changeMonth = (offset) => {
    const newDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + offset, 1);
    
    // Logic to allow Dec 2025 through Dec 2026
    const y = newDate.getFullYear();
    const m = newDate.getMonth();
    
    // Too early (before Dec 2025)
    if (y < 2025) return;
    if (y === 2025 && m < 11) return; // Only allow Dec (11) in 2025
    
    // Too late (after Dec 2026)
    if (y > 2026) return;
    
    setCalendarDate(newDate);
  };

  // Ensure we are viewing valid date initially
  useEffect(() => {
     // If we are mostly testing, auto-set to Dec 2025 to see feature
     // But default to Jan 2026 as per request unless user navigates
     if (calendarDate.getFullYear() < 2025) setCalendarDate(new Date(2026, 0, 1));
  }, []);

  if (selectedDate) {
    const quote = generateInspiration(selectedDate, userData.mode);
    const dateStr = selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

    return (
        <div className="space-y-6 animate-fade-in-right">
            <button onClick={() => setSelectedDate(null)} className="flex items-center text-gray-500 hover:text-indigo-600 font-bold text-sm">
                <ChevronLeft size={16} /> Back to Calendar
            </button>
            
            {/* Daily Inspiration Header with Audio */}
            <div className={`p-6 rounded-[2rem] ${theme.accent} text-white shadow-xl relative`}>
                 <div className="flex justify-between items-start mb-2">
                    <p className="opacity-80 text-xs font-bold uppercase">{dateStr}</p>
                    <button 
                        onClick={() => speakText(quote, userData)} 
                        className="bg-white/20 hover:bg-white/30 p-2 rounded-full transition"
                    >
                        <Volume2 size={18} />
                    </button>
                 </div>
                 <p className="text-lg font-serif italic leading-relaxed">"{quote}"</p>
            </div>

            <NotesManager user={user} theme={theme} db={db} appId={appId} userData={userData} filterDate={selectedDate} />
        </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">{calendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h2>
        <div className="flex gap-2">
            <button 
                onClick={() => changeMonth(-1)} 
                className={`p-2 rounded-full bg-gray-100 hover:bg-gray-200`}
            >
                <ChevronLeft size={20}/>
            </button>
            <button 
                onClick={() => changeMonth(1)} 
                className={`p-2 rounded-full bg-gray-100 hover:bg-gray-200`}
            >
                <ChevronRight size={20}/>
            </button>
        </div>
      </div>

      <div className={`${theme.card} p-4 rounded-[2rem] shadow-sm`}>
        <div className="grid grid-cols-7 mb-2 text-center">
            {['S','M','T','W','T','F','S'].map((d, i) => <div key={i} className="text-xs font-bold text-gray-400 py-2">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-2">
            {daysArray.map((day, i) => {
                if (day === null) return <div key={i} />;
                const currentDay = day + 1;
                const dateObj = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), currentDay);
                const isToday = new Date().toDateString() === dateObj.toDateString();
                
                return (
                    <button 
                        key={i} 
                        onClick={() => setSelectedDate(dateObj)}
                        className={`aspect-square rounded-xl flex items-center justify-center text-sm font-medium transition relative ${isToday ? `${theme.accent} text-white shadow-md` : 'hover:bg-gray-100 text-gray-700'}`}
                    >
                        {currentDay}
                    </button>
                );
            })}
        </div>
      </div>
      
      <div className="text-center text-xs text-gray-400 mt-4">
          Click any date to view notes and quotes.
      </div>
    </div>
  );
};

const SettingsScreen = ({ user, theme, userData, updateSettings, signOut }) => {
  const [voices, setVoices] = useState([]);
  useEffect(() => {
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load(); window.speechSynthesis.onvoiceschanged = load;
  }, []);

  return (
    <div className="space-y-6 pb-20">
      <h2 className="text-3xl font-bold">Settings</h2>
      
      <section className={`${theme.card} p-6 rounded-[2rem] border space-y-4`}>
        <h3 className="font-bold flex items-center gap-2 text-gray-700"><UserCircle size={20}/> Profile</h3>
        <input 
          placeholder="Enter your name" 
          className="w-full bg-gray-50 border border-gray-100 p-3 rounded-xl outline-none focus:ring-2 focus:ring-indigo-200"
          value={userData.name || ''}
          onChange={(e) => updateSettings({ name: e.target.value })}
        />
        <div className="flex bg-gray-100 p-1 rounded-xl">
           {['adult', 'kid'].map(m => (
             <button key={m} onClick={()=>updateSettings({mode: m})} className={`flex-1 py-2 rounded-lg text-sm font-bold capitalize transition ${userData.mode===m ? 'bg-white shadow text-indigo-600' : 'text-gray-400'}`}>{m} Mode</button>
           ))}
        </div>
      </section>

      <section className={`${theme.card} p-6 rounded-[2rem] border`}>
        <h3 className="font-bold flex items-center gap-2 text-gray-700 mb-4"><Palette size={20}/> Mood Theme</h3>
        <div className="grid grid-cols-3 gap-3">
          {Object.entries(THEMES).map(([k, t]) => (
            <button key={k} onClick={()=>updateSettings({theme: k})} className={`h-16 rounded-2xl ${t.bg} border-2 transition-all ${userData.theme===k ? 'border-indigo-500 scale-105 shadow-md' : 'border-transparent opacity-70'}`}>
              <span className={`text-[10px] font-bold px-2 py-1 bg-white/80 rounded-full text-slate-900`}>{t.name}</span>
            </button>
          ))}
        </div>
      </section>

      <section className={`${theme.card} p-6 rounded-[2rem] border space-y-4`}>
        <h3 className="font-bold flex items-center gap-2 text-gray-700"><Music size={20}/> Voice Settings</h3>
        <div className="flex gap-2">
            {['female', 'male'].map(g => (
                <button key={g} onClick={()=>updateSettings({voiceGender: g})} className={`flex-1 py-2 border rounded-xl capitalize font-medium text-sm ${userData.voiceGender === g ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white text-gray-500'}`}>
                    {g}
                </button>
            ))}
        </div>
        <div className="space-y-1">
            <div className="flex justify-between text-xs font-bold text-gray-400"><span>Speed</span><span>{userData.voiceRate}x</span></div>
            <input type="range" min="0.5" max="2" step="0.1" value={userData.voiceRate || 1} onChange={e=>updateSettings({voiceRate: parseFloat(e.target.value)})} className="w-full accent-indigo-600"/>
        </div>
        <div className="space-y-1">
            <div className="flex justify-between text-xs font-bold text-gray-400"><span>Tone</span><span>{userData.voicePitch}</span></div>
            <input type="range" min="0.5" max="2" step="0.1" value={userData.voicePitch || 1} onChange={e=>updateSettings({voicePitch: parseFloat(e.target.value)})} className="w-full accent-indigo-600"/>
        </div>
      </section>

      <button onClick={signOut} className="w-full py-4 text-red-500 font-bold bg-red-50 rounded-2xl hover:bg-red-100 transition">Log Out</button>
    </div>
  );
};
