import React, { useState } from 'react';
import { X, LogIn, UserPlus, Eye, EyeOff } from 'lucide-react';
import { api } from '@/src/lib/api';
import { User } from '@/src/types';
import { cn } from '@/src/lib/utils';

interface AuthModalProps {
  onAuth: (user: User) => void;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onAuth, onClose }) => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      let result;
      if (mode === 'signup') {
        if (!username.trim()) { setError('Username is required'); setLoading(false); return; }
        result = await api.signup(username, email, password);
      } else {
        result = await api.login(email, password);
      }
      onAuth({ ...result.user, token: result.token });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Guest mode — no backend needed
  const handleGuest = () => {
    const guestName = `Guest_${Math.floor(Math.random() * 9000) + 1000}`;
    onAuth({ id: guestName, username: guestName, email: '', token: '' });
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-vscode-sidebar border border-vscode-border rounded-lg w-full max-w-sm mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-vscode-border">
          <div className="flex gap-1 bg-vscode-bg rounded-md p-0.5">
            <button
              onClick={() => { setMode('login'); setError(''); }}
              className={cn('px-3 py-1 rounded text-xs font-medium transition-colors', mode === 'login' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white')}
            >
              <LogIn size={12} className="inline mr-1" />Login
            </button>
            <button
              onClick={() => { setMode('signup'); setError(''); }}
              className={cn('px-3 py-1 rounded text-xs font-medium transition-colors', mode === 'signup' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white')}
            >
              <UserPlus size={12} className="inline mr-1" />Sign Up
            </button>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-3">
          {mode === 'signup' && (
            <div>
              <label className="text-[11px] text-gray-400 mb-1 block">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="johndoe"
                className="w-full bg-vscode-bg border border-vscode-border rounded px-3 py-2 text-xs text-vscode-text focus:outline-none focus:border-indigo-500"
                required
              />
            </div>
          )}
          <div>
            <label className="text-[11px] text-gray-400 mb-1 block">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full bg-vscode-bg border border-vscode-border rounded px-3 py-2 text-xs text-vscode-text focus:outline-none focus:border-indigo-500"
              required
            />
          </div>
          <div>
            <label className="text-[11px] text-gray-400 mb-1 block">Password</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-vscode-bg border border-vscode-border rounded px-3 py-2 text-xs text-vscode-text focus:outline-none focus:border-indigo-500 pr-9"
                required
              />
              <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                {showPw ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
          </div>

          {error && <p className="text-red-400 text-[11px] bg-red-900/20 border border-red-800 rounded px-2 py-1">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white py-2 rounded text-xs font-medium transition-colors"
          >
            {loading ? 'Please wait...' : mode === 'login' ? 'Login' : 'Create Account'}
          </button>

          <div className="relative flex items-center gap-2">
            <div className="flex-1 h-px bg-vscode-border" />
            <span className="text-[10px] text-gray-500">or</span>
            <div className="flex-1 h-px bg-vscode-border" />
          </div>

          <button
            type="button"
            onClick={handleGuest}
            className="w-full bg-slate-700 hover:bg-slate-600 text-white py-2 rounded text-xs font-medium transition-colors"
          >
            Continue as Guest
          </button>
        </form>
      </div>
    </div>
  );
};
