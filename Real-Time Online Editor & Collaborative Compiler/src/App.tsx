import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Navbar } from './layout/Navbar';
import { ActivityBar, ActivityTab } from './layout/ActivityBar';
import { Sidebar } from './layout/Sidebar';
import { EditorPanel } from './components/EditorPanel';
import { TerminalPanel } from './components/TerminalPanel';
import { ChatPanel } from './components/ChatPanel';
import { AuthModal } from './components/AuthModal';
import { RoomModal } from './components/RoomModal';
import { FileNode, User, RunResult, Collaborator, TerminalLine, RunState } from './types';
import { AnimatePresence } from 'motion/react';
import { socket } from './lib/socket';
import { useSettings } from './lib/settings';
import { api } from './lib/api';

const detectLanguage = (name: string): string => {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
    py: 'python', c: 'c', cpp: 'cpp', cc: 'cpp', java: 'java',
    css: 'css', html: 'html', json: 'json', md: 'markdown',
  };
  return map[ext] || 'plaintext';
};

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#14b8a6'];
const RUNNABLE = ['javascript', 'typescript', 'python', 'c', 'cpp', 'java'];
const AUTO_RUN_DELAY = 1500; // ms after last keystroke

const INITIAL_FILES: FileNode[] = [
  {
    id: '1',
    name: 'hello.c',
    language: 'c',
    content: `#include <stdio.h>\n#include <math.h>\n\nint main() {\n    printf("Hello from NexusCode C Compiler!\\n");\n\n    for (int i = 1; i <= 5; i++) {\n        printf("  Line %d\\n", i);\n    }\n\n    printf("sqrt(144) = %.0f\\n", sqrt(144));\n    return 0;\n}`,
    isOpen: true,
  },
  {
    id: '2',
    name: 'main.py',
    language: 'python',
    content: `# Python example\nprint("Hello from Python!")\n\nfor i in range(1, 6):\n    print(f"  Line {i}")\n\nprint(f"2 ** 10 = {2 ** 10}")`,
    isOpen: true,
  },
  {
    id: '3',
    name: 'index.js',
    language: 'javascript',
    content: `// JavaScript example\nconsole.log("Hello from JavaScript!");\n\nconst greet = (name) => \`Hello, \${name}!\`;\nconsole.log(greet("NexusCode"));\n\n[1, 2, 3].forEach(n => console.log("  item", n));`,
    isOpen: true,
  },
];

