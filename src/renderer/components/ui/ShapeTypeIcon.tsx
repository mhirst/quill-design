import { Frame, Square, Circle, Type, Pencil, Group } from 'lucide-react';
import type { Shape } from '../../lib/shapes';

/**
 * Consistent shape-type icon used across panels.
 * Renders a lucide-react icon based on shape type (or group flag).
 */
export function ShapeTypeIcon({
  shape,
  type,
  size = 12,
}: {
  shape?: Shape;
  type?: Shape['type'] | string;
  size?: number;
}) {
  if (shape?.isGroup) return <Group size={size} />;
  const t = (type ?? shape?.type) as string | undefined;
  switch (t) {
    case 'frame': return <Frame size={size} />;
    case 'rectangle': return <Square size={size} />;
    case 'ellipse': return <Circle size={size} />;
    case 'text': return <Type size={size} />;
    case 'path': return <Pencil size={size} />;
    default: return <Square size={size} />;
  }
}
