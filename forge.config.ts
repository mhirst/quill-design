import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { VitePlugin } from '@electron-forge/plugin-vite';

const isMac = process.platform === 'darwin';
const isWin = process.platform === 'win32';

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    name: 'Quill',
    executableName: 'quill',
    appVersion: '1.0.0',
    icon: 'assets/icon',
    // API keys are stored in the system userData directory via onboarding —
    // never bundle .env or any credentials with the app.
    extraResource: isWin
      ? ['assets/icon.png', 'assets/icon.ico']
      : ['assets/icon.png'],
    ...(isWin ? {
      win32metadata: {
        CompanyName: 'Quill',
        FileDescription: 'Design beautiful UIs with AI — powered by Claude.',
        ProductName: 'Quill',
      },
    } : {}),
  },
  makers: [
    // Windows — Squirrel installer
    ...(isWin ? [new MakerSquirrel({
      name: 'quill',
      setupExe: 'QuillSetup.exe',
      setupIcon: 'assets/icon.ico',
      authors: 'Quill',
      description: 'Design beautiful UIs with AI — powered by Claude.',
      noMsi: true,
    })] : []),
    // macOS — DMG (requires .icns icon, generated in CI)
    ...(isMac ? [new MakerDMG({
      name: 'Quill',
      icon: 'assets/icon.icns',
      overwrite: true,
    })] : []),
    // All platforms — ZIP fallback (used in CI for all targets)
    new MakerZIP({}, ['darwin', 'linux', 'win32']),
  ],
  plugins: [
    new VitePlugin({
      build: [
        {
          entry: 'src/main/index.ts',
          config: 'vite.main.config.ts',
          target: 'main',
        },
        {
          entry: 'src/preload/index.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),
  ],
};

export default config;