export default function App() {
  // ── Layout ───────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab]           = useState<ActivityTab>('explorer');
  const [isSidebarOpen, setIsSidebarOpen]   = useState(true);
  const [isTerminalOpen, setIsTerminalOpen] = useState(true);
  const [isChatOpen, setIsChatOpen]         = useState(true);

  // ── Files ────────────────────────────────────────────────────────────────────
  const [files, setFiles]               = useState<FileNode[]>(INITIAL_FILES);
  const [activeFileId, setActiveFileId] = useState(INITIAL_FILES[0].id);

  // ── Auth ─────────────────────────────────────────────────────────────────────
  const [user, setUser]                   = useState<User | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // ── Room ─────────────────────────────────────────────────────────────────────
  const [roomId, setRoomId]               = useState('default');
  const [roomName, setRoomName]           = useState('Default Room');
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [myPermission, setMyPermission]   = useState<'view' | 'edit'>('edit');

  // ── Run / Terminal ───────────────────────────────────────────────────────────
  // Legacy runResult kept for HTTP fallback (not used when socket run works)
  const [runResult, setRunResult]         = useState<RunResult | null>(null);
  const [isRunning, setIsRunning]         = useState(false);
  // Streaming lines — every room member sees the same lines in real-time
  const [terminalLines, setTerminalLines] = useState<TerminalLine[]>([]);
  const [runState, setRunState]           = useState<RunState>({
    running: false, language: '', triggeredBy: '', startedAt: null,
  });
  // Debounce ref for auto-run
  const autoRunTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Invite / Toast ───────────────────────────────────────────────────────────
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [toast, setToast]                     = useState<string | null>(null);

  const roomIdRef = useRef(roomId);
  roomIdRef.current = roomId;

  // ── Settings (persisted to localStorage) ─────────────────────────────────────
  const [settings, updateSettings] = useSettings();

  // ── Restore user + load their files from DB ──────────────────────────────────
  useEffect(() => {
    const stored = localStorage.getItem('nexuscode_user');
    if (stored) {
      try {
        const u = JSON.parse(stored);
        setUser(u);
        if (u.token) loadUserFiles(u.token);
      } catch {}
    }
  }, []);

  const loadUserFiles = async (token: string) => {
    try {
      const dbFiles = await api.getUserFiles(token);
      if (dbFiles.length === 0) return;
      const mapped: FileNode[] = dbFiles.map((f) => ({
        id:       f._id,
        name:     f.fileName,          // exact name the user gave it
        language: detectLanguage(f.fileName),
        content:  f.code,
        isOpen:   true,
      }));
      setFiles(mapped);
      setActiveFileId(mapped[0].id);
    } catch { /* backend unreachable — keep initial files */ }
  };

  // Debounce ref for auto-save
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  // ── Socket: room + run events ─────────────────────────────────────────────────
  useEffect(() => {
    const username = user?.username || 'Guest';

    const doJoin = () => {
      socket.emit('join-room', { roomId, username, permission: myPermission });
    };
    if (socket.connected) doJoin();
    else socket.once('connect', doJoin);

    // Presence
    const onRoomUsers = (users: Array<{ socketId: string; username: string; permission: string; color: string }>) => {
      setCollaborators(users.map((u) => ({
        username:   u.username,
        socketId:   u.socketId,
        permission: (u.permission as 'view' | 'edit') || 'edit',
        color:      u.color || COLORS[0],
        online:     true,
      })));
    };
    const onUserJoined = ({ username: u, color }: { username: string; color: string }) => {
      setCollaborators((prev) => {
        if (prev.find((c) => c.username === u)) return prev;
        return [...prev, { username: u, permission: 'edit', color, online: true }];
      });
      showToast(`${u} joined the room`);
    };
    const onUserLeft = ({ username: u }: { username: string }) => {
      setCollaborators((prev) => prev.map((c) => c.username === u ? { ...c, online: false } : c));
      showToast(`${u} left the room`);
    };

    // State sync
    const onSyncState = ({ code, language, fileId }: { code: string; language: string; fileId?: string }) => {
      if (!code) return;
      setFiles((prev) => {
        const targetId = fileId || prev[0]?.id;
        return prev.map((f) => f.id === targetId ? { ...f, content: code, language: language || f.language } : f);
      });
    };
    const onLanguageChange = ({ fileId, language }: { fileId: string; language: string }) => {
      setFiles((prev) => prev.map((f) => f.id === fileId ? { ...f, language } : f));
    };

    // Shared file list — another user created a file
    const onFileCreated = ({ file }: { file: FileNode }) => {
      setFiles((prev) => prev.find((f) => f.id === file.id) ? prev : [...prev, file]);
    };
    // Shared file list — another user deleted a file
    const onFileDeleted = ({ fileId }: { fileId: string }) => {
      setFiles((prev) => {
        const remaining = prev.filter((f) => f.id !== fileId);
        setActiveFileId((cur) => cur === fileId && remaining.length > 0 ? remaining[remaining.length - 1].id : cur);
        return remaining;
      });
    };
    const onPermissionChanged = ({ username: u, permission }: { username: string; permission: 'view' | 'edit' }) => {
      if (u === username) { setMyPermission(permission); showToast(`Your permission changed to: ${permission}`); }
      setCollaborators((prev) => prev.map((c) => c.username === u ? { ...c, permission } : c));
    };
    const onInvited = ({ roomId: rid, roomName: rn, invitedBy, permission }: any) => {
      const accept = window.confirm(`${invitedBy} invited you to join room "${rn}" as ${permission}.\n\nAccept?`);
      if (accept) { setRoomId(rid); setRoomName(rn); setMyPermission(permission); setRunResult(null); }
    };
    const onInviteError = ({ message }: { message: string }) => showToast(`⚠ ${message}`);

    // ── Streaming run events — shared with ALL room members ───────────────────
    const onRunStart = ({ language: lang, triggeredBy, timestamp }: {
      language: string; triggeredBy: string; timestamp: number;
    }) => {
      setTerminalLines([]);   // clear terminal for everyone in the room
      setRunResult(null);
      setIsRunning(true);
      setIsTerminalOpen(true);
      setRunState({ running: true, language: lang, triggeredBy, startedAt: timestamp });
    };

    const onRunOutput = ({ line, isError }: { line: string; isError: boolean }) => {
      setTerminalLines((prev) => [
        ...prev,
        { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, text: line, isError, ts: Date.now() },
      ]);
    };

    const onRunEnd = () => {
      setIsRunning(false);
      setRunState((prev) => ({ ...prev, running: false }));
    };

    socket.on('room-users',         onRoomUsers);
    socket.on('user-joined',        onUserJoined);
    socket.on('user-left',          onUserLeft);
    socket.on('sync-state',         onSyncState);
    socket.on('language-change',    onLanguageChange);
    socket.on('permission-changed', onPermissionChanged);
    socket.on('invited',            onInvited);
    socket.on('invite-error',       onInviteError);
    socket.on('run-start',          onRunStart);
    socket.on('run-output',         onRunOutput);
    socket.on('run-end',            onRunEnd);
    socket.on('file-created',       onFileCreated);
    socket.on('file-deleted',       onFileDeleted);

    return () => {
      socket.off('connect',           doJoin);
      socket.off('room-users',        onRoomUsers);
      socket.off('user-joined',       onUserJoined);
      socket.off('user-left',         onUserLeft);
      socket.off('sync-state',        onSyncState);
      socket.off('language-change',   onLanguageChange);
      socket.off('permission-changed',onPermissionChanged);
      socket.off('invited',           onInvited);
      socket.off('invite-error',      onInviteError);
      socket.off('run-start',         onRunStart);
      socket.off('run-output',        onRunOutput);
      socket.off('run-end',           onRunEnd);
      socket.off('file-created',      onFileCreated);
      socket.off('file-deleted',      onFileDeleted);
    };
  }, [roomId, user?.username, myPermission]);

  // ── Handlers ──────────────────────────────────────────────────────────────────
  const handleTabChange = (tab: ActivityTab) => {
    if (activeTab === tab) setIsSidebarOpen((p) => !p);
    else { setActiveTab(tab); setIsSidebarOpen(true); }
  };

  const handleCloseFile = (id: string) => {
    const remaining = files.filter((f) => f.id !== id);
    setFiles(remaining);
    if (activeFileId === id && remaining.length > 0)
      setActiveFileId(remaining[remaining.length - 1].id);
    // Broadcast deletion to room so other users' file lists update
    socket.emit('file-deleted', { roomId, fileId: id });
    // Delete from DB
    if (user?.token) api.deleteFile(id, user.token).catch(() => {});
  };

  const handleNewFile = async (name: string, language: string) => {
    const id = Date.now().toString();
    const newFile: FileNode = { id, name, language, content: '', isOpen: true };
    setFiles((prev) => [...prev, newFile]);
    setActiveFileId(id);
    // Broadcast to room so other users see the new file immediately
    socket.emit('file-created', { roomId, file: newFile });
    // Persist to DB
    if (user?.token) {
      try {
        const saved = await api.saveFile(name, '', user.token);
        // Swap temp id for real MongoDB _id and re-broadcast with correct id
        const savedFile: FileNode = { ...newFile, id: saved._id };
        setFiles((prev) => prev.map((f) => f.id === id ? savedFile : f));
        setActiveFileId(saved._id);
        socket.emit('file-created', { roomId, file: savedFile });
      } catch {}
    }
  };

  const handleFileContentChange = (id: string, content: string) => {
    setFiles((prev) => prev.map((f) => f.id === id ? { ...f, content } : f));
    // Auto-save to MongoDB 2s after last keystroke
    if (user?.token) {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        const file = files.find((f) => f.id === id);
        if (file) api.saveFile(file.name, content, user.token).catch(() => {});
      }, 2000);
    }
  };

  const handleLanguageChange = (fileId: string, language: string) => {
    setFiles((prev) => prev.map((f) => f.id === fileId ? { ...f, language } : f));
    socket.emit('language-change', { roomId, fileId, language });
  };

  /**
   * handleRunCode — emits run-code via socket so ALL room members
   * see the streaming output in real-time.
   */
  const handleRunCode = useCallback(() => {
    const activeFile = files.find((f) => f.id === activeFileId);
    if (!activeFile || !RUNNABLE.includes(activeFile.language)) return;
    if (isRunning) return; // prevent double-run
    socket.emit('run-code', {
      roomId,
      code:        activeFile.content,
      language:    activeFile.language,
      triggeredBy: user?.username || 'Guest',
    });
  }, [files, activeFileId, roomId, user?.username, isRunning]);

  /**
   * handleCodeChange — called on every editor keystroke.
   * 1. Updates local file content
   * 2. Resets the auto-run debounce timer
   * After AUTO_RUN_DELAY ms of no typing, auto-runs the code.
   */
  const handleCodeChangeWithAutoRun = useCallback((id: string, content: string) => {
    setFiles((prev) => prev.map((f) => f.id === id ? { ...f, content } : f));

    const file = files.find((f) => f.id === id);
    if (!file || !RUNNABLE.includes(file.language)) return;

    // Clear previous debounce
    if (autoRunTimer.current) clearTimeout(autoRunTimer.current);

    // Schedule auto-run after delay
    autoRunTimer.current = setTimeout(() => {
      socket.emit('run-code', {
        roomId,
        code:        content,
        language:    file.language,
        triggeredBy: user?.username || 'Guest',
      });
    }, AUTO_RUN_DELAY);
  }, [files, roomId, user?.username]);

  const handleAuth = async (u: User) => {
    setUser(u);
    localStorage.setItem('nexuscode_user', JSON.stringify(u));
    setShowAuthModal(false);
    if (u.token) await loadUserFiles(u.token);
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('nexuscode_user');
    socket.disconnect();
    setTimeout(() => socket.connect(), 100);
  };

  const handleJoinRoom = (rid: string, rname: string) => {
    setRoomId(rid);
    setRoomName(rname);
    setShowRoomModal(false);
    setRunResult(null);
    setTerminalLines([]);
    setTimeout(() => socket.emit('request-state', { roomId: rid }), 300);
  };

  const activeFile = files.find((f) => f.id === activeFileId) || files[0];

  return (
    <div className="h-screen w-screen flex flex-col bg-vscode-bg text-vscode-text overflow-hidden font-sans">
      <Navbar
        user={user}
        roomName={roomName}
        collaborators={collaborators}
        isRunning={isRunning}
        isTerminalOpen={isTerminalOpen}
        isChatOpen={isChatOpen}
        onRun={handleRunCode}
        onToggleTerminal={() => setIsTerminalOpen((v) => !v)}
        onToggleChat={() => setIsChatOpen((v) => !v)}
        onOpenRoom={() => setShowRoomModal(true)}
        onOpenInvite={() => setShowInviteModal(true)}
        onLogin={() => setShowAuthModal(true)}
        onLogout={handleLogout}
      />

      <div className="flex-1 flex overflow-hidden">
        <div className="flex h-full">
          <ActivityBar activeTab={activeTab} setActiveTab={handleTabChange} />
          <AnimatePresence mode="wait">
            {isSidebarOpen && (
              <Sidebar
                key="sidebar"
                activeTab={activeTab}
                isOpen={true}
                files={files}
                activeFileId={activeFileId}
                collaborators={collaborators}
                roomId={roomId}
                username={user?.username || 'Guest'}
                settings={settings}
                onFileClick={setActiveFileId}
                onNewFile={handleNewFile}
                onCloseFile={handleCloseFile}
                onPermissionChange={(uname, permission) => {
                  socket.emit('change-permission', { roomId, username: uname, permission });
                }}
                onSettingsUpdate={updateSettings}
              />
            )}
          </AnimatePresence>
        </div>

        <div className="flex-1 flex flex-col min-w-0">
          <EditorPanel
            files={files}
            activeFileId={activeFileId}
            setActiveFileId={setActiveFileId}
            onCloseFile={handleCloseFile}
            onContentChange={handleCodeChangeWithAutoRun}
            onLanguageChange={handleLanguageChange}
            onRun={handleRunCode}
            isRunning={isRunning}
            roomId={roomId}
            readOnly={myPermission === 'view'}
            collaborators={collaborators}
            editorSettings={settings}
          />
          <TerminalPanel
            isOpen={isTerminalOpen}
            setIsOpen={setIsTerminalOpen}
            terminalLines={terminalLines}
            runState={runState}
            isRunning={isRunning}
            activeFile={activeFile}
            onClear={() => setTerminalLines([])}
          />
        </div>

        <ChatPanel
          isOpen={isChatOpen}
          setIsOpen={setIsChatOpen}
          roomId={roomId}
          username={user?.username || 'Guest'}
          collaborators={collaborators}
          showInviteModal={showInviteModal}
          setShowInviteModal={setShowInviteModal}
          onInvite={(inviteeUsername, permission) => {
            socket.emit('invite-user', {
              roomId,
              roomName,
              invitedBy: user?.username || 'Guest',
              targetUsername: inviteeUsername,
              permission,
            });
          }}
        />
      </div>

      <footer className="h-6 bg-vscode-status text-white flex items-center justify-between px-3 text-[11px] font-medium shrink-0 z-50">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowRoomModal(true)}
            className="flex items-center gap-1 hover:bg-white/10 px-1.5 py-0.5 rounded cursor-pointer transition-colors"
          >
            <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
            <span>{roomName}</span>
          </button>
          <span className="opacity-60">|</span>
          <span className="opacity-70">{collaborators.filter((c) => c.online).length} online</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="opacity-70">{activeFile?.language || 'plaintext'}</span>
          <span className="opacity-70">UTF-8</span>
          <button
            onClick={() => setIsTerminalOpen((v) => !v)}
            className="flex items-center gap-1 hover:bg-white/10 px-1.5 py-0.5 rounded cursor-pointer transition-colors"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isRunning ? 'bg-yellow-400 animate-pulse' : 'bg-green-400'}`} />
            <span>{isRunning ? `Running (${runState.triggeredBy})...` : myPermission === 'view' ? 'View Only' : 'Ready'}</span>
          </button>
        </div>
      </footer>

      <AnimatePresence>
        {toast && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-slate-800 border border-vscode-border text-vscode-text text-xs px-4 py-2 rounded-lg shadow-xl z-50 pointer-events-none">
            {toast}
          </div>
        )}
      </AnimatePresence>

      {showAuthModal && (
        <AuthModal onAuth={handleAuth} onClose={() => setShowAuthModal(false)} />
      )}
      {showRoomModal && (
        <RoomModal
          user={user}
          currentRoomId={roomId}
          onJoin={handleJoinRoom}
          onClose={() => setShowRoomModal(false)}
          onLoginRequired={() => { setShowRoomModal(false); setShowAuthModal(true); }}
        />
      )}
    </div>
  );
}
