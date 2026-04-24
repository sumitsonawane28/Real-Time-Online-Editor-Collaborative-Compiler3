import React, { useState, useEffect } from 'react';
import { X, Plus, LogIn, Hash } from 'lucide-react';
import { api } from '@/src/lib/api';
import { User, Room } from '@/src/types';
import { cn } from '@/src/lib/utils';

const LANGUAGES = ['javascript', 'typescript', 'python', 'c', 'cpp', 'java', 'css', 'html'];

interface RoomModalProps {
  user: User | null;
  currentRoomId: string;
  onJoin: (roomId: string, roomName: string) => void;
  onClose: () => void;
  onLoginRequired: () => void;
}

export const RoomModal: React.FC<RoomModalProps> = ({ user, currentRoomId, onJoin, onClose, onLoginRequired }) => {
  const [tab, setTab] = useState<'join' | 'create'>('join');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [joinId, setJoinId] = useState('');
  const [newName, setNewName] = useState('');
  const [newLang, setNewLang] = useState('javascript');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user?.token) return;
    api.getRooms(user.token).then(setRooms).catch(() => {});
  }, [user]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.token) { onLoginRequired(); return; }
    if (!newName.trim()) { setError('Room name required'); return; }
    setLoading(true); setError('');
    try {
      const room = await api.createRoom(newName, newLang, user.token);
      setRooms((prev) => [room, ...prev]);
      onJoin(room.roomId, room.name);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinById = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinId.trim()) { setError('Enter a room ID'); return; }
    setLoading(true); setError('');
    try {
      const room = await api.getRoom(joinId.trim());
      onJoin(room.roomId, room.name);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-vscode-sidebar border border-vscode-border rounded-lg w-full max-w-md mx-4 shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-vscode-border">
          <div className="flex gap-1 bg-vscode-bg rounded-md p-0.5">
            <button
              onClick={() => { setTab('join'); setError(''); }}
              className={cn('px-3 py-1 rounded text-xs font-medium transition-colors', tab === 'join' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white')}
            >
              <LogIn size={12} className="inline mr-1" />Join Room
            </button>
            <button
              onClick={() => { setTab('create'); setError(''); }}
              className={cn('px-3 py-1 rounded text-xs font-medium transition-colors', tab === 'create' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white')}
            >
              <Plus size={12} className="inline mr-1" />Create Room
            </button>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors"><X size={16} /></button>
        </div>

        <div className="p-4">
          {error && <p className="text-red-400 text-[11px] bg-red-900/20 border border-red-800 rounded px-2 py-1 mb-3">{error}</p>}

          {tab === 'join' && (
            <div className="flex flex-col gap-4">
              <form onSubmit={handleJoinById} className="flex gap-2">
                <div className="flex-1 relative">
                  <Hash size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type="text"
                    value={joinId}
                    onChange={(e) => setJoinId(e.target.value)}
                    placeholder="Enter room ID..."
                    className="w-full bg-vscode-bg border border-vscode-border rounded px-3 py-2 pl-7 text-xs text-vscode-text focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-3 py-2 rounded text-xs font-medium transition-colors"
                >
                  Join
                </button>
              </form>

              {rooms.length > 0 && (
                <div>
                  <p className="text-[11px] text-gray-500 mb-2 uppercase font-bold">Your Rooms</p>
                  <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
                    {rooms.map((room) => (
                      <button
                        key={room._id}
                        onClick={() => onJoin(room.roomId, room.name)}
                        className={cn(
                          'flex items-center justify-between px-3 py-2 rounded text-xs transition-colors text-left',
                          room.roomId === currentRoomId
                            ? 'bg-indigo-600/20 border border-indigo-500/40 text-indigo-300'
                            : 'bg-vscode-bg hover:bg-slate-700 text-vscode-text border border-vscode-border'
                        )}
                      >
                        <span className="font-medium">{room.name}</span>
                        <span className="text-[10px] text-gray-500 font-mono">{room.roomId}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {!user && (
                <p className="text-[11px] text-gray-500 text-center">
                  <button onClick={onLoginRequired} className="text-indigo-400 hover:underline">Login</button> to see your rooms
                </p>
              )}
            </div>
          )}

          {tab === 'create' && (
            <form onSubmit={handleCreate} className="flex flex-col gap-3">
              <div>
                <label className="text-[11px] text-gray-400 mb-1 block">Room Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="My Awesome Project"
                  className="w-full bg-vscode-bg border border-vscode-border rounded px-3 py-2 text-xs text-vscode-text focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="text-[11px] text-gray-400 mb-1 block">Language</label>
                <select
                  value={newLang}
                  onChange={(e) => setNewLang(e.target.value)}
                  className="w-full bg-vscode-bg border border-vscode-border rounded px-3 py-2 text-xs text-vscode-text focus:outline-none focus:border-indigo-500"
                >
                  {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              {!user && (
                <p className="text-[11px] text-yellow-400 bg-yellow-900/20 border border-yellow-800 rounded px-2 py-1">
                  You need to <button type="button" onClick={onLoginRequired} className="underline">login</button> to create rooms.
                </p>
              )}
              <button
                type="submit"
                disabled={loading || !user}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white py-2 rounded text-xs font-medium transition-colors"
              >
                {loading ? 'Creating...' : 'Create Room'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
