export interface FileNode {
  id: string;
  name: string;
  language: string;
  content: string;
  isOpen: boolean;
}

export interface ChatMessage {
  id: string;
  user: string;
  text: string;
  timestamp: string;
  avatar?: string;
  isMe?: boolean;
}

export interface User {
  id: string;
  username: string;
  email: string;
  token: string;
}

export interface Collaborator {
  username: string;
  socketId?: string;
  permission: 'view' | 'edit';
  color: string;
  online: boolean;
}

export interface Room {
  _id: string;
  roomId: string;
  name: string;
  language: string;
  code: string;
  owner: string;
  createdAt: string;
}

export interface RunResult {
  output: string;
  error: string;
}

/** A single line of streaming terminal output */
export interface TerminalLine {
  id: string;       // unique key for React rendering
  text: string;     // the line content
  isError: boolean; // true = stderr (red), false = stdout (white)
  ts: number;       // timestamp for ordering
}

/** State of the current run session */
export interface RunState {
  running: boolean;
  language: string;
  triggeredBy: string;
  startedAt: number | null;
}

export interface InvitePayload {
  roomId: string;
  invitedBy: string;
  permission: 'view' | 'edit';
}

/** All persisted app settings */
export interface AppSettings {
  // Profile
  username: string;
  displayName: string;
  avatarUrl: string;
  // Editor
  editorTheme: 'vs-dark' | 'light';
  fontSize: number;
  tabSize: 2 | 4;
  // Collaboration
  showCursors: boolean;
  liveSync: boolean;
}
