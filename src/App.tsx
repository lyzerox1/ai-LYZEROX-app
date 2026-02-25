/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MapPin, 
  Send, 
  Navigation, 
  Search, 
  MessageSquare, 
  ExternalLink,
  Compass,
  Layers,
  Info,
  Github
} from 'lucide-react';
import Markdown from 'react-markdown';
import { InteractiveMap } from './components/Map';
import { chatWithMaps, ChatMessage, MapResult } from './services/geminiService';
import { cn } from './lib/utils';

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'model',
      text: "Hi! I'm GeoGuide. I can help you find restaurants, landmarks, or anything else nearby using real-time Google Maps data. I can also connect to your GitHub now! Where would you like to explore today?"
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>([51.505, -0.09]); // Default to London
  const [zoom, setZoom] = useState(13);
  const [githubUser, setGithubUser] = useState<any>(null);
  const [githubRepos, setGithubRepos] = useState<any[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchGithubUser();
  }, []);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost')) {
        return;
      }
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS' && event.data?.provider === 'github') {
        fetchGithubUser();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const fetchGithubUser = async () => {
    try {
      const res = await fetch('/api/github/user');
      if (res.ok) {
        const data = await res.json();
        setGithubUser(data);
        fetchGithubRepos();
      }
    } catch (err) {
      console.error("Failed to fetch GitHub user");
    }
  };

  const fetchGithubRepos = async () => {
    try {
      const res = await fetch('/api/github/repos');
      if (res.ok) {
        const data = await res.json();
        setGithubRepos(data);
      }
    } catch (err) {
      console.error("Failed to fetch GitHub repos");
    }
  };

  const handleConnectGithub = async () => {
    try {
      const response = await fetch('/api/auth/github/url');
      const { url } = await response.json();
      window.open(url, 'github_oauth', 'width=600,height=700');
    } catch (error) {
      console.error('GitHub OAuth error:', error);
    }
  };

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setLocation({ latitude, longitude });
          setMapCenter([latitude, longitude]);
        },
        (error) => {
          console.error("Error getting location:", error);
        }
      );
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = { role: 'user', text: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const { response, chatMessage } = await chatWithMaps(input, location || undefined);
      
      // Check for function calls
      if (response.functionCalls) {
        for (const call of response.functionCalls) {
          if (call.name === 'list_github_repositories') {
            if (!githubUser) {
              setMessages(prev => [...prev, { 
                role: 'model', 
                text: "You haven't connected your GitHub account yet. Please click the 'Connect GitHub' button below to see your repositories." 
              }]);
            } else {
              const repoList = githubRepos.map(r => `- [${r.name}](${r.html_url}): ${r.description || 'No description'}`).join('\n');
              setMessages(prev => [...prev, { 
                role: 'model', 
                text: `Here are your most recent GitHub repositories:\n\n${repoList}` 
              }]);
            }
            setIsLoading(false);
            return;
          }
        }
      }

      setMessages(prev => [...prev, chatMessage]);
    } catch (error) {
      console.error("Error in handleSend:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#0a0a0a] text-zinc-100 font-sans selection:bg-emerald-500/30">
      {/* Header */}
      <header className="h-16 border-bottom border-white/5 bg-black/20 backdrop-blur-md flex items-center justify-between px-6 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
            <Compass className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">GeoGuide AI</h1>
            <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Real-time Map Assistant</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {location ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Live Location Active
            </div>
          ) : (
            <div className="text-xs text-zinc-500">Location Access Disabled</div>
          )}
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden p-4 gap-4">
        {/* Chat Section */}
        <section className="w-full lg:w-[450px] flex flex-col bg-zinc-900/50 rounded-2xl border border-white/5 overflow-hidden backdrop-blur-sm">
          <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-hide">
            {githubUser && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-zinc-800/80 border border-emerald-500/20 rounded-2xl p-4 mb-4"
              >
                <div className="flex items-center gap-3 mb-3">
                  <img src={githubUser.avatar_url} alt="GitHub Avatar" className="w-10 h-10 rounded-full border border-white/10" />
                  <div>
                    <h3 className="text-sm font-semibold">{githubUser.name || githubUser.login}</h3>
                    <p className="text-[10px] text-zinc-500">Connected to GitHub</p>
                  </div>
                </div>
                {githubRepos.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">Recent Repositories</p>
                    {githubRepos.map(repo => (
                      <a 
                        key={repo.id} 
                        href={repo.html_url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="flex items-center justify-between text-xs p-2 bg-black/20 rounded-lg hover:bg-black/40 transition-colors"
                      >
                        <span className="truncate max-w-[180px]">{repo.name}</span>
                        <ExternalLink className="w-3 h-3 text-zinc-600" />
                      </a>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            <AnimatePresence initial={false}>
              {messages.map((msg, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "flex flex-col max-w-[90%]",
                    msg.role === 'user' ? "ml-auto items-end" : "items-start"
                  )}
                >
                  <div className={cn(
                    "px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm",
                    msg.role === 'user' 
                      ? "bg-emerald-600 text-white rounded-tr-none" 
                      : "bg-zinc-800 text-zinc-200 border border-white/5 rounded-tl-none"
                  )}>
                    <div className="markdown-body">
                      <Markdown>{msg.text}</Markdown>
                    </div>
                  </div>
                  
                  {msg.mapResults && (
                    <div className="mt-3 grid grid-cols-1 gap-2 w-full">
                      {msg.mapResults.map((result, rIdx) => (
                        <a
                          key={rIdx}
                          href={result.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between gap-3 px-3 py-2 bg-zinc-800/50 hover:bg-zinc-800 border border-white/5 rounded-xl transition-colors group"
                        >
                          <div className="flex items-center gap-2 overflow-hidden">
                            <MapPin className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                            <span className="text-xs font-medium truncate text-zinc-300 group-hover:text-white">
                              {result.title}
                            </span>
                          </div>
                          <ExternalLink className="w-3 h-3 text-zinc-500 group-hover:text-emerald-400 transition-colors" />
                        </a>
                      ))}
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
            {isLoading && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-2 text-zinc-500 text-xs ml-2"
              >
                <div className="flex gap-1">
                  <span className="w-1 h-1 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1 h-1 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1 h-1 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                Exploring maps...
              </motion.div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 bg-black/20 border-t border-white/5">
            <div className="relative flex items-center">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Ask about places nearby..."
                className="w-full bg-zinc-800/50 border border-white/10 rounded-2xl px-4 py-3 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all resize-none h-12 max-h-32"
                rows={1}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="absolute right-2 p-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50 disabled:hover:bg-emerald-600 transition-all"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-2 flex items-center justify-between px-1">
              <p className="text-[10px] text-zinc-500 flex items-center gap-1">
                <Info className="w-3 h-3" />
                Powered by Gemini 2.5 Flash
              </p>
              <div className="flex gap-2">
                {!githubUser && (
                  <button 
                    onClick={handleConnectGithub}
                    className="text-[10px] text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1"
                  >
                    <Github className="w-3 h-3" />
                    Connect GitHub
                  </button>
                )}
                <button className="text-[10px] text-zinc-400 hover:text-white transition-colors">Clear Chat</button>
              </div>
            </div>
          </div>
        </section>

        {/* Map Section */}
        <section className="hidden lg:block flex-1 relative rounded-2xl border border-white/5 overflow-hidden shadow-2xl">
          <InteractiveMap 
            center={mapCenter} 
            zoom={zoom} 
            onLocationSelect={(lat, lng) => {
              setMapCenter([lat, lng]);
              setZoom(15);
            }}
          />
          
          {/* Map Overlays */}
          <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-2">
            <div className="bg-zinc-900/90 backdrop-blur-md border border-white/10 rounded-xl p-3 shadow-xl max-w-[200px]">
              <h3 className="text-xs font-semibold mb-1 flex items-center gap-2">
                <Navigation className="w-3 h-3 text-emerald-400" />
                Current View
              </h3>
              <p className="text-[10px] text-zinc-400 leading-tight">
                Showing map data for your current location or selected area.
              </p>
            </div>
          </div>

          <div className="absolute bottom-4 right-4 z-[1000] flex flex-col gap-2">
            <button 
              onClick={() => location && setMapCenter([location.latitude, location.longitude])}
              className="p-3 bg-zinc-900/90 backdrop-blur-md border border-white/10 rounded-xl shadow-xl hover:bg-zinc-800 transition-colors text-emerald-400"
              title="Recenter to my location"
            >
              <Navigation className="w-5 h-5" />
            </button>
            <div className="flex flex-col bg-zinc-900/90 backdrop-blur-md border border-white/10 rounded-xl shadow-xl overflow-hidden">
              <button 
                onClick={() => setZoom(z => Math.min(z + 1, 18))}
                className="p-3 hover:bg-zinc-800 transition-colors border-b border-white/5"
              >
                <span className="text-lg font-bold">+</span>
              </button>
              <button 
                onClick={() => setZoom(z => Math.max(z - 1, 3))}
                className="p-3 hover:bg-zinc-800 transition-colors"
              >
                <span className="text-lg font-bold">−</span>
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
