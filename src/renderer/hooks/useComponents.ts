/**
 * useComponents — manages the reusable component library for a project.
 *
 * Components are named, reusable shape trees. A "master" is the canonical
 * source; "instances" are copies that share a componentId. When the master
 * changes, all instances on the canvas are updated to match (geometry + style
 * only — position, name, and id are preserved per-instance).
 *
 * Propagation is intentionally lightweight for Phase 2:
 *   - Only the root group's children shapes are propagated (no deep nesting)
 *   - Instance x/y/width/height are NOT changed (instances are independent in
 *     position/size but share fill, stroke, text content, etc.)
 *
 * The hook is intended to be instantiated once in ProjectWorkspace and passed
 * down via props.
 */

import { useCallback } from 'react';
import { v4 as uuid } from 'uuid';
import type { Shape, ComponentDef } from '../lib/shapes';
import { shapesToCanvas } from '../lib/shapes';

interface Options {
  projectId: string;
  components: ComponentDef[];
  onSave: (projectId: string, components: ComponentDef[]) => void;
}

export function useComponents({ projectId, components, onSave }: Options) {

  // ── Save a group (or any shape tree) as a new named component ────────────

  const saveAsComponent = useCallback((
    name: string,
    groupShape: Shape,  // the root group shape
    allShapes: Shape[], // all canvas shapes (to find children)
  ): ComponentDef => {
    // Collect the group and all its descendants
    const collect = (rootId: string): Shape[] => {
      const root = allShapes.find(s => s.id === rootId);
      if (!root) return [];
      const children = allShapes.filter(s => s.parentId === rootId).flatMap(c => collect(c.id));
      return [root, ...children];
    };
    const tree = collect(groupShape.id);

    // Generate thumbnail
    let thumbnail: string | undefined;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 160;
      canvas.height = 120;
      shapesToCanvas(tree, canvas);
      thumbnail = canvas.toDataURL('image/png');
    } catch { /* non-critical */ }

    const def: ComponentDef = {
      id: uuid(),
      name,
      shapes: tree.map(s => ({ ...s })), // deep copy
      thumbnail,
      createdAt: Date.now(),
    };

    const next = [...components, def];
    onSave(projectId, next);
    return def;
  }, [components, projectId, onSave]);

  // ── Create an instance of a component at (x, y) ──────────────────────────

  const insertInstance = useCallback((
    componentId: string,
    x: number,
    y: number,
  ): Shape[] => {
    const def = components.find(c => c.id === componentId);
    if (!def || def.shapes.length === 0) return [];

    // Clone the shape tree with fresh IDs, offset to (x, y)
    const idMap = new Map<string, string>(); // old id → new id

    // First pass: assign new IDs
    for (const s of def.shapes) {
      idMap.set(s.id, uuid());
    }

    const root = def.shapes.find(s => !s.parentId || !def.shapes.some(p => p.id === s.parentId));
    const offsetX = root ? x - root.x : 0;
    const offsetY = root ? y - root.y : 0;

    const cloned: Shape[] = def.shapes.map(s => ({
      ...s,
      id: idMap.get(s.id)!,
      parentId: s.parentId ? idMap.get(s.parentId) : undefined,
      children: s.children.map(cid => idMap.get(cid) ?? cid),
      x: s.x + offsetX,
      y: s.y + offsetY,
      componentId,
      isMasterComponent: false,
    }));

    return cloned;
  }, [components]);

  // ── Propagate master changes to all instances ─────────────────────────────

  /**
   * Call after a master component shape is updated.
   * Returns the updated shape list with instance children patched.
   * Only propagates style/content — not position/size of the root instance.
   */
  const propagateToInstances = useCallback((
    changedComponentId: string,
    masterShapes: Shape[],  // current master's shape tree (already updated)
    allShapes: Shape[],     // all canvas shapes
  ): Shape[] => {
    const def = components.find(c => c.id === changedComponentId);
    if (!def) return allShapes;

    // Find the master group in masterShapes
    const masterRoot = masterShapes.find(s => s.componentId === changedComponentId && s.isMasterComponent);
    if (!masterRoot) return allShapes;

    // Build a map: relative-position-in-tree → style/content patch from master
    // We match children by their position index within the group (fragile for reordering
    // but fine for Phase 2)
    const masterChildren = masterShapes
      .filter(s => s.parentId === masterRoot.id)
      .sort((a, b) => a.x - b.x || a.y - b.y);

    // Fields to propagate (style + content, not geometry or identity)
    const PROPAGATED_FIELDS: (keyof Shape)[] = [
      'fill', 'fillOpacity', 'fillType', 'gradientStops', 'gradientAngle',
      'stroke', 'strokeWidth', 'strokeDash',
      'borderRadius', 'opacity', 'shadow', 'shadowX', 'shadowY', 'shadowBlur', 'shadowColor',
      'text', 'fontSize', 'fontFamily', 'fontWeight', 'fontStyle',
      'textAlign', 'textDecoration', 'lineHeight', 'letterSpacing', 'color',
    ];

    // For each non-master instance root, patch its children
    return allShapes.map(s => {
      if (s.componentId !== changedComponentId || s.isMasterComponent) return s;
      // s is an instance root — find its children by order and patch them
      const instanceChildren = allShapes
        .filter(c => c.parentId === s.id)
        .sort((a, b) => a.x - b.x || a.y - b.y);

      // Patch instance children style from master children by index
      instanceChildren.forEach((ic, idx) => {
        const mc = masterChildren[idx];
        if (!mc) return;
        const patch: Partial<Shape> = {};
        for (const field of PROPAGATED_FIELDS) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (patch as any)[field] = (mc as any)[field];
        }
        Object.assign(ic, patch);
      });

      return s; // root instance position unchanged
    });
  }, [components]);

  // ── Delete a component definition ─────────────────────────────────────────

  const deleteComponent = useCallback((componentId: string) => {
    const next = components.filter(c => c.id !== componentId);
    onSave(projectId, next);
  }, [components, projectId, onSave]);

  // ── Rename a component ────────────────────────────────────────────────────

  const renameComponent = useCallback((componentId: string, name: string) => {
    const next = components.map(c => c.id === componentId ? { ...c, name } : c);
    onSave(projectId, next);
  }, [components, projectId, onSave]);

  return {
    components,
    saveAsComponent,
    insertInstance,
    propagateToInstances,
    deleteComponent,
    renameComponent,
  };
}
