import React, { useState } from 'react';
import {
  Terminal as TerminalIcon,
  MessageSquare,
  Share2,
  Users,
  LogIn,
  LogOut,
  ChevronDown,
  FolderOpen,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { User, Collaborator } from '@/src/types';

interface NavbarProps {
  user: User | null;
  roomName: string;
  collaborators: Collaborator[];
  isRunning: boolean;
  isTerminalOpen: boolean;
  isChatOpen: boolean;
  onRun: () => void;
  onToggleTerminal: () => void;
  onToggleChat: () => void;
  onOpenRoom: () => void;
  onOpenInvite: () => void;
  onLogin: () => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user, roomName, collaborators, isRunning,
  isTerminalOpen, isChatOpen,
  onToggleTerminal, onToggleChat,
  onOpenRoom, onOpenInvite, onLogin, onLogout,
}) => {
  const [shareTooltip, setShareTooltip] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleShare = () => {
    const url = `${window.location.origin}?room=${encodeURIComponent(roomName)}`;
    navigator.clipboard.writeText(url).then(() => {
      setShareTooltip(true);
      setTimeout(() => setShareTooltip(false), 2000);
    });
  };

  const onlineCollabs = collaborators.filter((c) => c.online && c.username !== (user?.username || 'Guest'));

  return (
    <nav className="h-9 bg-vscode-bg border-b border-vscode-border flex items-center justify-between px-3 shrink-0">
      {/* Left: Logo + Room */}
      <div className="flex items-center gap-3">
        <div className="w-6 h-6 bg-indigo-600 rounded flex items-center justify-center font-bold text-white text-[10px] shrink-0">
          N
        </div>
        <button
          onClick={onOpenRoom}
          className="flex items-center gap-1.5 text-xs text-vscode-text opacity-80 hover:opacity-100 hover:bg-white/5 px-2 py-1 rounded transition-colors"
        >
          <FolderOpen size={13} />
          <span className="max-w-[120px] truncate">{roomName}</span>
          <ChevronDown size={11} />
        </button>
      </div>

      {/* Right: Controls */}
      <div className="flex items-center gap-1.5">
        {/* Terminal toggle */}
        <button
          onClick={onToggleTerminal}
          title="Toggle Terminal"
          className={cn('p-1.5 rounded transition-colors', isTerminalOpen ? 'text-white bg-white/10' : 'text-gray-400 hover:text-white hover:bg-white/10')}
        >
          <TerminalIcon size={14} />
        </button>

        {/* Chat toggle */}
        <button
          onClick={onToggleChat}
          title="Toggle Chat"
          className={cn('p-1.5 rounded transition-colors', isChatOpen ? 'text-white bg-white/10' : 'text-gray-400 hover:text-white hover:bg-white/10')}
        >
          <MessageSquare size={14} />
        </button>

        {/* Invite collaborators */}
        <button
          onClick={onOpenInvite}
          title="Invite Collaborators"
          className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <Users size={14} />
        </button>

        {/* Online collaborator avatars */}
        {onlineCollabs.length > 0 && (
          <div className="flex -space-x-1.5 mx-1">
            {onlineCollabs.slice(0, 4).map((c) => (
              <div
                key={c.username}
                title={`${c.username} (${c.permission})`}
                className="w-6 h-6 rounded-full border-2 border-vscode-bg flex items-center justify-center text-[9px] font-bold text-white cursor-default"
                style={{ backgroundColor: c.color }}
              >
                {c.username.slice(0, 2).toUpperCase()}
              </div>
            ))}
            {onlineCollabs.length > 4 && (
              <div className="w-6 h-6 rounded-full border-2 border-vscode-bg bg-slate-600 flex items-center justify-center text-[9px] font-bold text-white">
                +{onlineCollabs.length - 4}
              </div>
            )}
          </div>
        )}

        {/* Share */}
        <div className="relative">
          <button
            onClick={handleShare}
            className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1 rounded text-[11px] font-medium transition-colors"
          >
            <Share2 size={11} />Share
          </button>
          {shareTooltip && (
            <div className="absolute right-0 top-8 bg-slate-700 border border-vscode-border text-white text-[10px] px-2 py-1 rounded whitespace-nowrap z-50 shadow-lg">
              ✓ Link copied!
            </div>
          )}
        </div>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu((v) => !v)}
            className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-white/10 transition-colors text-xs"
          >
            {user ? (
              <>
                <div className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center text-[9px] font-bold text-white">
                  {user.username.slice(0, 2).toUpperCase()}
                </div>
                <span className="text-vscode-text opacity-80 max-w-[80px] truncate">{user.username}</span>
                <ChevronDown size={11} className="text-gray-500" />
              </>
            ) : (
              <><LogIn size={13} className="text-gray-400" /><span className="text-gray-400">Login</span></>
            )}
          </button>

          {showUserMenu && (
            <div className="absolute right-0 top-8 bg-vscode-sidebar border border-vscode-border rounded shadow-xl z-50 min-w-[140px] py-1">
              {user ? (
                <>
                  <div className="px-3 py-2 border-b border-vscode-border">
                    <p className="text-xs font-bold text-vscode-text">{user.username}</p>
                    <p className="text-[10px] text-gray-500 truncate">{user.email || 'Guest'}</p>
                  </div>
                  <button
                    onClick={() => { setShowUserMenu(false); onLogout(); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-900/20 transition-colors"
                  >
                    <LogOut size={12} />Logout
                  </button>
                </>
              ) : (
                <button
                  onClick={() => { setShowUserMenu(false); onLogin(); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-vscode-text hover:bg-white/5 transition-colors"
                >
                  <LogIn size={12} />Login / Sign Up
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};
