export const IPC = {
  // File operations
  FILE_OPEN_DIALOG: 'file:open-dialog',
  FILE_SAVE_DIALOG: 'file:save-dialog',
  FILE_READ: 'file:read',
  FILE_WRITE: 'file:write',
  FILE_WATCH_START: 'file:watch-start',
  FILE_WATCH_STOP: 'file:watch-stop',
  FILE_CHANGED: 'file:changed',

  // Claude streaming
  CLAUDE_STREAM_START: 'claude:stream-start',
  CLAUDE_STREAM_CHUNK: 'claude:stream-chunk',
  CLAUDE_STREAM_END: 'claude:stream-end',
  CLAUDE_STREAM_ERROR: 'claude:stream-error',
  CLAUDE_STREAM_ABORT: 'claude:stream-abort',

  // App
  APP_GET_VERSION: 'app:get-version',
} as const;

export type IpcChannel = (typeof IPC)[keyof typeof IPC];
