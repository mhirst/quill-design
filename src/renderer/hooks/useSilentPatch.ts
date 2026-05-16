import { useCallback, useRef, useState } from 'react';
import type { ElementSelection } from '@shared/types';

interface UseSilentPatchOptions {
  getCurrentJsx: () => string;
  getFilePath: () => string | null;
  onJsxReady: (jsx: string) => void;
  onOptimisticPatch?: (descriptor: string, newClasses: string) => void;
}

export function useSilentPatch({
  getCurrentJsx,
  getFilePath,
  onJsxReady,
  onOptimisticPatch,
}: UseSilentPatchOptions) {
  const [isPatching, setIsPatching] = useState(false);
  const pendingRef = useRef<AbortController | null>(null);

  const patch = useCallback(
    async (selection: ElementSelection, newClasses: string) => {
      const currentJsx = getCurrentJsx();
      if (!currentJsx) return;

      // Optimistic update in iframe
      if (onOptimisticPatch) {
        onOptimisticPatch(selection.descriptor, newClasses);
      }

      // Cancel any pending patch
      if (pendingRef.current) {
        pendingRef.current.abort();
      }
      const controller = new AbortController();
      pendingRef.current = controller;

      setIsPatching(true);
      try {
        const result = await window.api.claudeSilentPatch({
          currentJsx,
          descriptor: selection.descriptor,
          originalClasses: selection.className,
          newClasses,
          filePath: getFilePath(),
        });

        if (controller.signal.aborted) return;
        if (result.finalJsx) {
          onJsxReady(result.finalJsx);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsPatching(false);
          pendingRef.current = null;
        }
      }
    },
    [getCurrentJsx, getFilePath, onJsxReady, onOptimisticPatch]
  );

  return { patch, isPatching };
}
