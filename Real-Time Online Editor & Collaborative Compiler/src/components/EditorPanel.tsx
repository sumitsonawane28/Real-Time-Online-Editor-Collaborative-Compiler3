import React, { useRef, useEffect, useState } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { X, Play, Loader2, ChevronDown } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { socket } from '@/src/lib/socket';
import { FileNode, AppSettings, Collaborator } from '@/src/types';
import { DEFAULT_SETTINGS } from '@/src/lib/settings';

const LANGUAGES = ['javascript', 'typescript', 'python', 'c', 'cpp', 'java', 'css', 'html', 'json', 'markdown'];
const RUNNABLE  = ['javascript', 'typescript', 'python', 'c', 'cpp', 'java'];
const CTRL_ENTER = 2048 | 3;

interface RemoteCursor {
  socketId:   string;
  username:   string;
  color:      string;
  lineNumber: number;
  column:     number;
}

interface EditorPanelProps {
  files:            FileNode[];
  activeFileId:     string;
  setActiveFileId:  (id: string) => void;
  onCloseFile:      (id: string) => void;
  onContentChange:  (id: string, content: string) => void;
  onLanguageChange: (fileId: string, language: string) => void;
  onRun:            () => void;
  isRunning:        boolean;
  roomId?:          string;
  readOnly?:        boolean;
  collaborators?:   Collaborator[];
  editorSettings?:  Pick<AppSettings, 'editorTheme' | 'fontSize' | 'tabSize' | 'showCursors' | 'liveSync'>;
}

