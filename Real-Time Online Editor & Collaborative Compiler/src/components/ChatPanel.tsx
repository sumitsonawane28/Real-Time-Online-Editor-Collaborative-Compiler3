import React, { useEffect, useRef, useState } from 'react';
import { X, Send, UserPlus, Users, Eye, Edit3, Copy, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/src/lib/utils';
import { socket } from '@/src/lib/socket';
import { ChatMessage, Collaborator } from '@/src/types';

interface ChatPanelProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  roomId: string;
  username: string;
  collaborators: Collaborator[];
  showInviteModal: boolean;
  setShowInviteModal: (v: boolean) => void;
  onInvite: (username: string, permission: 'view' | 'edit') => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  isOpen, setIsOpen, roomId, username, collaborators,
  showInviteModal, setShowInviteModal, onInvite,
}) => {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatTab, setChatTab] = useState<'chat' | 'people'>('chat');
  const bottomRef = useRef<HTMLDivElement>(null);

  // Socket setup — NOTE: join-room is emitted by App.tsx only.
  // ChatPanel only listens for messages and presence events.
  useEffect(() => {
    const handleMessage = (msg: any) => {
      const ts = new Date(msg.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setMessages((prev) => [...prev, { ...msg, timestamp: ts, isMe: msg.user === username }]);
    };
    const handleJoined = ({ username: u }: { username: string }) => {
      if (u !== username) {
        setMessages((prev) => [...prev, {
          id: Date.now().toString(), user: 'System', text: `${u} joined the room`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          avatar: '⚡', isMe: false,
        }]);
      }
    };
    const handleLeft = ({ username: u }: { username: string }) => {
      setMessages((prev) => [...prev, {
        id: Date.now().toString(), user: 'System', text: `${u} left the room`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        avatar: '👋', isMe: false,
      }]);
    };

    socket.on('receive-message', handleMessage);
    socket.on('user-joined', handleJoined);
    socket.on('user-left', handleLeft);
    return () => {
      socket.off('receive-message', handleMessage);
      socket.off('user-joined', handleJoined);
      socket.off('user-left', handleLeft);
    };
  }, [roomId, username]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!message.trim()) return;
    const avatar = username.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
    // Do NOT add to local state here — the server broadcasts receive-message
    // back to everyone including the sender, so handleMessage handles it once.
    socket.emit('send-message', { roomId, user: username, text: message, avatar });
    setMessage('');
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 260, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: 'tween', duration: 0.15 }}
            className="h-full bg-vscode-sidebar border-l border-vscode-border flex flex-col overflow-hidden"
          >
            {/* Header tabs */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-vscode-border shrink-0">
              <div className="flex gap-1 bg-vscode-bg rounded p-0.5">
                <button
                  onClick={() => setChatTab('chat')}
                  className={cn('px-2 py-0.5 rounded text-[11px] font-medium transition-colors flex items-center gap-1',
                    chatTab === 'chat' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white')}
                >
                  <Send size={10} />Chat
                </button>
                <button
                  onClick={() => setChatTab('people')}
                  className={cn('px-2 py-0.5 rounded text-[11px] font-medium transition-colors flex items-center gap-1',
                    chatTab === 'people' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white')}
                >
                  <Users size={10} />
                  People
                  {collaborators.filter((c) => c.online).length > 0 && (
                    <span className="bg-green-500 text-white text-[8px] rounded-full w-3.5 h-3.5 flex items-center justify-center">
                      {collaborators.filter((c) => c.online).length}
                    </span>
                  )}
                </button>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setShowInviteModal(true)}
                  title="Invite Collaborator"
                  className="p-1 text-gray-400 hover:text-white transition-colors"
                >
                  <UserPlus size={13} />
                </button>
                <button onClick={() => setIsOpen(false)} className="p-1 text-gray-400 hover:text-white transition-colors">
                  <X size={13} />
                </button>
              </div>
            </div>

            {chatTab === 'chat' && (
              <>
                <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3 no-scrollbar">
                  {messages.length === 0 && (
                    <div className="text-center text-gray-500 text-[11px] mt-4 opacity-60">
                      No messages yet. Say hello! 👋
                    </div>
                  )}
                  {messages.map((msg) => (
                    <div key={msg.id} className={cn('flex items-start gap-2', msg.isMe ? 'flex-row-reverse' : 'flex-row')}>
                      <div className={cn(
                        'w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold',
                        msg.user === 'System' ? 'bg-slate-600 text-gray-300' : msg.isMe ? 'bg-indigo-500 text-white' : 'bg-blue-500 text-white'
                      )}>
                        {msg.user === 'System' ? msg.avatar : (msg.avatar || msg.user.slice(0, 2).toUpperCase())}
                      </div>
                      <div className={cn('flex-1 min-w-0', msg.isMe ? 'text-right' : 'text-left')}>
                        {msg.user !== 'System' && (
                          <div className="text-[10px] font-bold mb-0.5 opacity-70">
                            {msg.user} <span className="font-normal opacity-50">{msg.timestamp}</span>
                          </div>
                        )}
                        <div className={cn(
                          'text-xs p-2 rounded-lg leading-relaxed inline-block max-w-full break-words',
                          msg.user === 'System'
                            ? 'text-gray-400 italic text-[10px] bg-transparent p-0'
                            : msg.isMe
                            ? 'bg-indigo-600 text-white rounded-tr-none'
                            : 'bg-slate-800 text-vscode-text rounded-tl-none'
                        )}>
                          {msg.text}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={bottomRef} />
                </div>
                <div className="p-3 border-t border-vscode-border shrink-0">
                  <div className="relative">
                    <input
                      type="text"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                      placeholder="Message..."
                      className="w-full bg-vscode-bg border border-vscode-border rounded-md px-3 py-2 text-xs text-vscode-text focus:outline-none focus:border-indigo-500 pr-9"
                    />
                    <button
                      onClick={handleSend}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-indigo-500 hover:text-indigo-400 transition-colors"
                    >
                      <Send size={13} />
                    </button>
                  </div>
                </div>
              </>
            )}

            {chatTab === 'people' && (
              <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
                <button
                  onClick={() => setShowInviteModal(true)}
                  className="flex items-center gap-2 w-full px-3 py-2 bg-indigo-600/20 border border-indigo-500/30 hover:bg-indigo-600/30 rounded text-xs text-indigo-300 transition-colors"
                >
                  <UserPlus size={13} />Invite Collaborator
                </button>
                {collaborators.length === 0 && (
                  <p className="text-[11px] text-gray-500 italic text-center mt-4">No collaborators yet.</p>
                )}
                {collaborators.map((c) => (
                  <div key={c.username} className="flex items-center gap-2 p-2 bg-vscode-bg rounded border border-vscode-border">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                      style={{ backgroundColor: c.color }}
                    >
                      {c.username.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-vscode-text truncate">{c.username}</p>
                      <p className="text-[10px] text-gray-500">{c.online ? '🟢 Online' : '⚫ Offline'}</p>
                    </div>
                    <span className={cn(
                      'text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5',
                      c.permission === 'edit' ? 'bg-green-900/30 text-green-400' : 'bg-slate-700 text-gray-400'
                    )}>
                      {c.permission === 'edit' ? <><Edit3 size={8} />Edit</> : <><Eye size={8} />View</>}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {showInviteModal && (
        <InviteModal
          roomId={roomId}
          onInvite={onInvite}
          onClose={() => setShowInviteModal(false)}
        />
      )}
    </>
  );
};

/* ── Invite Modal ── */
const InviteModal: React.FC<{
  roomId: string;
  onInvite: (username: string, permission: 'view' | 'edit') => void;
  onClose: () => void;
}> = ({ roomId, onInvite, onClose }) => {
  const [invitee, setInvitee] = useState('');
  const [permission, setPermission] = useState<'view' | 'edit'>('edit');
  const [copied, setCopied] = useState(false);
  const [sent, setSent] = useState(false);

  const shareLink = `${window.location.origin}?room=${roomId}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!invitee.trim()) return;
    onInvite(invitee.trim(), permission);
    setSent(true);
    setTimeout(() => { setSent(false); setInvitee(''); }, 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-vscode-sidebar border border-vscode-border rounded-lg w-full max-w-sm mx-4 shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-vscode-border">
          <h3 className="text-sm font-bold text-vscode-text flex items-center gap-2">
            <UserPlus size={15} className="text-indigo-400" />Invite Collaborator
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors"><X size={15} /></button>
        </div>

        <div className="p-4 flex flex-col gap-4">
          {/* Share link */}
          <div>
            <label className="text-[11px] text-gray-400 mb-1.5 block font-bold uppercase">Share Room Link</label>
            <div className="flex gap-2">
              <input
                readOnly
                value={shareLink}
                className="flex-1 bg-vscode-bg border border-vscode-border rounded px-2 py-1.5 text-[11px] text-gray-400 font-mono truncate"
              />
              <button
                onClick={handleCopyLink}
                className="px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-xs text-white transition-colors flex items-center gap-1"
              >
                {copied ? <><Check size={11} className="text-green-400" />Copied!</> : <><Copy size={11} />Copy</>}
              </button>
            </div>
          </div>

          {/* Invite by username */}
          <form onSubmit={handleInvite} className="flex flex-col gap-3">
            <div>
              <label className="text-[11px] text-gray-400 mb-1.5 block font-bold uppercase">Invite by Username</label>
              <input
                type="text"
                value={invitee}
                onChange={(e) => setInvitee(e.target.value)}
                placeholder="Enter username..."
                className="w-full bg-vscode-bg border border-vscode-border rounded px-3 py-2 text-xs text-vscode-text focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="text-[11px] text-gray-400 mb-1.5 block font-bold uppercase">Permission</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPermission('edit')}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 py-2 rounded text-xs font-medium transition-colors border',
                    permission === 'edit'
                      ? 'bg-green-700 border-green-600 text-white'
                      : 'bg-vscode-bg border-vscode-border text-gray-400 hover:text-white'
                  )}
                >
                  <Edit3 size={12} />Can Edit
                </button>
                <button
                  type="button"
                  onClick={() => setPermission('view')}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 py-2 rounded text-xs font-medium transition-colors border',
                    permission === 'view'
                      ? 'bg-slate-600 border-slate-500 text-white'
                      : 'bg-vscode-bg border-vscode-border text-gray-400 hover:text-white'
                  )}
                >
                  <Eye size={12} />View Only
                </button>
              </div>
            </div>

            <button
              type="submit"
              className={cn(
                'w-full py-2 rounded text-xs font-medium transition-colors',
                sent
                  ? 'bg-green-700 text-white'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              )}
            >
              {sent ? '✓ Invite Sent!' : 'Send Invite'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
