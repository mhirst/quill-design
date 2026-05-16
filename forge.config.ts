import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { VitePlugin } from '@electron-forge/plugin-vite';

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    name: 'Quill',
    executableName: 'quill',
    appVersion: '1.0.0',
    icon: 'assets/icon',
    extraResource: ['.env', 'assets/icon.png', 'assets/icon.ico'],
    win32metadata: {
      CompanyName: 'Quill',
      FileDescription: 'Design beautiful UIs with AI — powered by Claude.',
      ProductName: 'Quill',
    },
  },
  makers: [
    new MakerSquirrel({
      name: 'quill',
      setupExe: 'QuillSetup.exe',
      setupIcon: 'assets/icon.ico',
      authors: 'Quill',
      description: 'Design beautiful UIs with AI — powered by Claude.',
      noMsi: true,
    }),
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
