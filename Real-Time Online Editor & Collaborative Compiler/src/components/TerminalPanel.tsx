import React, { useState, useRef, useEffect } from 'react';
import { X, Maximize2, Minimize2, Copy, Check, Loader2, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/src/lib/utils';
import { TerminalLine, RunState, FileNode } from '@/src/types';

const TABS = ['OUTPUT', 'PROBLEMS'] as const;
type TerminalTab = typeof TABS[number];

interface TerminalPanelProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  terminalLines: TerminalLine[];
  runState: RunState;
  isRunning: boolean;
  activeFile?: FileNode;
  onClear: () => void;
}

export const TerminalPanel: React.FC<TerminalPanelProps> = ({
  isOpen, setIsOpen, terminalLines, runState, isRunning, activeFile, onClear,
}) => {
  const [isMaximized, setIsMaximized] = useState(false);
  const [activeTab, setActiveTab]     = useState<TerminalTab>('OUTPUT');
  const [copied, setCopied]           = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom whenever a new line arrives
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [terminalLines]);

  // Auto-switch to OUTPUT tab when a run starts
  useEffect(() => {
    if (isRunning) setActiveTab('OUTPUT');
  }, [isRunning]);

  const errorLines   = terminalLines.filter((l) => l.isError);
  const outputLines  = terminalLines.filter((l) => !l.isError);
  const hasErrors    = errorLines.length > 0;

  const handleCopy = () => {
    const text = terminalLines.map((l) => l.text).join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const elapsedMs = runState.startedAt ? Date.now() - runState.startedAt : 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ height: 0 }}
          animate={{ height: isMaximized ? '55vh' : 200 }}
          exit={{ height: 0 }}
          transition={{ type: 'tween', duration: 0.15 }}
          className="bg-vscode-terminal border-t border-vscode-border flex flex-col overflow-hidden shrink-0"
        >
          {/* ── Tab bar ── */}
          <div className="h-8 px-3 flex items-center justify-between bg-vscode-activity border-b border-vscode-border shrink-0">
            <div className="flex gap-1 h-full items-center">
              {TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    'text-[10px] font-bold tracking-wider px-2 h-full border-b-2 transition-colors',
                    activeTab === tab
                      ? 'text-white border-white'
                      : 'text-vscode-text opacity-50 border-transparent hover:opacity-80'
                  )}
                >
                  {tab}
                  {tab === 'PROBLEMS' && hasErrors && (
                    <span className="ml-1 bg-red-500 text-white text-[8px] rounded-full px-1">
                      {errorLines.length}
                    </span>
                  )}
                </button>
              ))}

              {/* Live run indicator */}
              {isRunning && (
                <div className="flex items-center gap-1.5 ml-3 text-yellow-400 text-[10px]">
                  <Loader2 size={10} className="animate-spin" />
                  <span>
                    Running {activeFile?.name}
                    {runState.triggeredBy ? ` · by ${runState.triggeredBy}` : ''}
                  </span>
                </div>
              )}

              {/* Finished indicator */}
              {!isRunning && terminalLines.length > 0 && (
                <div className={cn(
                  'ml-3 text-[10px] flex items-center gap-1',
                  hasErrors ? 'text-red-400' : 'text-green-400'
                )}>
                  <span>{hasErrors ? '✗ Error' : '✓ Done'}</span>
                  {runState.triggeredBy && (
                    <span className="text-gray-500">· {runState.triggeredBy}</span>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-1">
              {terminalLines.length > 0 && (
                <>
                  <button
                    onClick={handleCopy}
                    title="Copy output"
                    className="p-1 text-gray-500 hover:text-white transition-colors"
                  >
                    {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                  </button>
                  <button
                    onClick={onClear}
                    title="Clear terminal"
                    className="p-1 text-gray-500 hover:text-white transition-colors"
                  >
                    <Trash2 size={12} />
                  </button>
                </>
              )}
              <button
                onClick={() => setIsMaximized((v) => !v)}
                className="p-1 text-gray-500 hover:text-white transition-colors"
              >
                {isMaximized ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-gray-500 hover:text-white transition-colors"
              >
                <X size={12} />
              </button>
            </div>
          </div>

          {/* ── Content ── */}
          <div className="flex-1 overflow-y-auto p-3 font-mono text-[12px] leading-relaxed">

            {/* OUTPUT tab */}
            {activeTab === 'OUTPUT' && (
              <div className="flex flex-col gap-0.5">
                {/* Empty state */}
                {!isRunning && terminalLines.length === 0 && (
                  <div className="text-gray-500 opacity-60 text-[11px]">
                    Output will appear here when code runs.{' '}
                    <kbd className="bg-slate-700 px-1 rounded text-[10px]">Ctrl+Enter</kbd> to run,
                    or just type — auto-runs after 1.5s of inactivity.
                  </div>
                )}

                {/* Run header */}
                {terminalLines.length > 0 && (
                  <div className="text-green-500 text-[11px] mb-1 flex items-center gap-2">
                    <span>
                      {['c', 'cpp'].includes(activeFile?.language || '')
                        ? `$ gcc ${activeFile?.name} && ./a.out`
                        : `$ run ${activeFile?.name}`}
                    </span>
                    <span className="text-gray-500">({activeFile?.language})</span>
                  </div>
                )}

                {/* Streaming lines */}
                {terminalLines.map((line) => (
                  <div
                    key={line.id}
                    className={cn(
                      'whitespace-pre-wrap break-words leading-5',
                      line.isError ? 'text-red-300' : 'text-vscode-text'
                    )}
                  >
                    {line.text}
                  </div>
                ))}

                {/* Live blinking cursor while running */}
                {isRunning && (
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-green-400">▶</span>
                    <span className="inline-block w-2 h-3.5 bg-green-400 animate-pulse" />
                  </div>
                )}

                <div ref={bottomRef} />
              </div>
            )}

            {/* PROBLEMS tab */}
            {activeTab === 'PROBLEMS' && (
              <div className="flex flex-col gap-1">
                {!hasErrors && (
                  <div className="text-gray-500 opacity-60 text-[11px]">No problems detected.</div>
                )}
                {errorLines.map((line) => (
                  <div key={line.id} className="flex items-start gap-2">
                    <span className="text-red-400 shrink-0 text-[11px]">✕</span>
                    <pre className="text-red-300 text-[11px] whitespace-pre-wrap break-words">
                      {line.text}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
