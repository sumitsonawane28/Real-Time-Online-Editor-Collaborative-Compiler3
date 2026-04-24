import React, { useState, useMemo } from 'react';
import {
  ChevronDown, ChevronRight, MoreVertical, Sparkles, Send,
  Search, Plus, Trash2, Shield, Eye, Edit3, Wifi, WifiOff,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { ActivityTab } from './ActivityBar';
import { motion } from 'motion/react';
import { FileNode, Collaborator, AppSettings } from '@/src/types';
import { SettingsPanel } from '@/src/components/SettingsPanel';

const LANGUAGES = ['javascript','typescript','python','c','cpp','java','css','html','json','markdown'];

const LANG_COLORS: Record<string, string> = {
  typescript: 'text-indigo-400', javascript: 'text-yellow-400',
  python: 'text-blue-400', css: 'text-pink-400', html: 'text-orange-400',
  json: 'text-yellow-300', java: 'text-red-400', c: 'text-cyan-400',
  cpp: 'text-cyan-400', markdown: 'text-gray-400',
};
const LANG_LABEL: Record<string, string> = {
  typescript: 'TS', javascript: 'JS', python: 'PY', css: '#',
  html: '<>', json: '{}', java: 'JV', c: 'C', cpp: 'C++', markdown: 'MD',
};

interface SidebarProps {
  activeTab: ActivityTab;
  isOpen: boolean;
  files: FileNode[];
  activeFileId: string;
  collaborators: Collaborator[];
  roomId: string;
  username: string;
  settings: AppSettings;
  onFileClick: (id: string) => void;
  onNewFile: (name: string, language: string) => void;
  onCloseFile: (id: string) => void;
  onPermissionChange: (username: string, permission: 'view' | 'edit') => void;
  onSettingsUpdate: (patch: Partial<AppSettings>) => void;
}

export const Sidebar: React.FC<SidebarProps> = (props) => {
  if (!props.isOpen) return null;
  return (
    <motion.div
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 224, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      className="h-full bg-vscode-sidebar border-r border-vscode-border flex flex-col overflow-hidden"
    >
      <div className="h-9 px-3 flex items-center justify-between text-[11px] uppercase font-bold opacity-60 select-none shrink-0">
        <span>{props.activeTab}</span>
        <MoreVertical size={14} className="cursor-pointer hover:opacity-100" />
      </div>
      <div className="flex-1 overflow-y-auto">
        {props.activeTab === 'explorer' && <ExplorerView {...props} />}
        {props.activeTab === 'search' && <SearchView files={props.files} onFileClick={props.onFileClick} />}
        {props.activeTab === 'ai' && <AIView />}
        {props.activeTab === 'community' && (
          <CommunityView
            collaborators={props.collaborators}
            username={props.username}
            onPermissionChange={props.onPermissionChange}
          />
        )}
        {props.activeTab === 'settings' && (
          <SettingsPanel
            settings={props.settings}
            roomId={props.roomId}
            onUpdate={props.onSettingsUpdate}
          />
        )}
        {props.activeTab === 'notifications' && (
          <div className="p-4 text-[11px] text-gray-500 italic">No notifications.</div>
        )}
      </div>
    </motion.div>
  );
};

/* ── Explorer ── */
const ExplorerView: React.FC<SidebarProps> = ({ files, activeFileId, onFileClick, onNewFile, onCloseFile }) => {
  const [showNewFile, setShowNewFile] = useState(false);
  const [newName, setNewName] = useState('');
  const [newLang, setNewLang] = useState('javascript');
  const [expanded, setExpanded] = useState(true);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const name = newName.includes('.') ? newName : `${newName}.${newLang === 'javascript' ? 'js' : newLang === 'typescript' ? 'ts' : newLang === 'python' ? 'py' : newLang}`;
    onNewFile(name, newLang);
    setNewName(''); setShowNewFile(false);
  };

  return (
    <div className="flex flex-col text-[12px]">
      <div
        className="flex items-center justify-between px-3 py-1 bg-indigo-900/20 text-indigo-400 font-bold uppercase tracking-tight select-none cursor-pointer hover:bg-indigo-900/30"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-1">
          {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          NEXUS-PROJECT
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); setShowNewFile((v) => !v); }}
          title="New File"
          className="p-0.5 hover:bg-indigo-500/20 rounded transition-colors"
        >
          <Plus size={13} />
        </button>
      </div>

      {showNewFile && (
        <form onSubmit={handleCreate} className="px-3 py-2 bg-vscode-bg border-b border-vscode-border flex flex-col gap-2">
          <input
            autoFocus
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="filename.py"
            className="w-full bg-vscode-sidebar border border-vscode-border rounded px-2 py-1 text-xs text-vscode-text focus:outline-none focus:border-indigo-500"
          />
          <select
            value={newLang}
            onChange={(e) => setNewLang(e.target.value)}
            className="w-full bg-vscode-sidebar border border-vscode-border rounded px-2 py-1 text-xs text-vscode-text focus:outline-none focus:border-indigo-500"
          >
            {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          <div className="flex gap-2">
            <button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-1 rounded text-[11px] font-medium transition-colors">Create</button>
            <button type="button" onClick={() => setShowNewFile(false)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-1 rounded text-[11px] transition-colors">Cancel</button>
          </div>
        </form>
      )}

      {expanded && (
        <div className="flex flex-col">
          {files.map((file) => (
            <div
              key={file.id}
              onClick={() => onFileClick(file.id)}
              className={cn(
                'group flex items-center justify-between py-1 pl-7 pr-2 cursor-pointer text-xs transition-colors border-l-2',
                file.id === activeFileId
                  ? 'bg-slate-800/50 text-vscode-text border-indigo-500'
                  : 'text-vscode-text opacity-70 border-transparent hover:bg-slate-800/30 hover:opacity-100'
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className={cn('font-mono text-[10px] shrink-0', LANG_COLORS[file.language] || 'text-gray-400')}>
                  {LANG_LABEL[file.language] || '?'}
                </span>
                <span className="truncate">{file.name}</span>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onCloseFile(file.id); }}
                className="opacity-0 group-hover:opacity-60 hover:!opacity-100 p-0.5 hover:text-red-400 transition-all shrink-0"
                title="Delete file"
              >
                <Trash2 size={11} />
              </button>
            </div>
          ))}
          {files.length === 0 && (
            <div className="px-4 py-3 text-[11px] text-gray-500 italic">No files. Click + to create one.</div>
          )}
        </div>
      )}
    </div>
  );
};

