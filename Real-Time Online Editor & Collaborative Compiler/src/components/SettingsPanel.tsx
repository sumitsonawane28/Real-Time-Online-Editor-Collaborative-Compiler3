import React, { useState } from 'react';
import {
  User, Palette, Users, Copy, Check,
  Sun, Moon, Save, RotateCcw,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { AppSettings } from '@/src/types';
import { DEFAULT_SETTINGS } from '@/src/lib/settings';

type Section = 'profile' | 'editor' | 'collaboration';

interface SettingsPanelProps {
  settings: AppSettings;
  roomId: string;
  onUpdate: (patch: Partial<AppSettings>) => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ settings, roomId, onUpdate }) => {
  const [section, setSection] = useState<Section>('profile');
  const [saved, setSaved]     = useState(false);
  const [copied, setCopied]   = useState(false);

  // Local draft — only committed on Save
  const [draft, setDraft] = useState<AppSettings>({ ...settings });

  const patch = (p: Partial<AppSettings>) => setDraft((prev) => ({ ...prev, ...p }));

  const handleSave = () => {
    onUpdate(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    setDraft({ ...DEFAULT_SETTINGS });
    onUpdate({ ...DEFAULT_SETTINGS });
  };

  const handleCopyInvite = () => {
    const link = `${window.location.origin}?room=${roomId}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const navItems: { id: Section; icon: React.ReactNode; label: string }[] = [
    { id: 'profile',       icon: <User size={13} />,    label: 'Profile' },
    { id: 'editor',        icon: <Palette size={13} />, label: 'Editor' },
    { id: 'collaboration', icon: <Users size={13} />,   label: 'Collaboration' },
  ];

  return (
    <div className="flex flex-col h-full text-vscode-text">
      {/* ── Section nav ── */}
      <div className="flex border-b border-vscode-border shrink-0">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setSection(item.id)}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-medium transition-colors border-b-2',
              section === item.id
                ? 'text-white border-indigo-500'
                : 'text-gray-500 border-transparent hover:text-gray-300'
            )}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </div>

      {/* ── Section content ── */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5">

        {/* ── PROFILE ── */}
        {section === 'profile' && (
          <>
            {/* Avatar preview */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-lg shrink-0 overflow-hidden border-2 border-vscode-border">
                {draft.avatarUrl
                  ? <img src={draft.avatarUrl} alt="avatar" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  : (draft.displayName || draft.username || '?').slice(0, 2).toUpperCase()
                }
              </div>
              <div>
                <p className="text-xs font-bold text-vscode-text">{draft.displayName || draft.username || 'No name set'}</p>
                <p className="text-[10px] text-gray-500">Your public identity in rooms</p>
              </div>
            </div>

            <Field label="Username" hint="Used to identify you in rooms">
              <input
                type="text"
                value={draft.username}
                onChange={(e) => patch({ username: e.target.value })}
                placeholder="e.g. johndoe"
                className={inputCls}
              />
            </Field>

            <Field label="Display Name" hint="Shown in chat and collaborator list">
              <input
                type="text"
                value={draft.displayName}
                onChange={(e) => patch({ displayName: e.target.value })}
                placeholder="e.g. John Doe"
                className={inputCls}
              />
            </Field>

            <Field label="Avatar URL" hint="Optional — paste any image URL">
              <input
                type="url"
                value={draft.avatarUrl}
                onChange={(e) => patch({ avatarUrl: e.target.value })}
                placeholder="https://example.com/avatar.png"
                className={inputCls}
              />
            </Field>
          </>
        )}

        {/* ── EDITOR ── */}
        {section === 'editor' && (
          <>
            <Field label="Theme" hint="Applied immediately to the code editor">
              <div className="flex gap-2">
                <ThemeButton
                  active={draft.editorTheme === 'vs-dark'}
                  onClick={() => patch({ editorTheme: 'vs-dark' })}
                  icon={<Moon size={13} />}
                  label="Dark"
                />
                <ThemeButton
                  active={draft.editorTheme === 'light'}
                  onClick={() => patch({ editorTheme: 'light' })}
                  icon={<Sun size={13} />}
                  label="Light"
                />
              </div>
            </Field>

            <Field label={`Font Size — ${draft.fontSize}px`} hint="Applies to Monaco editor">
              <input
                type="range"
                min={12}
                max={24}
                step={1}
                value={draft.fontSize}
                onChange={(e) => patch({ fontSize: Number(e.target.value) })}
                className="w-full accent-indigo-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                <span>12px</span>
                <span>24px</span>
              </div>
            </Field>

            <Field label="Tab Size" hint="Spaces per indent level">
              <div className="flex gap-2">
                {([2, 4] as const).map((n) => (
                  <button
                    key={n}
                    onClick={() => patch({ tabSize: n })}
                    className={cn(
                      'flex-1 py-1.5 rounded text-xs font-medium border transition-colors',
                      draft.tabSize === n
                        ? 'bg-indigo-600 border-indigo-500 text-white'
                        : 'bg-vscode-bg border-vscode-border text-gray-400 hover:text-white'
                    )}
                  >
                    {n} spaces
                  </button>
                ))}
              </div>
            </Field>

            {/* Live preview */}
            <div className="bg-vscode-bg border border-vscode-border rounded p-3 font-mono text-[11px] text-vscode-text leading-relaxed">
              <div className="text-gray-500 text-[10px] mb-2 uppercase font-bold">Preview</div>
              <div style={{ fontSize: draft.fontSize }}>
                <span className="text-blue-400">function </span>
                <span className="text-yellow-300">hello</span>
                <span className="text-white">() {'{'}</span>
              </div>
              <div style={{ fontSize: draft.fontSize, paddingLeft: draft.tabSize * 6 }}>
                <span className="text-purple-400">console</span>
                <span className="text-white">.log(</span>
                <span className="text-green-400">"NexusCode"</span>
                <span className="text-white">);</span>
              </div>
              <div style={{ fontSize: draft.fontSize }}>
                <span className="text-white">{'}'}</span>
              </div>
            </div>
          </>
        )}

        {/* ── COLLABORATION ── */}
        {section === 'collaboration' && (
          <>
            <Toggle
              label="Show Collaborator Cursors"
              hint="See where others are editing in real-time"
              checked={draft.showCursors}
              onChange={(v) => patch({ showCursors: v })}
            />

            <Toggle
              label="Live Code Sync"
              hint="Broadcast your edits to all room members via Socket.IO"
              checked={draft.liveSync}
              onChange={(v) => patch({ liveSync: v })}
            />

            <Field label="Room Invite Link" hint="Share this link to invite collaborators">
              <div className="flex gap-2">
                <input
                  readOnly
                  value={`${window.location.origin}?room=${roomId}`}
                  className="flex-1 bg-vscode-bg border border-vscode-border rounded px-2 py-1.5 text-[11px] text-gray-400 font-mono truncate"
                />
                <button
                  onClick={handleCopyInvite}
                  className="px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-xs text-white transition-colors flex items-center gap-1 shrink-0"
                >
                  {copied ? <><Check size={11} className="text-green-400" />Copied</> : <><Copy size={11} />Copy</>}
                </button>
              </div>
            </Field>

            <div className="bg-indigo-900/20 border border-indigo-500/20 rounded p-3 text-[11px] text-indigo-300">
              <p className="font-bold mb-1">How sync works</p>
              <p className="opacity-80 leading-relaxed">
                When Live Code Sync is <strong>on</strong>, every keystroke is broadcast to all room members via Socket.IO in real-time.
                Turn it <strong>off</strong> to edit privately — your changes won't be sent until you turn it back on.
              </p>
            </div>
          </>
        )}
      </div>

      {/* ── Footer actions ── */}
      <div className="p-3 border-t border-vscode-border flex gap-2 shrink-0">
        <button
          onClick={handleSave}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-medium transition-colors',
            saved
              ? 'bg-green-700 text-white'
              : 'bg-indigo-600 hover:bg-indigo-700 text-white'
          )}
        >
          {saved ? <><Check size={12} />Saved!</> : <><Save size={12} />Save Changes</>}
        </button>
        <button
          onClick={handleReset}
          title="Reset to defaults"
          className="px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-xs text-gray-400 hover:text-white transition-colors"
        >
          <RotateCcw size={12} />
        </button>
      </div>
    </div>
  );
};

// ── Small reusable sub-components ─────────────────────────────────────────────

const inputCls =
  'w-full bg-vscode-bg border border-vscode-border rounded px-3 py-1.5 text-xs text-vscode-text focus:outline-none focus:border-indigo-500 transition-colors';

const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => (
  <div className="flex flex-col gap-1.5">
    <div>
      <label className="text-[11px] font-bold text-vscode-text">{label}</label>
      {hint && <p className="text-[10px] text-gray-500 mt-0.5">{hint}</p>}
    </div>
    {children}
  </div>
);

const ThemeButton: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({
  active, onClick, icon, label,
}) => (
  <button
    onClick={onClick}
    className={cn(
      'flex-1 flex items-center justify-center gap-1.5 py-2 rounded text-xs font-medium border transition-colors',
      active
        ? 'bg-indigo-600 border-indigo-500 text-white'
        : 'bg-vscode-bg border-vscode-border text-gray-400 hover:text-white'
    )}
  >
    {icon}{label}
  </button>
);

const Toggle: React.FC<{ label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }> = ({
  label, hint, checked, onChange,
}) => (
  <div className="flex items-start justify-between gap-3">
    <div className="flex-1">
      <p className="text-[11px] font-bold text-vscode-text">{label}</p>
      {hint && <p className="text-[10px] text-gray-500 mt-0.5">{hint}</p>}
    </div>
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative w-9 h-5 rounded-full transition-colors shrink-0 mt-0.5',
        checked ? 'bg-indigo-600' : 'bg-slate-600'
      )}
    >
      <span className={cn(
        'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
        checked ? 'translate-x-4' : 'translate-x-0.5'
      )} />
    </button>
  </div>
);
