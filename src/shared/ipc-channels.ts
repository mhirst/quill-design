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

  // Claude silent patch (non-streaming, direct invoke)
  CLAUDE_SILENT_PATCH: 'claude:silent-patch',

  // Project browser
  PROJECT_OPEN_DIALOG: 'project:open-dialog',
  PROJECT_SCAN: 'project:scan',
  PROJECT_WATCH_START: 'project:watch-start',
  PROJECT_WATCH_STOP: 'project:watch-stop',
  PROJECT_FILE_CHANGED: 'project:file-changed',
  PROJECT_GET_RECENTS: 'project:get-recents',
  PROJECT_ADD_RECENT: 'project:add-recent',

  // API key management (legacy — kept for migration)
  API_KEY_GET: 'apikey:get',
  API_KEY_SET: 'apikey:set',
  API_KEY_DELETE: 'apikey:delete',
  API_KEY_VALIDATE: 'apikey:validate',

  // AI provider config
  PROVIDER_GET: 'provider:get',
  PROVIDER_SET: 'provider:set',
  PROVIDER_VALIDATE: 'provider:validate',

  // App
  APP_GET_VERSION: 'app:get-version',

  // Project store (userData persistence)
  STORE_READ: 'store:read',
  STORE_WRITE: 'store:write',
} as const;

export type IpcChannel = (typeof IPC)[keyof typeof IPC];