/* ── Search ── */
const SearchView: React.FC<{ files: FileNode[]; onFileClick: (id: string) => void }> = ({ files, onFileClick }) => {
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return files.flatMap((file) => {
      const lines = file.content.split('\n');
      return lines
        .map((line, i) => ({ file, line, lineNum: i + 1 }))
        .filter(({ line }) => line.toLowerCase().includes(q));
    });
  }, [query, files]);

  return (
    <div className="p-3 flex flex-col gap-3">
      <div className="relative">
        <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          autoFocus
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search in files..."
          className="w-full bg-vscode-bg border border-vscode-border rounded px-3 py-1.5 pl-7 text-xs text-vscode-text focus:outline-none focus:border-indigo-500"
        />
      </div>
      {query && results.length === 0 && (
        <p className="text-[11px] text-gray-500">No results for "{query}"</p>
      )}
      {results.map(({ file, line, lineNum }, i) => (
        <div
          key={i}
          onClick={() => onFileClick(file.id)}
          className="cursor-pointer hover:bg-slate-800/40 rounded p-2 transition-colors"
        >
          <p className="text-[10px] text-indigo-400 font-mono mb-0.5">{file.name}:{lineNum}</p>
          <p className="text-[11px] text-vscode-text font-mono truncate opacity-80">{line.trim()}</p>
        </div>
      ))}
    </div>
  );
};

