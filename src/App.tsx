import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Send, 
  Calendar, 
  Link2, 
  Settings, 
  Sparkles, 
  Plus, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Linkedin,
  Twitter,
  Facebook,
  ChevronRight,
  MoreVertical,
  Image as ImageIcon,
  Trash2,
  Edit3,
  Moon,
  Sun,
  Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import { format } from 'date-fns';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts';
import ReactMarkdown from 'react-markdown';

// --- Types ---
declare global {
  interface Window {
    google: any;
  }
}

type Platform = 'linkedin' | 'x' | 'facebook';

interface SocialAccount {
  id: Platform;
  name: string;
  connected: boolean;
  username?: string;
}

interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: 'user' | 'admin';
}

interface Post {
  id: string;
  content: string;
  platforms: Platform[];
  status: 'draft' | 'scheduled' | 'published' | 'failed';
  scheduledAt?: string;
  impressions: number;
  engagements: number;
  clicks: number;
  createdAt: string;
}

// --- Components ---

const Sidebar = ({ activeTab, setActiveTab, user, onSignOut }: { activeTab: string, setActiveTab: (tab: string) => void, user: User | null, onSignOut: () => void }) => {
  const menuItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'composer', icon: Plus, label: 'Composer' },
    { id: 'schedule', icon: Calendar, label: 'Schedule' },
    { id: 'socials', icon: Link2, label: 'Socials' },
    { id: 'settings', icon: Settings, label: 'Settings' },
  ];

  if (user?.role === 'admin') {
    menuItems.push({ id: 'admin', icon: Sparkles, label: 'Admin Panel' });
  }

  return (
    <div className="w-20 lg:w-64 bg-surface border-r border-slate-200 flex flex-col h-screen fixed left-0 top-0 z-50 transition-all">
      <div className="p-6 flex items-center gap-3">
        <div className="w-8 h-8 bg-brand-gradient rounded-lg flex items-center justify-center shadow-sm">
          <Activity className="text-white w-5 h-5" />
        </div>
        <h1 className="text-lg font-bold tracking-tight text-text-primary hidden lg:block">VibePulse</h1>
      </div>

      <nav className="flex-1 px-4 py-8 space-y-2">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-300 ${
              activeTab === item.id 
                ? 'bg-surface-hover text-brand-primary' 
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <item.icon size={20} />
            <span className="hidden lg:block text-sm font-medium">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="p-6 flex flex-col gap-4 border-t border-slate-200">
        <div className="flex items-center gap-3">
          {user?.avatar ? (
            <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full border border-slate-200" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-text-muted">
              {user?.name?.split(' ').map((n: string) => n[0]).join('') || 'JD'}
            </div>
          )}
          <div className="hidden lg:block overflow-hidden">
            <p className="text-xs font-bold text-text-primary truncate">{user?.name || 'Guest'}</p>
            <p className="text-[10px] text-text-muted truncate">{user?.email}</p>
          </div>
        </div>
        <button 
          onClick={onSignOut}
          className="w-full text-left text-[10px] font-bold text-text-muted hover:text-red-500 transition-colors uppercase tracking-widest hidden lg:block"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
};

const PostComposer = ({ onPostCreated, token }: { onPostCreated: (post: Post) => void, token: string }) => {
  const [content, setContent] = useState('');
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');

  const generateAIContent = async () => {
    if (!prompt) return;
    setIsGenerating(true);
    try {
      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ prompt })
      });
      const data = await response.json();
      setContent(data.text || '');
    } catch (error) {
      console.error("AI Generation failed:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const togglePlatform = (p: Platform) => {
    setPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  };

  const handleCreate = async () => {
    if (!content || platforms.length === 0) return;
    
    try {
      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          content,
          platforms,
          scheduledAt: scheduledDate || null
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        onPostCreated(result.post || {
          id: Math.random().toString(36).substr(2, 9),
          content,
          platforms,
          status: scheduledDate ? 'scheduled' : 'published',
          scheduledAt: scheduledDate,
          createdAt: new Date().toISOString(),
        });
        setContent('');
        setPlatforms([]);
        setScheduledDate('');
        setPrompt('');
      }
    } catch (error) {
      console.error("Failed to create post:", error);
    }
  };

  return (
    <div className="max-w-4xl space-y-12">
      <div className="bg-surface rounded-3xl p-8 border border-slate-200 shadow-sm">
        <h2 className="text-xl font-bold mb-8 flex items-center gap-2 text-text-primary">
          <Edit3 className="text-brand-primary" />
          Compose New Post
        </h2>

        <div className="space-y-8">
          {/* AI Prompt Section */}
          <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
            <label className="text-[10px] font-mono text-text-muted uppercase tracking-widest mb-3 block">AI Content Assistant</label>
            <div className="flex gap-3">
              <input 
                type="text" 
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="What should the post be about?"
                className="flex-1 bg-bg-main border border-slate-200 rounded-xl px-4 py-3 text-sm text-text-primary focus:outline-none focus:border-brand-primary transition-all"
              />
              <button 
                onClick={generateAIContent}
                disabled={isGenerating || !prompt}
                className="bg-brand-primary hover:bg-brand-primary/90 disabled:opacity-50 text-white px-6 py-3 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-lg shadow-brand-primary/10"
              >
                {isGenerating ? 'Generating...' : <><Sparkles size={16} /> Generate</>}
              </button>
            </div>
          </div>

          {/* Content Area */}
          <textarea 
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write your post content here..."
            className="w-full h-64 bg-bg-main border border-slate-200 rounded-2xl p-6 text-text-primary focus:outline-none focus:border-brand-blue resize-none transition-all font-light leading-relaxed"
          />

          {/* Platform Selection */}
          <div className="flex flex-wrap gap-6 items-center">
            <span className="text-xs font-mono text-text-muted uppercase tracking-widest">Post to:</span>
            <div className="flex gap-3">
              {[
                { id: 'linkedin', icon: Linkedin, color: 'hover:text-blue-500' },
                { id: 'x', icon: Twitter, color: 'hover:text-slate-900' },
                { id: 'facebook', icon: Facebook, color: 'hover:text-blue-600' }
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => togglePlatform(p.id as Platform)}
                  className={`p-4 rounded-2xl border transition-all ${
                    platforms.includes(p.id as Platform)
                      ? 'bg-brand-primary/10 border-brand-primary text-brand-primary shadow-sm'
                      : 'bg-bg-main border-slate-200 text-text-muted ' + p.color
                  }`}
                >
                  <p.icon size={20} />
                </button>
              ))}
            </div>
          </div>

          {/* Scheduling */}
          <div className="flex items-center gap-6 pt-8 border-t border-slate-200">
            <div className="flex items-center gap-3 text-text-muted">
              <Clock size={18} />
              <span className="text-xs font-mono uppercase tracking-widest">Schedule:</span>
            </div>
            <input 
              type="datetime-local" 
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              className="bg-bg-main border border-slate-200 rounded-xl px-4 py-3 text-sm text-text-primary focus:outline-none focus:border-brand-blue"
            />
            <div className="flex-1" />
            <button 
              onClick={handleCreate}
              disabled={!content || platforms.length === 0}
              className="bg-brand-gradient hover:opacity-90 disabled:opacity-50 text-white px-10 py-4 rounded-2xl font-bold shadow-xl shadow-brand-primary/10 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
            >
              {scheduledDate ? 'Schedule Post' : 'Post Now'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const Dashboard = ({ posts, token }: { posts: Post[], token: string }) => {
  const [dashboardStats, setDashboardStats] = useState({
    totalPosts: 0,
    totalImpressions: 0,
    totalEngagements: 0,
    avgEngagementRate: '0%'
  });

  useEffect(() => {
    fetch('/api/dashboard/stats', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => setDashboardStats(data))
      .catch(err => console.error("Failed to fetch dashboard stats:", err));
  }, [token]);

  const stats = [
    { label: 'Total Posts', value: dashboardStats.totalPosts, icon: Send, color: 'text-brand-primary' },
    { label: 'Impressions', value: dashboardStats.totalImpressions.toLocaleString(), icon: Sparkles, color: 'text-brand-secondary' },
    { label: 'Engagements', value: dashboardStats.totalEngagements.toLocaleString(), icon: CheckCircle2, color: 'text-brand-primary' },
    { label: 'Eng. Rate', value: dashboardStats.avgEngagementRate, icon: Sparkles, color: 'text-brand-primary' },
  ];

  return (
    <div className="space-y-16">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
        {stats.map((stat) => (
          <div key={stat.label} className="space-y-2">
            <p className="text-xs font-mono text-text-muted uppercase tracking-widest">{stat.label}</p>
            <div className="flex items-baseline gap-3">
              <p className="text-4xl font-light text-text-primary">{stat.value}</p>
              <stat.icon size={16} className={stat.color} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-20">
        <div className="space-y-8">
          <h3 className="text-sm font-mono text-text-muted uppercase tracking-widest">Recent Activity</h3>
          <div className="space-y-6">
            {posts.slice(0, 4).map((post) => (
              <div key={post.id} className="group cursor-pointer border-b border-slate-200 pb-6 last:border-0">
                <div className="flex items-center gap-4 mb-3">
                  <div className="flex gap-1">
                    {post.platforms.map(p => (
                      <div key={p} className="text-text-muted group-hover:text-brand-primary transition-colors">
                        {p === 'linkedin' && <Linkedin size={14} />}
                        {p === 'x' && <Twitter size={14} />}
                        {p === 'facebook' && <Facebook size={14} />}
                      </div>
                    ))}
                  </div>
                  <span className="text-[10px] font-mono text-text-muted uppercase tracking-tighter">
                    {format(new Date(post.createdAt), 'MMM d, HH:mm')}
                  </span>
                </div>
                <p className="text-text-primary text-sm leading-relaxed line-clamp-2 font-light">{post.content}</p>
              </div>
            ))}
            {posts.length === 0 && (
              <p className="text-text-muted italic text-sm font-light">No activity recorded yet.</p>
            )}
          </div>
        </div>

        <div className="space-y-8">
          <h3 className="text-sm font-mono text-text-muted uppercase tracking-widest">Performance</h3>
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={[
                { name: 'M', v: 40 }, { name: 'T', v: 30 }, { name: 'W', v: 60 }, 
                { name: 'T', v: 45 }, { name: 'F', v: 90 }, { name: 'S', v: 70 }, { name: 'S', v: 85 }
              ]}>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '10px', color: '#0f172a' }}
                  itemStyle={{ color: '#0f172a' }}
                />
                <Line type="monotone" dataKey="v" stroke="#7c3aed" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-surface p-6 rounded-2xl border border-slate-200">
            <p className="text-xs text-text-muted leading-relaxed">
              Your engagement is up <span className="text-brand-primary">24%</span> compared to last week. 
              The best time to post remains <span className="text-text-primary">Tuesday at 10:00 AM</span>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const SocialAccounts = ({ token, onRefresh }: { token: string, onRefresh: () => void }) => {
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);

  useEffect(() => {
    fetch('/api/socials', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => setAccounts(data));
  }, [token]);

  const connectAccount = async (platform: string) => {
    try {
      const response = await fetch(`/api/auth/${platform}/url`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to get auth URL');
      const { url } = await response.json();

      const authWindow = window.open(url, 'oauth_popup', 'width=600,height=700');
      if (!authWindow) {
        alert('Please allow popups to connect your account.');
      }
    } catch (error) {
      console.error("Failed to connect account:", error);
    }
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        fetch('/api/socials', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
          .then(res => res.json())
          .then(data => setAccounts(data));
        onRefresh();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [token, onRefresh]);

  return (
    <div className="max-w-4xl space-y-12">
      <div className="flex items-center justify-between border-b border-slate-200 pb-8">
        <div>
          <h2 className="text-2xl font-light text-text-primary">Social Connections</h2>
          <p className="text-text-muted text-sm mt-1">Integrate your platforms for seamless publishing</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {accounts.map((acc) => (
          <div key={acc.id} className="bg-surface p-6 rounded-2xl border border-slate-200 flex items-center gap-6 hover:border-brand-primary/30 transition-all group">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              acc.connected ? 'bg-brand-primary/10 text-brand-primary' : 'bg-slate-100 text-text-muted'
            }`}>
              {acc.id === 'linkedin' && <Linkedin size={24} />}
              {acc.id === 'x' && <Twitter size={24} />}
              {acc.id === 'facebook' && <Facebook size={24} />}
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-text-primary">{acc.name}</h3>
              <p className="text-xs text-text-muted font-mono mt-0.5">
                {acc.connected ? `@${acc.username}` : 'DISCONNECTED'}
              </p>
            </div>
            <button 
              onClick={() => connectAccount(acc.id)}
              className={`px-6 py-2 rounded-full text-xs font-bold tracking-widest uppercase transition-all ${
              acc.connected 
                ? 'border border-slate-200 text-text-muted hover:text-red-500 hover:border-red-500/30' 
                : 'bg-brand-primary text-white hover:bg-brand-primary/90'
            }`}>
              {acc.connected ? 'Disconnect' : 'Connect'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

const AuthScreen = ({ onAuthSuccess, onBack, darkMode, setDarkMode }: { onAuthSuccess: (user: User, token: string) => void, onBack: () => void, darkMode: boolean, setDarkMode: (val: boolean) => void }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Initialize Google Sign-In
    if (window.google) {
      window.google.accounts.id.initialize({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || "YOUR_GOOGLE_CLIENT_ID",
        callback: handleGoogleResponse
      });
      window.google.accounts.id.renderButton(
        document.getElementById("googleSignInButton"),
        { theme: "outline", size: "large", width: "100%" }
      );
    }
  }, []);

  const handleGoogleResponse = async (response: any) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential })
      });
      const data = await res.json();
      if (res.ok) {
        onAuthSuccess(data.user, data.token);
      } else {
        setError(data.error || 'Google authentication failed');
      }
    } catch (err) {
      setError('An error occurred during Google authentication');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
    const body = isLogin ? { email, password } : { email, password, name };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (res.ok) {
        onAuthSuccess(data.user, data.token);
      } else {
        setError(data.error || 'Authentication failed');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-main flex items-center justify-center p-6 relative">
      <button 
        onClick={() => setDarkMode(!darkMode)}
        className="absolute top-8 right-8 p-3 rounded-xl bg-surface border border-slate-200 dark:border-slate-700 text-text-muted hover:text-brand-blue transition-all"
      >
        {darkMode ? <Sun size={20} /> : <Moon size={20} />}
      </button>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-surface rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 p-10"
      >
        <div className="text-center mb-10">
          <div className="w-12 h-12 bg-brand-gradient rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-brand-primary/20">
            <Activity className="text-white w-6 h-6" />
          </div>
          <h2 className="text-3xl font-bold text-text-primary">{isLogin ? 'Welcome Back' : 'Join VibePulse'}</h2>
          <p className="text-text-muted mt-2">{isLogin ? 'Log in to manage your vibes' : 'Start your journey with us today'}</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-sm flex items-center gap-2">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1.5 block">Full Name</label>
              <input 
                type="text" 
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-bg-main border border-slate-200 rounded-xl px-4 py-3 text-sm text-text-primary focus:outline-none focus:border-brand-blue transition-all"
                placeholder="John Doe"
              />
            </div>
          )}
          <div>
            <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1.5 block">Email Address</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-bg-main border border-slate-200 rounded-xl px-4 py-3 text-sm text-text-primary focus:outline-none focus:border-brand-blue transition-all"
              placeholder="name@example.com"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1.5 block">Password</label>
            <input 
              type="password" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-bg-main border border-slate-200 rounded-xl px-4 py-3 text-sm text-text-primary focus:outline-none focus:border-brand-blue transition-all"
              placeholder="••••••••"
            />
          </div>
          <button 
            type="submit"
            disabled={isLoading}
            className="w-full bg-brand-primary hover:bg-brand-primary/90 disabled:opacity-50 text-white font-bold py-4 rounded-xl shadow-lg shadow-brand-primary/10 transition-all mt-4"
          >
            {isLoading ? 'Processing...' : (isLogin ? 'Log In' : 'Create Account')}
          </button>
        </form>

        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
          <div className="relative flex justify-center text-xs uppercase"><span className="bg-surface px-4 text-text-muted font-mono">Or continue with</span></div>
        </div>

        <div id="googleSignInButton" className="w-full"></div>

        <div className="mt-8 text-center">
          <button 
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm text-text-muted hover:text-brand-blue transition-colors"
          >
            {isLogin ? "Don't have an account? Sign up" : "Already have an account? Log in"}
          </button>
        </div>

        <button 
          onClick={onBack}
          className="w-full mt-6 text-xs text-text-muted hover:text-text-primary transition-colors"
        >
          Back to Home
        </button>
      </motion.div>
    </div>
  );
};

const LandingPage = ({ onStart, onLogin, darkMode, setDarkMode }: { onStart: () => void, onLogin: () => void, darkMode: boolean, setDarkMode: (val: boolean) => void }) => {
  return (
    <div className="min-h-screen bg-bg-main">
      {/* Navigation */}
      <nav className="flex items-center justify-between px-8 py-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-brand-gradient rounded-lg flex items-center justify-center shadow-sm">
            <Activity className="text-white w-5 h-5" />
          </div>
          <span className="text-xl font-bold text-text-primary">VibePulse</span>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 rounded-lg bg-surface border border-slate-200 dark:border-slate-700 text-text-muted hover:text-brand-primary transition-all"
          >
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button 
            onClick={onLogin}
            className="bg-brand-primary hover:bg-brand-primary/90 text-white px-6 py-2 rounded-lg text-sm font-medium transition-all shadow-sm"
          >
            Log In
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-5xl mx-auto px-6 pt-24 pb-32 text-center">
        <h1 className="text-5xl md:text-7xl font-bold text-text-primary mb-6 tracking-tight">
          Personal Vibe Marketing<br />
          <span className="bg-brand-gradient bg-clip-text text-transparent">
            Automation Platform
          </span>
        </h1>
        <p className="text-text-muted text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
          Generate AI-powered content, schedule posts, and track engagement across your social media accounts. Powered by Groq AI for lightning-fast content generation.
        </p>
        <button 
          onClick={onStart}
          className="bg-brand-gradient hover:opacity-90 text-white px-10 py-4 rounded-xl text-lg font-bold shadow-xl shadow-brand-primary/20 transition-all transform hover:-translate-y-1"
        >
          Get Started Free
        </button>
      </section>

      {/* Features Grid */}
      <section className="max-w-7xl mx-auto px-6 pb-32 grid grid-cols-1 md:grid-cols-3 gap-8">
        {[
          {
            title: 'Content Generation',
            desc: 'Boost posts with Groq AI. Generate content and choose your favorites.',
            icon: Sparkles,
            color: 'bg-brand-blue/10 text-brand-blue'
          },
          {
            title: 'Smart Scheduling',
            desc: 'Schedule posts for optimal engagement times. Set it and forget it with automated posting.',
            icon: Calendar,
            color: 'bg-accent-blue/10 text-accent-blue'
          },
          {
            title: 'Analytics & Insights',
            desc: 'Track engagement, measure performance, and optimize your content strategy with detailed analytics.',
            icon: BarChart,
            color: 'bg-brand-blue-light/10 text-brand-blue-light'
          }
        ].map((feature) => (
          <div key={feature.title} className="bg-surface p-8 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
            <div className={`w-12 h-12 rounded-2xl ${feature.color} flex items-center justify-center mb-6`}>
              <feature.icon size={24} />
            </div>
            <h3 className="text-xl font-bold text-text-primary mb-3">{feature.title}</h3>
            <p className="text-text-muted text-sm leading-relaxed">{feature.desc}</p>
          </div>
        ))}
      </section>
    </div>
  );
};

const AdminPanel = ({ token }: { token: string }) => {
  const [adminStats, setAdminStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAdminData = async () => {
      try {
        const [statsRes, usersRes] = await Promise.all([
          fetch('/api/admin/stats', { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch('/api/admin/users', { headers: { 'Authorization': `Bearer ${token}` } })
        ]);
        const statsData = await statsRes.json();
        const usersData = await usersRes.json();
        setAdminStats(statsData);
        setUsers(usersData);
      } catch (err) {
        console.error("Failed to fetch admin data:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAdminData();
  }, [token]);

  if (isLoading) return <div className="animate-pulse text-text-muted">Loading admin data...</div>;

  return (
    <div className="space-y-16">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        {[
          { label: 'Total Users', value: adminStats?.totalUsers, icon: LayoutDashboard },
          { label: 'Active Users (30d)', value: adminStats?.activeUsers, icon: Clock },
          { label: 'Total Posts', value: adminStats?.totalPosts, icon: Send },
          { label: 'Connected Accounts', value: adminStats?.connectedAccounts, icon: Link2 },
        ].map((stat) => (
          <div key={stat.label} className="bg-surface p-6 rounded-2xl border border-slate-200">
            <p className="text-[10px] font-mono text-text-muted uppercase tracking-widest mb-2">{stat.label}</p>
            <p className="text-3xl font-light text-text-primary">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-surface rounded-3xl border border-slate-200 overflow-hidden">
        <div className="p-8 border-b border-slate-200">
          <h3 className="text-xl font-bold text-text-primary">User Management</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-mono text-text-muted uppercase tracking-widest">
                <th className="px-8 py-4">User</th>
                <th className="px-8 py-4">Email</th>
                <th className="px-8 py-4">Role</th>
                <th className="px-8 py-4">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {users.map((u) => (
                <tr key={u._id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-8 py-4 flex items-center gap-3">
                    {u.avatar ? <img src={u.avatar} className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" /> : <div className="w-8 h-8 rounded-full bg-slate-100" />}
                    <span className="text-sm text-text-primary">{u.name}</span>
                  </td>
                  <td className="px-8 py-4 text-sm text-text-muted">{u.email}</td>
                  <td className="px-8 py-4">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${u.role === 'admin' ? 'bg-brand-primary/10 text-brand-primary' : 'bg-slate-100 text-text-muted'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-8 py-4 text-sm text-text-muted">{format(new Date(u.createdAt), 'MMM d, yyyy')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [view, setView] = useState<'landing' | 'auth' | 'app'>('landing');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [posts, setPosts] = useState<Post[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('vibe_pulse_token'));
  const [isLoading, setIsLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('lookout_dark_mode');
      if (saved !== null) return saved === 'true';
    }
    return false; // Default to light theme
  });

  useEffect(() => {
    localStorage.setItem('lookout_dark_mode', darkMode.toString());
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  useEffect(() => {
    const checkAuth = async () => {
      if (token) {
        try {
          const res = await fetch('/api/auth/me', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            setUser(data.user);
            setView('app');
          } else {
            localStorage.removeItem('vibe_pulse_token');
            setToken(null);
          }
        } catch (err) {
          console.error("Auth check failed:", err);
        }
      }
      setIsLoading(false);
    };
    checkAuth();
  }, [token]);

  useEffect(() => {
    if (view === 'app' && token) {
      fetch('/api/posts', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          setPosts(Array.isArray(data) ? data : []);
        })
        .catch(err => console.error("Failed to fetch posts:", err));
    }
  }, [view, token]);

  const handleAuthSuccess = (userData: User, userToken: string) => {
    setUser(userData);
    setToken(userToken);
    localStorage.setItem('vibe_pulse_token', userToken);
    setView('app');
  };

  const handleSignOut = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('vibe_pulse_token');
    setView('landing');
  };

  const handlePostCreated = (post: Post) => {
    setPosts([post, ...posts]);
    setActiveTab('dashboard');
  };

  if (isLoading) {
    return (
      <div className={`min-h-screen bg-bg-main flex items-center justify-center ${darkMode ? 'dark' : ''}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
      </div>
    );
  }

  if (view === 'landing') {
    return <LandingPage onStart={() => setView('auth')} onLogin={() => setView('auth')} darkMode={darkMode} setDarkMode={setDarkMode} />;
  }

  if (view === 'auth') {
    return <AuthScreen onAuthSuccess={handleAuthSuccess} onBack={() => setView('landing')} darkMode={darkMode} setDarkMode={setDarkMode} />;
  }

  const refreshData = () => {
    if (token) {
      fetch('/api/posts', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => setPosts(Array.isArray(data) ? data : []));
    }
  };

  return (
    <div className={`min-h-screen bg-bg-main text-text-primary flex ${darkMode ? 'dark' : ''}`}>
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} user={user} onSignOut={handleSignOut} />
      
      <main className="flex-1 ml-20 lg:ml-64 p-8 lg:p-12 max-w-7xl mx-auto w-full">
        <header className="flex items-center justify-between mb-16">
          <div>
            <h2 className="text-4xl font-light tracking-tight text-text-primary">{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</h2>
            <p className="text-text-muted mt-2 font-mono text-xs uppercase tracking-widest">VibePulse / {activeTab}</p>
          </div>
          <button 
            onClick={() => setDarkMode(!darkMode)}
            className="p-3 rounded-xl bg-surface border border-slate-200 dark:border-slate-700 text-text-muted hover:text-brand-primary transition-all"
          >
            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </header>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'dashboard' && <Dashboard posts={posts} token={token || ''} />}
            {activeTab === 'composer' && <PostComposer onPostCreated={handlePostCreated} token={token || ''} />}
            {activeTab === 'socials' && <SocialAccounts token={token || ''} onRefresh={refreshData} />}
            {activeTab === 'admin' && <AdminPanel token={token || ''} />}
            {activeTab === 'schedule' && (
              <div className="flex flex-col items-center justify-center py-20 text-text-muted">
                <Calendar size={48} className="mb-4 opacity-20" />
                <p className="text-lg font-medium">Calendar View Coming Soon</p>
                <p className="text-sm">We're building a beautiful drag-and-drop scheduler for you.</p>
              </div>
            )}
            {activeTab === 'settings' && (
              <div className="max-w-2xl bg-surface rounded-3xl p-8 border border-slate-200 dark:border-slate-700 shadow-sm">
                <h3 className="text-xl font-bold mb-8 text-text-primary">Account Settings</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-5 bg-bg-main rounded-2xl border border-slate-200 dark:border-slate-700">
                    <div>
                      <p className="font-medium text-text-primary">AI Model</p>
                      <p className="text-xs text-text-muted font-mono uppercase tracking-widest mt-1">Gemini 3 Flash (Latest)</p>
                    </div>
                    <ChevronRight className="text-text-muted" size={20} />
                  </div>
                  <div className="flex items-center justify-between p-5 bg-bg-main rounded-2xl border border-slate-200 dark:border-slate-700">
                    <div>
                      <p className="font-medium text-text-primary">Timezone</p>
                      <p className="text-xs text-text-muted font-mono uppercase tracking-widest mt-1">UTC (Coordinated Universal Time)</p>
                    </div>
                    <ChevronRight className="text-text-muted" size={20} />
                  </div>
                  <div className="flex items-center justify-between p-5 bg-bg-main rounded-2xl border border-slate-200 dark:border-slate-700">
                    <div>
                      <p className="font-medium text-text-primary">Notification Preferences</p>
                      <p className="text-xs text-text-muted font-mono uppercase tracking-widest mt-1">Email and Browser Push</p>
                    </div>
                    <ChevronRight className="text-text-muted" size={20} />
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