export const EditorPanel: React.FC<EditorPanelProps> = ({
  files, activeFileId, setActiveFileId, onCloseFile,
  onContentChange, onLanguageChange, onRun,
  isRunning, roomId = 'default', readOnly = false,
  collaborators = [], editorSettings,
}) => {
  const s = { ...DEFAULT_SETTINGS, ...editorSettings };

  const activeFile     = files.find((f) => f.id === activeFileId) || files[0];
  const editorRef      = useRef<any>(null);
  const monacoRef      = useRef<any>(null);
  const isRemoteChange = useRef(false);
  const decorationsRef = useRef<string[]>([]);                    // Monaco decoration IDs
  const styleTagRef    = useRef<HTMLStyleElement | null>(null);   // injected <style> for cursor CSS
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [remoteCursors, setRemoteCursors]   = useState<Map<string, RemoteCursor>>(new Map());

  // ── Inject / update per-user cursor CSS ────────────────────────────────────
  // Monaco decorations use CSS class names, so we inject a <style> tag with
  // one rule per remote user keyed by their socketId.
  useEffect(() => {
    if (!styleTagRef.current) {
      const tag = document.createElement('style');
      tag.id = 'nexus-cursors';
      document.head.appendChild(tag);
      styleTagRef.current = tag;
    }

    const rules = [...remoteCursors.values()].map(({ socketId, color, username }) => {
      const safe = socketId.replace(/[^a-zA-Z0-9]/g, '_');
      // Cursor line (thin colored vertical bar)
      return `
        .cursor-${safe} {
          border-left: 2px solid ${color} !important;
          margin-left: -1px;
        }
        .cursor-label-${safe}::after {
          content: "${username.replace(/"/g, '')}";
          background: ${color};
          color: #fff;
          font-size: 10px;
          font-family: sans-serif;
          padding: 1px 4px;
          border-radius: 2px;
          position: absolute;
          top: -18px;
          left: 0;
          white-space: nowrap;
          pointer-events: none;
          z-index: 100;
        }
      `;
    }).join('\n');

    styleTagRef.current.textContent = rules;
  }, [remoteCursors]);

  // ── Re-render decorations whenever cursors or active file changes ───────────
  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;

    const newDecorations = [...remoteCursors.values()].map(({ socketId, lineNumber, column }) => {
      const safe = socketId.replace(/[^a-zA-Z0-9]/g, '_');
      return {
        range: new monaco.Range(lineNumber, column, lineNumber, column),
        options: {
          className:       `cursor-${safe}`,
          beforeContentClassName: `cursor-label-${safe}`,
          stickiness:      monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
        },
      };
    });

    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, newDecorations);
  }, [remoteCursors, activeFileId]);

  // ── Remote cursor-change listener ──────────────────────────────────────────
  useEffect(() => {
    const handleCursorChange = ({
      socketId, username, color, cursor,
    }: { socketId: string; username: string; color: string; cursor: { lineNumber: number; column: number } }) => {
      setRemoteCursors((prev) => {
        const next = new Map(prev);
        next.set(socketId, { socketId, username, color: color || '#3b82f6', ...cursor });
        return next;
      });
    };

    // Remove cursor when user leaves
    const handleUserLeft = ({ username }: { username: string }) => {
      setRemoteCursors((prev) => {
        const next = new Map(prev);
        for (const [sid, data] of next.entries()) {
          if (data.username === username) { next.delete(sid); break; }
        }
        return next;
      });
    };

    socket.on('cursor-change', handleCursorChange);
    socket.on('user-left',     handleUserLeft);
    return () => {
      socket.off('cursor-change', handleCursorChange);
      socket.off('user-left',     handleUserLeft);
    };
  }, []);

  // ── Apply font/tab size changes live ───────────────────────────────────────
  useEffect(() => {
    if (!editorRef.current) return;
    editorRef.current.updateOptions({ fontSize: s.fontSize, tabSize: s.tabSize });
  }, [s.fontSize, s.tabSize]);

  // ── Remote code-change handler ─────────────────────────────────────────────
  useEffect(() => {
    const handleCodeChange = ({ code, language, fileId }: { code: string; language: string; fileId?: string }) => {
      if (fileId && fileId !== activeFileId) return;
      if (!editorRef.current) return;
      const model = editorRef.current.getModel();
      if (!model || model.getValue() === code) return;
      isRemoteChange.current = true;
      const fullRange = model.getFullModelRange();
      model.pushEditOperations([], [{ range: fullRange, text: code }], () => null);
      isRemoteChange.current = false;
    };
    socket.on('code-change', handleCodeChange);
    return () => { socket.off('code-change', handleCodeChange); };
  }, [activeFileId]);

  // ── Editor mount ───────────────────────────────────────────────────────────
  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    editor.addCommand(CTRL_ENTER, () => { if (!readOnly) onRun(); });

    editor.onDidChangeCursorPosition((e) => {
      if (!s.showCursors) return;
      socket.emit('cursor-change', {
        roomId,
        cursor:   { lineNumber: e.position.lineNumber, column: e.position.column },
        username: '', // filled by server from socket.data
      });
    });
  };

  // ── Local edit → broadcast ─────────────────────────────────────────────────
  const handleChange = (value: string | undefined) => {
    if (isRemoteChange.current || value === undefined || !activeFile) return;
    onContentChange(activeFile.id, value);
    if (s.liveSync) {
      socket.emit('code-change', {
        roomId,
        code:     value,
        language: activeFile.language,
        fileId:   activeFile.id,
      });
    }
  };

  const handleLangChange = (lang: string) => {
    if (!activeFile) return;
    onLanguageChange(activeFile.id, lang);
    setShowLangPicker(false);
  };

  if (!activeFile) {
    return (
      <div className="flex-1 flex items-center justify-center bg-vscode-bg text-gray-500 text-sm flex-col gap-3">
        <p>No files open</p>
        <p className="text-xs opacity-60">Use the Explorer to create a new file</p>
      </div>
    );
  }

  const canRun = RUNNABLE.includes(activeFile.language);

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

      {/* ── Tab bar ── */}
      <div className="flex bg-vscode-sidebar h-9 overflow-x-auto no-scrollbar border-b border-vscode-border shrink-0">
        {files.map((file) => (
          <div
            key={file.id}
            onClick={() => setActiveFileId(file.id)}
            className={cn(
              'group relative flex items-center gap-1.5 px-3 h-full border-r border-vscode-border cursor-pointer min-w-fit transition-colors text-xs shrink-0',
              file.id === activeFileId
                ? 'bg-vscode-bg text-vscode-text border-t-2 border-t-indigo-500'
                : 'bg-transparent text-vscode-text opacity-50 hover:opacity-80'
            )}
          >
            <span className="font-mono text-[10px] text-indigo-400">
              {file.name.split('.').pop()?.toUpperCase()}
            </span>
            <span className="max-w-[100px] truncate">{file.name}</span>
            {/* Show which collaborators are in this file */}
            {[...remoteCursors.values()]
              .filter((c) => c.lineNumber > 0)
              .slice(0, 3)
              .map((c) => (
                <span
                  key={c.socketId}
                  title={c.username}
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: c.color }}
                />
              ))}
            <button
              onClick={(e) => { e.stopPropagation(); onCloseFile(file.id); }}
              className="ml-0.5 p-0.5 rounded hover:bg-slate-600 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-all"
            >
              <X size={11} />
            </button>
          </div>
        ))}
      </div>

      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between px-3 py-1 bg-vscode-sidebar border-b border-vscode-border shrink-0">
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setShowLangPicker((v) => !v)}
              className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-white bg-vscode-bg border border-vscode-border rounded px-2 py-0.5 transition-colors"
            >
              {activeFile.language}
              <ChevronDown size={10} />
            </button>
            {showLangPicker && (
              <div className="absolute top-7 left-0 bg-vscode-sidebar border border-vscode-border rounded shadow-xl z-50 py-1 min-w-[130px] max-h-48 overflow-y-auto">
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang}
                    onClick={() => handleLangChange(lang)}
                    className={cn(
                      'w-full text-left px-3 py-1.5 text-xs transition-colors',
                      lang === activeFile.language ? 'text-indigo-400 bg-indigo-900/20' : 'text-vscode-text hover:bg-slate-700'
                    )}
                  >
                    {lang}
                  </button>
                ))}
              </div>
            )}
          </div>

          {readOnly && (
            <span className="text-[10px] text-yellow-400 bg-yellow-900/20 border border-yellow-800 rounded px-2 py-0.5">
              View Only
            </span>
          )}
          {!s.liveSync && (
            <span className="text-[10px] text-orange-400 bg-orange-900/20 border border-orange-800 rounded px-2 py-0.5">
              Sync Off
            </span>
          )}

          {/* Live cursor presence pills */}
          {[...remoteCursors.values()].map((c) => (
            <span
              key={c.socketId}
              className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full text-white font-medium"
              style={{ backgroundColor: c.color }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-white/60 animate-pulse" />
              {c.username} · L{c.lineNumber}:{c.column}
            </span>
          ))}
        </div>

        {canRun && !readOnly && (
          <button
            onClick={onRun}
            disabled={isRunning}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-semibold transition-all',
              isRunning
                ? 'bg-yellow-600/20 text-yellow-400 cursor-not-allowed'
                : 'bg-green-700 hover:bg-green-600 text-white'
            )}
          >
            {isRunning
              ? <><Loader2 size={11} className="animate-spin" />Running</>
              : <><Play size={11} fill="currentColor" />Run (Ctrl+Enter)</>
            }
          </button>
        )}
      </div>

      {/* ── Monaco Editor ── */}
      <div className="flex-1 relative">
        <Editor
          height="100%"
          theme={s.editorTheme}
          path={activeFile.name}
          language={activeFile.language}
          value={activeFile.content}
          onMount={handleMount}
          onChange={handleChange}
          options={{
            fontSize:                s.fontSize,
            tabSize:                 s.tabSize,
            minimap:                 { enabled: true },
            scrollBeyondLastLine:    false,
            automaticLayout:         true,
            padding:                 { top: 8 },
            fontFamily:              "'JetBrains Mono', 'Fira Code', monospace",
            lineNumbers:             'on',
            readOnly,
            cursorStyle:             'line',
            wordWrap:                'on',
            renderWhitespace:        'selection',
            bracketPairColorization: { enabled: true },
            suggest:                 { showKeywords: true },
          }}
        />
      </div>
    </div>
  );
};