/* ── AI ── */
const AIView: React.FC = () => {
  const [input, setInput] = useState('');
  const [chat, setChat] = useState<Array<{ role: 'user' | 'ai'; text: string }>>([]);
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput('');
    setChat((prev) => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);
    try {
      // Use Gemini if API key available, else mock
      const key = (window as any).__GEMINI_KEY__ || import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.GEMINI_API_KEY;
      if (key) {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${key}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: userMsg }] }] }),
        });
        const data = await res.json();
        const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No response.';
        setChat((prev) => [...prev, { role: 'ai', text: reply }]);
      } else {
        await new Promise((r) => setTimeout(r, 600));
        setChat((prev) => [...prev, { role: 'ai', text: `I can help with: "${userMsg}". Set your GEMINI_API_KEY in .env.local for full AI responses.` }]);
      }
    } catch {
      setChat((prev) => [...prev, { role: 'ai', text: 'Error contacting AI. Check your API key.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full p-3 gap-3">
      <div className="bg-indigo-900/20 border border-indigo-500/20 rounded p-2.5 text-xs text-indigo-300 shrink-0">
        <div className="flex items-center gap-2 mb-1 font-bold text-[11px]">
          <Sparkles size={13} />AI Assistant
        </div>
        <span className="opacity-70 text-[10px]">Ask about code, get suggestions, debug help.</span>
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col gap-2 min-h-0">
        {chat.map((msg, i) => (
          <div key={i} className={cn('text-xs rounded p-2 leading-relaxed', msg.role === 'user' ? 'bg-indigo-600/20 text-indigo-200 ml-4' : 'bg-slate-800 text-vscode-text mr-4')}>
            <span className="text-[10px] font-bold opacity-60 block mb-1">{msg.role === 'user' ? 'You' : 'AI'}</span>
            <span className="whitespace-pre-wrap">{msg.text}</span>
          </div>
        ))}
        {loading && (
          <div className="bg-slate-800 text-vscode-text text-xs rounded p-2 mr-4">
            <span className="opacity-60 text-[10px] block mb-1">AI</span>
            <span className="animate-pulse">Thinking...</span>
          </div>
        )}
      </div>

      <div className="relative shrink-0">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder="Ask AI anything... (Enter to send)"
          className="w-full bg-vscode-bg border border-vscode-border rounded px-3 py-2 text-xs text-vscode-text focus:outline-none focus:border-indigo-500 resize-none pr-9"
          rows={3}
        />
        <button
          onClick={handleSend}
          disabled={loading}
          className="absolute right-2 bottom-2.5 text-indigo-500 hover:text-indigo-400 disabled:opacity-40 transition-colors"
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
};

/* ── Community ── */
const CommunityView: React.FC<{
  collaborators: Collaborator[];
  username: string;
  onPermissionChange: (username: string, permission: 'view' | 'edit') => void;
}> = ({ collaborators, username, onPermissionChange }) => (
  <div className="flex flex-col">
    <div className="px-3 py-2 text-[11px] font-bold uppercase opacity-60 select-none border-b border-vscode-border">
      {collaborators.filter((c) => c.online).length} Online · {collaborators.length} Total
    </div>
    <div className="flex flex-col gap-0.5 p-2">
      {collaborators.length === 0 && (
        <p className="text-[11px] text-gray-500 italic px-2 py-3">No collaborators yet. Invite someone!</p>
      )}
      {collaborators.map((c) => (
        <div key={c.username} className="flex items-center gap-2 p-2 hover:bg-slate-800/30 rounded transition-colors group">
          <div className="relative shrink-0">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
              style={{ backgroundColor: c.color }}
            >
              {c.username.slice(0, 2).toUpperCase()}
            </div>
            <span className={cn('absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-vscode-sidebar', c.online ? 'bg-green-400' : 'bg-gray-500')} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-bold text-vscode-text truncate">{c.username}</span>
              {c.username === username && <span className="text-[9px] text-indigo-400">(you)</span>}
            </div>
            <span className="text-[9px] text-gray-500">{c.online ? 'Online' : 'Offline'}</span>
          </div>
          {/* Permission toggle — only show for others */}
          {c.username !== username && (
            <button
              onClick={() => onPermissionChange(c.username, c.permission === 'edit' ? 'view' : 'edit')}
              title={`Switch to ${c.permission === 'edit' ? 'view' : 'edit'} mode`}
              className={cn(
                'shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold transition-colors',
                c.permission === 'edit'
                  ? 'bg-green-900/30 text-green-400 hover:bg-red-900/30 hover:text-red-400'
                  : 'bg-slate-700 text-gray-400 hover:bg-green-900/30 hover:text-green-400'
              )}
            >
              {c.permission === 'edit' ? <><Edit3 size={9} />Edit</> : <><Eye size={9} />View</>}
            </button>
          )}
        </div>
      ))}
    </div>
  </div>
);
