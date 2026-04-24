// Set VITE_BACKEND_URL in .env.local (dev) or Vercel env vars (prod).
// Example: VITE_BACKEND_URL=https://nexuscode-backend.onrender.com
const BASE = `${import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'}/api`;

function authHeaders(token?: string) {
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function req<T>(method: string, path: string, body?: unknown, token?: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: authHeaders(token),
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data as T;
}

export const api = {
  signup: (username: string, email: string, password: string) =>
    req<{ token: string; user: { id: string; username: string; email: string } }>(
      'POST', '/auth/signup', { username, email, password }
    ),

  login: (email: string, password: string) =>
    req<{ token: string; user: { id: string; username: string; email: string } }>(
      'POST', '/auth/login', { email, password }
    ),

  getRooms: (token: string) =>
    req<any[]>('GET', '/room', undefined, token),

  createRoom: (name: string, language: string, token: string) =>
    req<any>('POST', '/room', { name, language }, token),

  getRoom: (roomId: string) =>
    req<any>('GET', `/room/${roomId}`),

  runCode: (code: string, language: string) =>
    req<{ output: string; error: string }>('POST', '/run', { code, language }),

  getMessages: (roomId: string) =>
    req<any[]>('GET', `/chat/${roomId}`),

  saveFile: (fileName: string, code: string, token: string) =>
    req<any>('POST', '/file', { fileName, code }, token),

  getUserFiles: (token: string) =>
    req<Array<{ _id: string; fileName: string; code: string; createdAt: string }>>(
      'GET', '/files', undefined, token
    ),

  deleteFile: (fileId: string, token: string) =>
    req<any>('DELETE', `/file/${fileId}`, undefined, token),
};
