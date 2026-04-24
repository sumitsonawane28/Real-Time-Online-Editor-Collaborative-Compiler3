const { execFile, spawn } = require('child_process');
const fs   = require('fs');
const path = require('path');
const os   = require('os');

const TIMEOUT_MS = 15000;

const IS_WIN = process.platform === 'win32';
const GCC    = IS_WIN ? 'C:\\mingw\\mingw64\\bin\\gcc.exe' : 'gcc';
const GPP    = IS_WIN ? 'C:\\mingw\\mingw64\\bin\\g++.exe' : 'g++';
const PYTHON = IS_WIN ? 'python' : 'python3';
const NODE   = process.execPath;

// ── Helpers ───────────────────────────────────────────────────────────────────
function tmpFile(ext) {
  return path.join(os.tmpdir(), `nexus_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
}

/** Buffered run — returns { stdout, stderr, code, killed } */
function runBuffered(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: TIMEOUT_MS, ...opts }, (err, stdout, stderr) => {
      resolve({
        stdout: stdout || '',
        stderr: stderr || '',
        code:   err?.code ?? 0,
        killed: err?.killed ?? false,
      });
    });
  });
}

/**
 * Streaming run — calls onLine(text, isError) for every line of output
 * as it arrives from the child process.
 * Returns a promise that resolves when the process exits.
 */
function runStreaming(cmd, args, onLine, opts = {}) {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, {
      timeout: TIMEOUT_MS,
      windowsHide: true,
      ...opts,
    });

    let stdoutBuf = '';
    let stderrBuf = '';
    let timedOut  = false;

    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill('SIGKILL');
    }, TIMEOUT_MS);

    // Emit stdout lines as they arrive
    proc.stdout.on('data', (chunk) => {
      stdoutBuf += chunk.toString();
      const lines = stdoutBuf.split('\n');
      stdoutBuf = lines.pop(); // keep incomplete last line
      lines.forEach((line) => onLine(line, false));
    });

    // Emit stderr lines as they arrive
    proc.stderr.on('data', (chunk) => {
      stderrBuf += chunk.toString();
      const lines = stderrBuf.split('\n');
      stderrBuf = lines.pop();
      lines.forEach((line) => onLine(line, true));
    });

    proc.on('close', (code) => {
      clearTimeout(timer);
      // Flush remaining buffers
      if (stdoutBuf) onLine(stdoutBuf, false);
      if (stderrBuf) onLine(stderrBuf, true);
      if (timedOut)  onLine('⏱ Execution timed out (15s limit)', true);
      resolve({ code: code ?? 1, timedOut });
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      onLine(`Process error: ${err.message}`, true);
      resolve({ code: 1, timedOut: false });
    });
  });
}

// ── Buffered runners (used by HTTP /api/run) ──────────────────────────────────

async function runC(code) {
  const src = tmpFile('.c');
  const exe = tmpFile(IS_WIN ? '.exe' : '');
  fs.writeFileSync(src, code, 'utf8');
  try {
    const compile = await runBuffered(GCC, [src, '-o', exe, '-Wall', '-lm']);
    if (compile.stderr && compile.code !== 0) return { output: '', error: compile.stderr };
    const result = await runBuffered(exe, []);
    return { output: result.stdout, error: result.stderr || (result.killed ? 'Execution timed out' : '') };
  } finally {
    try { fs.unlinkSync(src); } catch {}
    try { fs.unlinkSync(exe); } catch {}
  }
}

async function runCpp(code) {
  const src = tmpFile('.cpp');
  const exe = tmpFile(IS_WIN ? '.exe' : '');
  fs.writeFileSync(src, code, 'utf8');
  try {
    const compile = await runBuffered(GPP, [src, '-o', exe, '-Wall', '-lm', '-std=c++17']);
    if (compile.stderr && compile.code !== 0) return { output: '', error: compile.stderr };
    const result = await runBuffered(exe, []);
    return { output: result.stdout, error: result.stderr || (result.killed ? 'Execution timed out' : '') };
  } finally {
    try { fs.unlinkSync(src); } catch {}
    try { fs.unlinkSync(exe); } catch {}
  }
}

async function runPython(code) {
  const src = tmpFile('.py');
  fs.writeFileSync(src, code, 'utf8');
  try {
    const result = await runBuffered(PYTHON, [src]);
    return { output: result.stdout, error: result.stderr || (result.killed ? 'Execution timed out' : '') };
  } finally { try { fs.unlinkSync(src); } catch {} }
}

async function runJavaScript(code) {
  const src = tmpFile('.js');
  fs.writeFileSync(src, code, 'utf8');
  try {
    const result = await runBuffered(NODE, [src]);
    return { output: result.stdout, error: result.stderr || (result.killed ? 'Execution timed out' : '') };
  } finally { try { fs.unlinkSync(src); } catch {} }
}

async function runJava(code) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus_java_'));
  const src = path.join(dir, 'Main.java');
  fs.writeFileSync(src, code, 'utf8');
  try {
    const compile = await runBuffered('javac', [src]);
    if (compile.stderr && compile.code !== 0) return { output: '', error: compile.stderr };
    const result = await runBuffered('java', ['-cp', dir, 'Main']);
    return { output: result.stdout, error: result.stderr || (result.killed ? 'Execution timed out' : '') };
  } finally { try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} }
}

// ── Streaming runners (used by Socket.IO run-code event) ─────────────────────

async function streamC(code, onLine) {
  const src = tmpFile('.c');
  const exe = tmpFile(IS_WIN ? '.exe' : '');
  fs.writeFileSync(src, code, 'utf8');
  try {
    // Compile step — buffered (fast, no streaming needed)
    const compile = await runBuffered(GCC, [src, '-o', exe, '-Wall', '-lm']);
    if (compile.stderr && compile.code !== 0) {
      // Emit each compiler error line individually
      compile.stderr.split('\n').filter(Boolean).forEach((l) => onLine(l, true));
      return;
    }
    if (compile.stderr) {
      // Warnings — show but continue
      compile.stderr.split('\n').filter(Boolean).forEach((l) => onLine(l, true));
    }
    await runStreaming(exe, [], onLine);
  } finally {
    try { fs.unlinkSync(src); } catch {}
    try { fs.unlinkSync(exe); } catch {}
  }
}

async function streamCpp(code, onLine) {
  const src = tmpFile('.cpp');
  const exe = tmpFile(IS_WIN ? '.exe' : '');
  fs.writeFileSync(src, code, 'utf8');
  try {
    const compile = await runBuffered(GPP, [src, '-o', exe, '-Wall', '-lm', '-std=c++17']);
    if (compile.stderr && compile.code !== 0) {
      compile.stderr.split('\n').filter(Boolean).forEach((l) => onLine(l, true));
      return;
    }
    if (compile.stderr) compile.stderr.split('\n').filter(Boolean).forEach((l) => onLine(l, true));
    await runStreaming(exe, [], onLine);
  } finally {
    try { fs.unlinkSync(src); } catch {}
    try { fs.unlinkSync(exe); } catch {}
  }
}

async function streamPython(code, onLine) {
  const src = tmpFile('.py');
  fs.writeFileSync(src, code, 'utf8');
  try {
    await runStreaming(PYTHON, [src], onLine);
  } finally { try { fs.unlinkSync(src); } catch {} }
}

async function streamJavaScript(code, onLine) {
  const src = tmpFile('.js');
  fs.writeFileSync(src, code, 'utf8');
  try {
    await runStreaming(NODE, [src], onLine);
  } finally { try { fs.unlinkSync(src); } catch {} }
}

async function streamJava(code, onLine) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus_java_'));
  const src = path.join(dir, 'Main.java');
  fs.writeFileSync(src, code, 'utf8');
  try {
    const compile = await runBuffered('javac', [src]);
    if (compile.stderr && compile.code !== 0) {
      compile.stderr.split('\n').filter(Boolean).forEach((l) => onLine(l, true));
      return;
    }
    await runStreaming('java', ['-cp', dir, 'Main'], onLine);
  } finally { try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} }
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Buffered execution — used by HTTP POST /api/run */
exports.executeCode = async (code, language) => {
  if (!code?.trim()) return { output: '', error: 'No code provided.' };
  const lang = (language || '').toLowerCase();
  try {
    switch (lang) {
      case 'c':          return await runC(code);
      case 'cpp':        return await runCpp(code);
      case 'python':     return await runPython(code);
      case 'javascript':
      case 'typescript': return await runJavaScript(code);
      case 'java':       return await runJava(code);
      default:
        return { output: '', error: `Language "${language}" is not supported.\nSupported: C, C++, Python, JavaScript, Java` };
    }
  } catch (err) {
    return { output: '', error: `Runner error: ${err.message}` };
  }
};

/**
 * Streaming execution — used by Socket.IO run-code event.
 * Calls onLine(text, isError) for every output line as it arrives.
 */
exports.executeCodeStreaming = async (code, language, onLine) => {
  if (!code?.trim()) { onLine('No code provided.', true); return; }
  const lang = (language || '').toLowerCase();
  try {
    switch (lang) {
      case 'c':          return await streamC(code, onLine);
      case 'cpp':        return await streamCpp(code, onLine);
      case 'python':     return await streamPython(code, onLine);
      case 'javascript':
      case 'typescript': return await streamJavaScript(code, onLine);
      case 'java':       return await streamJava(code, onLine);
      default:
        onLine(`Language "${language}" is not supported for execution.`, true);
    }
  } catch (err) {
    onLine(`Runner error: ${err.message}`, true);
  }
};
