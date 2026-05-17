import React, { useCallback, useEffect, useRef, useState } from 'react';
import { analytics } from './lib/analytics';
import { v4 as uuid } from 'uuid';
import { OnboardingScreen } from './components/onboarding/OnboardingScreen';
import { CanvasPane } from './components/canvas/CanvasPane';
import { CanvasOverlay } from './components/canvas/CanvasOverlay';
import { ChatBar } from './components/chat/ChatBar';
import { ToolSidebar, type Tool } from './components/layout/ToolSidebar';
import { LeftPanel, type LeftTab } from './components/layout/LeftPanel';
import { InspectPanel } from './components/inspect/InspectPanel';
import { ShapeInspectPanel } from './components/inspect/ShapeInspectPanel';
import { useCanvas } from './hooks/useCanvas';
import { useChat } from './hooks/useChat';
import { useFileManager } from './hooks/useFileManager';
import { useProjectBrowser } from './hooks/useProjectBrowser';
import { useSilentPatch } from './hooks/useSilentPatch';
import { useDrawingTools } from './hooks/useDrawingTools';
import { usePages } from './hooks/usePages';
import { useProjectStore } from './hooks/useProjectStore';
import { useAppSettings } from './hooks/useAppSettings';
import { SettingsModal } from './components/settings/SettingsModal';
import { useComponents } from './hooks/useComponents';
import { patchTailwindClass as patchTailwindClassLocal } from './lib/utils';
import { defaultShape, QUICK_SHAPE_DEFS } from './lib/shapes';
import type { Shape } from './lib/shapes';
import { ExportToolbar } from './components/canvas/ExportToolbar';
import { AlignmentBar } from './components/canvas/AlignmentBar';
import { KeyboardShortcutsOverlay } from './components/canvas/KeyboardShortcutsOverlay';
import { CommandPalette, type CommandItem } from './components/canvas/CommandPalette';
import { DesignSystemPanel } from './components/canvas/DesignSystemPanel';
import { CommentPinsOverlay, CommentPinsPanel, type CommentPin } from './components/canvas/CommentPinsOverlay';
import { ColorReplacePanel } from './components/canvas/ColorReplacePanel';
import { CustomFontsPanel, type CustomFont, loadStoredFonts, registerAllStoredFonts } from './components/canvas/CustomFontsPanel';
import { QuickInsertPanel } from './components/canvas/QuickInsertPanel';
import { ColorPalettesPanel } from './components/canvas/ColorPalettesPanel';
import { IconPickerPanel } from './components/canvas/IconPickerPanel';
import { DeviceMockupPanel, type MockupDevice } from './components/canvas/DeviceMockupPanel';
import { DesignLintPanel } from './components/canvas/DesignLintPanel';
import { FindReplacePanel } from './components/canvas/FindReplacePanel';
import { TypeScalePanel } from './components/canvas/TypeScalePanel';
import { ColorHarmonyPanel } from './components/canvas/ColorHarmonyPanel';
import { ThemeCustomizerPanel, loadSavedThemeVars, applyThemeVars } from './components/canvas/ThemeCustomizerPanel';
import { DevSpecPanel } from './components/canvas/DevSpecPanel';
import { SnapshotsPanel } from './components/canvas/SnapshotsPanel';
import { ShapeSpotlight } from './components/canvas/ShapeSpotlight';
import { StickyNotesOverlay, useStickyNotes } from './components/canvas/StickyNotesOverlay';
import { CanvasEmptyState } from './components/canvas/CanvasEmptyState';
import { HistoryBrowserPanel } from './components/canvas/HistoryBrowserPanel';
import { BatchRenamePanel } from './components/canvas/BatchRenamePanel';
import { FrameSorterPanel } from './components/canvas/FrameSorterPanel';
import { CodeExportPanel } from './components/canvas/CodeExportPanel';
import { ColorSchemePanel } from './components/canvas/ColorSchemePanel';
import { GradientMeshPanel } from './components/canvas/GradientMeshPanel';
import { CanvasRulers, type Guide } from './components/canvas/CanvasRulers';
import { GridSystemPanel, GridOverlay, type GridDef } from './components/canvas/GridSystemPanel';
import { AnimationTweenPanel } from './components/canvas/AnimationTweenPanel';
import { StylePresetsPanel } from './components/canvas/StylePresetsPanel';
import { MotionPathPanel } from './components/canvas/MotionPathPanel';
import { ShapeAnnotationsOverlay, AnnotationsListPanel, type Annotation } from './components/canvas/ShapeAnnotationsOverlay';
import { ImageFillPanel } from './components/canvas/ImageFillPanel';
import { ColorGradingPanel } from './components/canvas/ColorGradingPanel';
import { ParticleEffectPanel } from './components/canvas/ParticleEffectPanel';
import { ShadowStudioPanel } from './components/canvas/ShadowStudioPanel';
import { UIBlocksLibrary } from './components/canvas/UIBlocksLibrary';
import { FluidTypePanel } from './components/canvas/FluidTypePanel';
import { ClipPathEditor } from './components/canvas/ClipPathEditor';
import { PresentationMode } from './components/canvas/PresentationMode';
import { AccessibilityPanel } from './components/canvas/AccessibilityPanel';
import { DesignTokensPanel, type DesignToken, type TokenBinding } from './components/canvas/DesignTokensPanel';
import { BatchExportPanel } from './components/canvas/BatchExportPanel';
import { PatternFillPanel } from './components/canvas/PatternFillPanel';
import { MorphBlendPanel } from './components/canvas/MorphBlendPanel';
import { ResponsivePreviewPanel } from './components/canvas/ResponsivePreviewPanel';
import { ThemeEditorPanel } from './components/canvas/ThemeEditorPanel';
import { PlaceholderPanel } from './components/canvas/PlaceholderPanel';
import { Transform3DPanel } from './components/canvas/Transform3DPanel';
import { NoiseTexturePanel } from './components/canvas/NoiseTexturePanel';
import { VariableFontPanel } from './components/canvas/VariableFontPanel';
import { VariantsPanel } from './components/canvas/VariantsPanel';
import { DesignIntelPanel } from './components/canvas/DesignIntelPanel';
import { GenerativeArtPanel } from './components/canvas/GenerativeArtPanel';
import { CanvasStatusBar } from './components/canvas/CanvasStatusBar';
import { PrototypePanel, FlowArrowsOverlay, PrototypeHotspots, type Interaction } from './components/canvas/PrototypePanel';
import { ContentFillPanel } from './components/canvas/ContentFillPanel';
import { MinimapNavigator } from './components/canvas/MinimapNavigator';
import { RedlineOverlay } from './components/canvas/RedlineOverlay';
import { QuickActionsBar } from './components/canvas/QuickActionsBar';
import { ColorBlindPanel } from './components/canvas/ColorBlindPanel';
import { TextStylesPanel, type TextStyle } from './components/canvas/TextStylesPanel';
import { PaletteExtractorPanel } from './components/canvas/PaletteExtractorPanel';
import { TemplateGallery } from './components/canvas/TemplateGallery';
import { AutoLayoutPanel } from './components/canvas/AutoLayoutPanel';
import { LayerEffectsPanel } from './components/canvas/LayerEffectsPanel';
import { SmartSpacingAdvisor } from './components/canvas/SmartSpacingAdvisor';
import { AIQuickSuggestionsPanel } from './components/canvas/AIQuickSuggestionsPanel';
import { FocusMode } from './components/canvas/FocusMode';
import { CursorPresence, CursorPresencePanel } from './components/canvas/CursorPresence';
import { GradientEditorPanel } from './components/canvas/GradientEditorPanel';
import { KeyframeTimeline } from './components/canvas/KeyframeTimeline';
import { ColorContrastPanel } from './components/canvas/ColorContrastPanel';
import { LayoutInspectorOverlay } from './components/canvas/LayoutInspectorOverlay';
import { AssetLibraryPanel, type Asset as LibraryAsset } from './components/canvas/AssetLibraryPanel';
import { SmartRenamePanel } from './components/canvas/SmartRenamePanel';
import { CanvasComparePanel } from './components/canvas/CanvasComparePanel';
import { MotionPreviewPanel } from './components/canvas/MotionPreviewPanel';
import { MoodboardPanel, type MoodTheme } from './components/canvas/MoodboardPanel';
import { TypographySpecimenPanel } from './components/canvas/TypographySpecimenPanel';
import { BreakpointRulerOverlay } from './components/canvas/BreakpointRulerOverlay';
import { MicroInteractionPanel } from './components/canvas/MicroInteractionPanel';
import { GridDuplicatorPanel, type ShapePatch } from './components/canvas/GridDuplicatorPanel';
import { ConsistencyAuditorPanel } from './components/canvas/ConsistencyAuditorPanel';
import { PerspectiveGridOverlay } from './components/canvas/PerspectiveGridOverlay';
import { CSSSnippetPanel } from './components/canvas/CSSSnippetPanel';
import { SpacingHeatmapOverlay } from './components/canvas/SpacingHeatmapOverlay';
import { DesignDiffPanel } from './components/canvas/DesignDiffPanel';
import { ShapeVariationsPanel, type ShapePatch as VariationPatch } from './components/canvas/ShapeVariationsPanel';
import { GlobalSearchPanel } from './components/canvas/GlobalSearchPanel';
import { ColorVisionOverlay } from './components/canvas/ColorVisionOverlay';
import { PathInspectorPanel } from './components/canvas/PathInspectorPanel';
import { FontPairingPanel } from './components/canvas/FontPairingPanel';
import { EasingCurvePanel } from './components/canvas/EasingCurvePanel';
import { ChevronRight, Plus, X } from 'lucide-react';
import type { ChatMessage } from '@shared/types';

export default function App() {
  const [providerReady, setProviderReady] = useState<boolean | null>(null);

  useEffect(() => {
    const api = (window as unknown as Record<string, unknown>).api as typeof window.api | undefined;
    if (!api) { setProviderReady(true); return; }
    // Check new provider config first, fall back to legacy key check
    const check = api.getProviderConfig
      ? api.getProviderConfig().then(({ hasConfig }) => hasConfig)
      : api.getApiKey().then(({ hasKey }) => hasKey);
    check.then(setProviderReady).catch(() => setProviderReady(true));
  }, []);

  if (providerReady === null) return null;
  if (!providerReady) return <OnboardingScreen onComplete={() => setProviderReady(true)} />;
  return <AppShell />;
}

// ─────────────────────────────────────────────────────────────────────────────
// AppShell — wraps project store and renders the tab bar + active project
// ─────────────────────────────────────────────────────────────────────────────

function AppShell() {
  const store = useProjectStore();
  const [showSettings, setShowSettings] = useState(false);

  // ⌘, opens settings
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault();
        setShowSettings(s => !s);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  if (store.loading) {
    return (
      <div style={{ height: '100%', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: 'var(--subtle)', fontSize: 14 }}>Loading…</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col" style={{ height: '100%', background: 'var(--bg)' }}>
      {/* Project tab bar + title */}
      <ProjectTabBar store={store} onOpenSettings={() => setShowSettings(true)} />

      {/* Active project workspace */}
      {store.activeProject && (
        <ProjectWorkspace
          key={store.activeProject.id}
          projectId={store.activeProject.id}
          initialProject={store.activeProject}
          onSave={store.saveProjectState}
          onRename={store.renameProject}
          onSaveComponents={store.saveComponents}
        />
      )}

      {/* Settings modal — rendered at AppShell level so it's always accessible */}
      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ProjectTabBar
// ─────────────────────────────────────────────────────────────────────────────

function ProjectTabBar({ store, onOpenSettings }: { store: ReturnType<typeof useProjectStore>; onOpenSettings?: () => void }) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState('');

  const startRename = (id: string, name: string) => {
    setRenamingId(id);
    setRenameVal(name);
  };

  const commitRename = (id: string) => {
    if (renameVal.trim()) store.renameProject(id, renameVal.trim());
    setRenamingId(null);
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'stretch',
      height: 38,
      background: 'var(--panel)',
      borderBottom: '1px solid var(--border)',
      flexShrink: 0,
      paddingLeft: 8,
      gap: 0,
      // macOS inset traffic lights — leave space
      paddingTop: 0,
      WebkitAppRegion: 'drag',
    } as React.CSSProperties}>
      {/* App name */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        paddingRight: 16,
        paddingLeft: 8,
        fontSize: 13,
        fontWeight: 700,
        color: 'var(--accent)',
        letterSpacing: '-0.01em',
        flexShrink: 0,
        WebkitAppRegion: 'drag',
      } as React.CSSProperties}>
        Quill
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        alignItems: 'stretch',
        flex: 1,
        overflow: 'hidden',
        gap: 2,
        WebkitAppRegion: 'no-drag',
      } as React.CSSProperties}>
        {store.projects.map(p => {
          const isActive = p.id === store.activeProjectId;
          return (
            <div
              key={p.id}
              onClick={() => store.switchProject(p.id)}
              onDoubleClick={() => startRename(p.id, p.name)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                paddingLeft: 12,
                paddingRight: 6,
                minWidth: 100,
                maxWidth: 200,
                cursor: 'pointer',
                borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                background: isActive ? 'rgba(99,102,241,0.06)' : 'transparent',
                flexShrink: 0,
                userSelect: 'none',
              }}
            >
              {renamingId === p.id ? (
                <input
                  autoFocus
                  value={renameVal}
                  onChange={e => setRenameVal(e.target.value)}
                  onBlur={() => commitRename(p.id)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') commitRename(p.id);
                    if (e.key === 'Escape') setRenamingId(null);
                    e.stopPropagation();
                  }}
                  onClick={e => e.stopPropagation()}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    outline: '1px solid var(--accent)',
                    color: 'var(--text)',
                    fontSize: 12,
                    width: '100%',
                    borderRadius: 3,
                    padding: '1px 4px',
                  }}
                />
              ) : (
                <span style={{
                  fontSize: 12,
                  color: isActive ? 'var(--text)' : 'var(--muted)',
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {p.name}
                </span>
              )}
              {store.projects.length > 1 && (
                <button
                  onClick={e => { e.stopPropagation(); store.deleteProject(p.id); }}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--muted)', padding: '2px', borderRadius: 3,
                    display: 'flex', alignItems: 'center', flexShrink: 0,
                    opacity: isActive ? 1 : 0,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = 'var(--error)'; }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = isActive ? '1' : '0'; e.currentTarget.style.color = 'var(--muted)'; }}
                >
                  <X size={10} />
                </button>
              )}
            </div>
          );
        })}

        {/* New project button */}
        <button
          onClick={() => store.createProject()}
          title="New project"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 32, background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--muted)', flexShrink: 0,
          }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Settings gear — right side, no-drag zone */}
      {onOpenSettings && (
        <button
          onClick={onOpenSettings}
          title="Settings (⌘,)"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 34, height: '100%',
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--subtle)', flexShrink: 0,
            WebkitAppRegion: 'no-drag',
            transition: 'color 0.12s',
          } as React.CSSProperties}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--muted)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--subtle)')}
        >
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
            <path d="M7.5 9.5a2 2 0 100-4 2 2 0 000 4z" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M12.5 7.5l.9-.5a5.8 5.8 0 00-.6-1.4l-1 .1a4.7 4.7 0 00-.8-.8l.1-1a5.8 5.8 0 00-1.4-.6l-.5.9a4.7 4.7 0 00-1.1 0l-.5-.9a5.8 5.8 0 00-1.4.6l.1 1a4.7 4.7 0 00-.8.8l-1-.1a5.8 5.8 0 00-.6 1.4l.9.5a4.7 4.7 0 000 1.1l-.9.5a5.8 5.8 0 00.6 1.4l1-.1c.2.3.5.6.8.8l-.1 1a5.8 5.8 0 001.4.6l.5-.9a4.7 4.7 0 001.1 0l.5.9a5.8 5.8 0 001.4-.6l-.1-1a4.7 4.7 0 00.8-.8l1 .1a5.8 5.8 0 00.6-1.4l-.9-.5a4.7 4.7 0 000-1.1z" stroke="currentColor" strokeWidth="1.3"/>
          </svg>
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ProjectWorkspace — one full editor for a single project
// ─────────────────────────────────────────────────────────────────────────────

interface WorkspaceProps {
  projectId: string;
  initialProject: import('./hooks/useProjectStore').ProjectData;
  onSave: (
    projectId: string,
    pages: import('./hooks/usePages').Page[],
    activePageId: string,
    chatHistory: ChatMessage[],
  ) => void;
  onRename: (projectId: string, name: string) => void;
  onSaveComponents: (projectId: string, components: import('./lib/shapes').ComponentDef[]) => void;
}

function ProjectWorkspace({ projectId, initialProject, onSave, onRename, onSaveComponents }: WorkspaceProps) {
  const canvas = useCanvas();
  const fileManager = useFileManager();
  const { settings: appSettings, update: updateAppSettings } = useAppSettings();
  const [activeTool, setActiveTool] = useState<Tool>('cursor');

  // Track app opened once per workspace mount
  useEffect(() => { analytics.track('app_opened'); }, []);
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);

  // Left panel state
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [leftTab, setLeftTab] = useState<LeftTab>('layers');

  // Chat bar — collapse signal: incrementing this tells ChatBar to collapse
  const [chatCollapseSignal, setChatCollapseSignal] = useState(0);

  // Right panel collapse
  const [rightCollapsed, setRightCollapsed] = useState(false);

  // Keyboard shortcuts overlay
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Design system panel (Ctrl+Shift+D)
  const [showDesignSystem, setShowDesignSystem] = useState(false);

  // Color replace panel
  const [showColorReplace, setShowColorReplace] = useState(false);

  // Quick Insert panel (I key)
  const [showQuickInsert, setShowQuickInsert] = useState(false);
  const [showColorPalettes, setShowColorPalettes] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [showDeviceMockup, setShowDeviceMockup] = useState(false);
  const [showDesignLint, setShowDesignLint] = useState(false);
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [showTypeScale, setShowTypeScale] = useState(false);
  const [showColorHarmony, setShowColorHarmony] = useState(false);
  const [showThemeCustomizer, setShowThemeCustomizer] = useState(false);
  const [showDevSpec, setShowDevSpec] = useState(false);
  const [showSnapshots, setShowSnapshots] = useState(false);
  const [showSpotlight, setShowSpotlight] = useState(false);
  const [showHistoryBrowser, setShowHistoryBrowser] = useState(false);
  const [showBatchRename, setShowBatchRename] = useState(false);
  const [showFrameSorter, setShowFrameSorter] = useState(false);
  const [showCodeExport, setShowCodeExport] = useState(false);
  const [showColorScheme, setShowColorScheme] = useState(false);
  const [showGradientMesh, setShowGradientMesh] = useState(false);
  const [showAnimationTween, setShowAnimationTween] = useState(false);
  const [showStylePresets, setShowStylePresets] = useState(false);
  const [showMotionPath, setShowMotionPath] = useState(false);
  const [annotationsActive, setAnnotationsActive] = useState(false);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [showImageFill, setShowImageFill] = useState(false);
  const [showColorGrading, setShowColorGrading] = useState(false);
  const [showParticles, setShowParticles] = useState(false);
  const [showShadowStudio, setShowShadowStudio] = useState(false);
  const [showUIBlocks, setShowUIBlocks] = useState(false);
  const [showFluidType, setShowFluidType] = useState(false);
  const [showClipPath, setShowClipPath] = useState(false);
  const [showPresentation, setShowPresentation] = useState(false);
  const [presentationStartId, setPresentationStartId] = useState<string | null>(null);
  const [showAccessibility, setShowAccessibility] = useState(false);
  const [showDesignTokens, setShowDesignTokens] = useState(false);
  const [showBatchExport, setShowBatchExport] = useState(false);
  const [showPatternFill, setShowPatternFill] = useState(false);
  const [showMorphBlend, setShowMorphBlend] = useState(false);
  const [showResponsivePreview, setShowResponsivePreview] = useState(false);
  const [showThemeEditor, setShowThemeEditor] = useState(false);
  const [showPlaceholder, setShowPlaceholder] = useState(false);
  const [show3DTransform, setShow3DTransform] = useState(false);
  const [showNoiseTexture, setShowNoiseTexture] = useState(false);
  const [showVariableFont, setShowVariableFont] = useState(false);
  const [showVariants, setShowVariants] = useState(false);
  const [showDesignIntel, setShowDesignIntel] = useState(false);
  const [showGenerativeArt, setShowGenerativeArt] = useState(false);
  const [showGridSystem, setShowGridSystem] = useState(false);
  const [layoutGrids, setLayoutGrids] = useState<GridDef[]>([]);
  const [showPrototype, setShowPrototype] = useState(false);
  const [protoInteractions, setProtoInteractions] = useState<Interaction[]>([]);
  const [protoConnectingFrom, setProtoConnectingFrom] = useState<string | null>(null);
  const [protoCanvasCursor, setProtoCanvasCursor] = useState<{ x: number; y: number } | null>(null);
  const [showContentFill, setShowContentFill] = useState(false);
  const [showMinimap, setShowMinimap] = useState(true);
  const [showRedlines, setShowRedlines] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(true);
  const [copiedStyle, setCopiedStyle] = useState<Partial<Shape> | null>(null);
  const [showColorBlind, setShowColorBlind] = useState(false);
  const [colorBlindFilter, setColorBlindFilter] = useState('');
  const [showTextStyles, setShowTextStyles] = useState(false);
  const [textStyles, setTextStyles] = useState<TextStyle[]>([]);
  const [showPaletteExtractor, setShowPaletteExtractor] = useState(false);
  const [showTemplateGallery, setShowTemplateGallery] = useState(false);
  const [showAutoLayout, setShowAutoLayout] = useState(false);
  const [showLayerEffects, setShowLayerEffects] = useState(false);
  const [showSpacingAdvisor, setShowSpacingAdvisor] = useState(false);
  const [showAIQuickStyles, setShowAIQuickStyles] = useState(false);
  const [focusModeActive, setFocusModeActive] = useState(false);
  const [showCursorPresence, setShowCursorPresence] = useState(false);
  const [showPresencePanel, setShowPresencePanel] = useState(false);
  const [showGradientEditor, setShowGradientEditor] = useState(false);
  const [showKeyframeTimeline, setShowKeyframeTimeline] = useState(false);
  const [showColorContrast, setShowColorContrast] = useState(false);
  const [showLayoutInspector, setShowLayoutInspector] = useState(false);
  const [showAssetLibrary, setShowAssetLibrary] = useState(false);
  const [showSmartRename, setShowSmartRename] = useState(false);
  const [showCanvasCompare, setShowCanvasCompare] = useState(false);
  const [showMotionPreview, setShowMotionPreview] = useState(false);
  const [showMoodboard, setShowMoodboard] = useState(false);
  const [showTypographySpecimen, setShowTypographySpecimen] = useState(false);
  const [showBreakpointRuler, setShowBreakpointRuler] = useState(false);
  const [showMicroInteraction, setShowMicroInteraction] = useState(false);
  const [showGridDuplicator, setShowGridDuplicator] = useState(false);
  const [showConsistencyAudit, setShowConsistencyAudit] = useState(false);
  const [showPerspectiveGrid, setShowPerspectiveGrid] = useState(false);
  const [showCSSSnippet, setShowCSSSnippet] = useState(false);
  const [showSpacingHeatmap, setShowSpacingHeatmap] = useState(false);
  const [showDesignDiff, setShowDesignDiff] = useState(false);
  const [showShapeVariations, setShowShapeVariations] = useState(false);
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [showColorVision, setShowColorVision] = useState(false);
  const [showPathInspector, setShowPathInspector] = useState(false);
  const [showFontPairing, setShowFontPairing] = useState(false);
  const [showEasingCurve, setShowEasingCurve] = useState(false);
  const [designTokens, setDesignTokens] = useState<DesignToken[]>([]);
  const [tokenBindings, setTokenBindings] = useState<TokenBinding[]>([]);
  // Canvas rulers + guides
  const [showRulers, setShowRulers] = useState(false);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [viewport, setViewport] = useState({ zoom: 1, panX: 0, panY: 0 });
  const [canvasCursorScreen, setCanvasCursorScreen] = useState({ x: 0, y: 0 });
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = canvasContainerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(() => setCanvasSize({ width: el.clientWidth, height: el.clientHeight }));
    obs.observe(el);
    setCanvasSize({ width: el.clientWidth, height: el.clientHeight });
    return () => obs.disconnect();
  }, []);
  const { placingMode: stickyNotesPlacing, startPlacing: startStickyNote, stopPlacing: stopStickyNote } = useStickyNotes();

  // Custom fonts
  const [showCustomFonts, setShowCustomFonts] = useState(false);
  const [customFonts, setCustomFonts] = useState<CustomFont[]>(() => loadStoredFonts());
  // Register stored fonts on mount
  useEffect(() => { registerAllStoredFonts(); }, []);
  // Apply saved theme customizations on mount
  useEffect(() => {
    const isDark = !document.documentElement.hasAttribute('data-theme');
    const saved = loadSavedThemeVars(isDark);
    if (Object.keys(saved).length > 0) applyThemeVars(saved);
  }, []);

  // Comment pins
  const [commentPins, setCommentPins] = useState<CommentPin[]>([]);
  const [commentMode, setCommentMode] = useState(false);
  const commentPinColorCycle = useRef(0);
  const PIN_COLORS_CYCLE = ['#f59e0b', '#ef4444', '#8b5cf6', '#10b981', '#3b82f6'];

  const addCommentPin = useCallback((x: number, y: number) => {
    const color = PIN_COLORS_CYCLE[commentPinColorCycle.current % PIN_COLORS_CYCLE.length];
    commentPinColorCycle.current++;
    const pin: CommentPin = {
      id: uuid(),
      x, y,
      text: '',
      author: 'You',
      color,
      resolved: false,
      createdAt: Date.now(),
      replies: [],
    };
    setCommentPins(ps => [...ps, pin]);
    setCommentMode(false); // exit after placing
  }, []);

  const updateCommentPin = useCallback((id: string, patch: Partial<CommentPin>) => {
    setCommentPins(ps => ps.map(p => p.id === id ? { ...p, ...patch } : p));
  }, []);

  const deleteCommentPin = useCallback((id: string) => {
    setCommentPins(ps => ps.filter(p => p.id !== id));
  }, []);

  // Presentation / focus mode — hides all panels except the canvas
  const [presentationMode, setPresentationMode] = useState(false);

  // Command palette (Cmd+K)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // Track whether the iframe content came from Claude
  const [hasClaudeContent, setHasClaudeContent] = useState(false);

  // ── Toast notifications ────────────────────────────────────────────────────
  const [toast, setToast] = useState<{ message: string; kind: 'info' | 'action'; id: number } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((message: string, kind: 'info' | 'action' = 'info') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, kind, id: Date.now() });
    toastTimerRef.current = setTimeout(() => setToast(null), kind === 'action' ? 1200 : 2000);
  }, []);

  // Color replace callback (needs showToast, declared above)
  const handleReplaceColor = useCallback((fromColor: string, toColor: string) => {
    const shapes = drawingRef.current.state.shapes;
    for (const s of shapes) {
      const patch: Partial<Shape> = {};
      const normalize = (c: string) => c.slice(0, 7).toLowerCase();
      if (normalize(s.fill) === fromColor) patch.fill = toColor;
      if (normalize(s.stroke) === fromColor) patch.stroke = toColor;
      if (s.color && normalize(s.color) === fromColor) patch.color = toColor;
      if (s.gradientStops) {
        const stops = s.gradientStops.map(st => normalize(st.color) === fromColor ? { ...st, color: toColor } : st);
        if (stops.some((st, i) => st.color !== s.gradientStops![i].color)) patch.gradientStops = stops;
      }
      if (Object.keys(patch).length > 0) drawingRef.current.updateShape(s.id, patch);
    }
    showToast(`Replaced ${fromColor} → ${toColor}`, 'action');
  }, [showToast]);

  // Project browser
  const project = useProjectBrowser({
    onFileChanged: useCallback((filePath: string, content: string) => {
      if (filePath === activeFilePath) canvas.loadJsx(content);
    }, [activeFilePath, canvas.loadJsx]),
  });

  // Pages — initialise from persisted data
  const pages = usePages(initialProject.pages, initialProject.activePageId);
  const pagesRef = useRef(pages);
  pagesRef.current = pages;

  // Drawing tools
  const drawing = useDrawingTools(
    useCallback((jsx: string, shapes: Shape[]) => {
      canvas.loadJsx(jsx);
      pagesRef.current.saveCurrentPageShapes(shapes);
    }, [canvas.loadJsx])
  );

  const drawingRef = useRef(drawing);
  drawingRef.current = drawing;

  // Initialise drawing from the active page's persisted shapes
  const initDoneRef = useRef(false);
  useEffect(() => {
    if (initDoneRef.current) return;
    initDoneRef.current = true;
    const activePage = initialProject.pages.find(p => p.id === initialProject.activePageId);
    if (activePage && activePage.shapes.length > 0) {
      drawing.loadShapes(activePage.shapes);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Components / symbols
  const componentLib = useComponents({
    projectId,
    components: initialProject.components ?? [],
    onSave: onSaveComponents,
  });

  // Chat — restore history from persisted data
  const [chatHistoryInit] = useState<ChatMessage[]>(() => initialProject.chatHistory ?? []);
  const chatHistoryRef = useRef<ChatMessage[]>(chatHistoryInit);

  // ── Stable refs ──────────────────────────────────────────────────────────
  const handleSaveRef = useRef<() => void>(() => {});
  const handleSaveAsRef = useRef<() => void>(() => {});
  const handleNewDocRef = useRef<() => void>(() => {});
  const canvasRef = useRef(canvas);
  const fileManagerRef = useRef(fileManager);
  const projectRef = useRef(project);
  const clearDrawingRef = useRef<() => void>(() => {});

  canvasRef.current = canvas;
  fileManagerRef.current = fileManager;
  projectRef.current = project;
  clearDrawingRef.current = drawing.clearAll;

  // ── Persist state on every meaningful change ──────────────────────────────
  const saveRef = useRef(onSave);
  saveRef.current = onSave;

  useEffect(() => {
    saveRef.current(
      projectId,
      pagesRef.current.pages,
      pagesRef.current.activePageId,
      chatHistoryRef.current,
    );
  // Trigger when drawing shapes change — via historyVersion proxy
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawing.historyEntries, pages.pages, pages.activePageId]);

  // ── AI frame-wrapping ─────────────────────────────────────────────────────
  /**
   * When AI produces JSX:
   * - If a frame is selected → update that frame's iframeJsx (re-use existing frame)
   * - Otherwise → create a new frame shape positioned to the right of existing AI frames
   */
  const handleJsxReady = useCallback((jsx: string) => {
    const d = drawingRef.current;
    const { shapes, selectedId } = d.state;
    const sel = shapes.find(s => s.id === selectedId);

    if (sel && sel.type === 'frame') {
      // Embed into the selected frame
      d.updateShape(sel.id, { iframeJsx: jsx });
      // Sync updated shapes to the page so iframeJsx persists across tab switches
      const updatedShapes = d.state.shapes.map(s => s.id === sel.id ? { ...s, iframeJsx: jsx } : s);
      pagesRef.current.saveCurrentPageShapes(updatedShapes);
      canvas.loadJsx(jsx);
      setHasClaudeContent(true);
      return;
    }

    // Auto-place: right of existing AI frames
    const aiFrames = shapes.filter(s => s.iframeJsx);
    let newX = 80;
    let newY = 80;
    if (aiFrames.length > 0) {
      const rightmost = aiFrames.reduce((best, s) => s.x + s.width > best.x + best.width ? s : best, aiFrames[0]);
      newX = rightmost.x + rightmost.width + 40;
      newY = rightmost.y;
    }

    const frame = defaultShape('frame', uuid());
    frame.x = newX;
    frame.y = newY;
    frame.width = 600;
    frame.height = 440;
    frame.name = 'AI Frame';
    frame.iframeJsx = jsx;

    d.addShape(frame);
    canvas.loadJsx(jsx);
    setHasClaudeContent(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvas.loadJsx]);

  const getCurrentJsx = useCallback(() => canvas.currentJsx, [canvas.currentJsx]);
  const getSelection = useCallback(() => canvas.selection, [canvas.selection]);
  const getFilePath = useCallback(() => fileManager.filePath ?? activeFilePath, [fileManager.filePath, activeFilePath]);
  const getSelectedFrameName = useCallback(() => {
    const { shapes, selectedId } = drawingRef.current.state;
    const sel = shapes.find(s => s.id === selectedId);
    return (sel?.type === 'frame') ? sel.name : null;
  }, []);

  // ── Chat ──────────────────────────────────────────────────────────────────
  const chat = useChat({
    onJsxReady: handleJsxReady,
    getCurrentJsx,
    getSelection,
    getFilePath,
    getSelectedFrameName,
    initialMessages: chatHistoryInit,
    onMessagesChange: useCallback((msgs: ChatMessage[]) => {
      chatHistoryRef.current = msgs;
    }, []),
  });

  const silentPatch = useSilentPatch({
    getCurrentJsx,
    getFilePath,
    onJsxReady: canvas.loadJsx,
    onOptimisticPatch: canvas.patchElementClasses,
  });

  // ── Drag-to-move → margin patch ───────────────────────────────────────────
  useEffect(() => {
    canvas.setOnDragEnd(({ dx, dy, className }) => {
      if (!canvas.selection) return;
      const sel = canvas.selection;
      let newClasses = className;
      if (Math.abs(dx) > 2) newClasses = patchTailwindClassLocal(newClasses, dx > 0 ? `ml-[${dx}px]` : `-ml-[${Math.abs(dx)}px]`);
      if (Math.abs(dy) > 2) newClasses = patchTailwindClassLocal(newClasses, dy > 0 ? `mt-[${dy}px]` : `-mt-[${Math.abs(dy)}px]`);
      silentPatch.patch(sel, newClasses);
    });
  }, [canvas, silentPatch]);

  // ── Tool change ───────────────────────────────────────────────────────────
  const handleToolChange = useCallback((tool: Tool) => {
    if (tool !== 'pen') drawingRef.current.penCancel();
    setActiveTool(tool);
    const c = canvasRef.current;
    if (tool === 'select') { if (!c.selectionMode) c.toggleSelectionMode(); }
    else { if (c.selectionMode) c.toggleSelectionMode(); }
    if (tool !== 'cursor') drawingRef.current.select(null);
    analytics.track('tool_selected', { tool });
  }, []);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const mod = e.metaKey || e.ctrlKey;

      if (mod) {
        switch (e.key.toLowerCase()) {
          // ── a — Select all / Auto layout / Animation / Motion path ─────────
          case 'a': {
            e.preventDefault();
            if (e.shiftKey && e.altKey) { setShowMotionPath(m => !m); return; }
            if (e.altKey && !e.shiftKey) { setShowAutoLayout(v => !v); return; }
            if (e.shiftKey) { setShowAnimationTween(a => !a); return; }
            const d = drawingRef.current; if (d.state.shapes.length === 0) return; d.selectAll(); setActiveTool('cursor'); return;
          }
          // ── b — Batch rename / Color Vision / Pattern fill / Moodboard ──────
          // ⌘⇧⌥B = Moodboard, ⌘⇧B = Batch Rename, ⌘⌥B = Color Vision Sim, ⌘⌥⇧B = Pattern Fill
          case 'b': {
            if (e.shiftKey && e.altKey) { e.preventDefault(); setShowMoodboard(v => !v); return; }
            if (e.shiftKey) { e.preventDefault(); setShowBatchRename(o => !o); return; }
            if (e.altKey) { e.preventDefault(); setShowColorVision(v => !v); return; }
            break;
          }
          // ── c — Copy / Center / Content fill / Canvas Compare ─────────────
          case 'c': {
            e.preventDefault();
            if (e.shiftKey && e.altKey) { setShowContentFill(v => !v); return; }
            if (e.shiftKey) { setShowCanvasCompare(v => !v); return; }
            if (e.altKey) { drawingRef.current.centerOnCanvas(); showToast('Centered on canvas', 'action'); return; }
            drawingRef.current.copy();
            const { selectedIds, selectedId, shapes } = drawingRef.current.state;
            const copyCount = selectedIds.length > 1 ? selectedIds.length : (selectedId ? 1 : 0);
            if (copyCount > 0) showToast(copyCount === 1 ? `Copied "${shapes.find(s => s.id === selectedId)?.name ?? 'shape'}"` : `Copied ${copyCount} shapes`, 'action');
            return;
          }
          // ── d — Duplicate / Grid Duplicator / Design system / Tokens ────────
          case 'd': {
            e.preventDefault();
            if (e.shiftKey && e.altKey) { setShowGridDuplicator(v => !v); return; }
            if (e.shiftKey) { setShowDesignSystem(o => !o); return; }
            if (e.altKey) { setShowRedlines(v => !v); return; }
            const { selectedIds: dIds, selectedId: dId, shapes: dShapes } = drawingRef.current.state;
            const dupCount = dIds.length > 1 ? dIds.length : (dId ? 1 : 0);
            drawingRef.current.duplicate();
            if (dupCount > 0) showToast(dupCount === 1 ? `Duplicated "${dShapes.find(s => s.id === dId)?.name ?? 'shape'}"` : `Duplicated ${dupCount} shapes`, 'action');
            return;
          }
          // ── e — Dev spec / Batch export / Easing curve ───────────────────
          // ⌘⇧⌥E = Batch Export, ⌘⇧E = Dev Spec, ⌘⌥E = Easing Curve Editor
          case 'e': {
            if (e.shiftKey && e.altKey) { e.preventDefault(); setShowBatchExport(b => !b); return; }
            if (e.shiftKey) { e.preventDefault(); setShowDevSpec(o => !o); return; }
            if (e.altKey) { e.preventDefault(); setShowEasingCurve(v => !v); return; }
            break;
          }
          // ── f — Spotlight / Custom fonts / Fluid type / Focus Mode ────────
          // ⌘⇧⌥F = Fluid Type, ⌘⇧F = Focus Mode, ⌘F = Spotlight
          case 'f': {
            if (e.shiftKey && e.altKey) { e.preventDefault(); setShowFluidType(f => !f); return; }
            if (e.altKey && !e.shiftKey) { e.preventDefault(); setShowGlobalSearch(v => !v); return; }
            if (e.shiftKey) { e.preventDefault(); setFocusModeActive(f => !f); showToast(focusModeActive ? 'Focus mode off' : 'Focus mode on', 'info'); return; }
            e.preventDefault(); setShowSpotlight(o => !o); return;
          }
          // ── g — Group / Ungroup / Generative art / Gradient editor ────────
          // ⌘⇧⌥G = Gradient Editor, ⌘⌥G = Generative Art, ⌘⇧G = Ungroup, ⌘G = Group
          case 'g': {
            e.preventDefault();
            if (e.shiftKey && e.altKey) { setShowPerspectiveGrid(v => !v); return; }
            if (e.altKey) { setShowGenerativeArt(v => !v); return; }
            if (e.shiftKey) { drawingRef.current.ungroup(); return; }
            drawingRef.current.group(); return;
          }
          // ── h — Find & replace / History browser / Placeholder ────────────
          case 'h': {
            if (e.shiftKey && e.altKey) { e.preventDefault(); setShowPlaceholder(h => !h); return; }
            if (e.altKey) { e.preventDefault(); setShowHistoryBrowser(o => !o); return; }
            if (e.shiftKey) { e.preventDefault(); setShowFindReplace(o => !o); return; }
            break;
          }
          // ── i — Image fill / Design intel / Micro-interaction ─────────────
          case 'i': {
            if (e.shiftKey && e.altKey) { e.preventDefault(); setShowDesignIntel(v => !v); return; }
            if (e.shiftKey) { e.preventDefault(); setShowImageFill(i => !i); return; }
            if (e.altKey) { e.preventDefault(); setShowMicroInteraction(v => !v); return; }
            break;
          }
          // ── j — Layer effects / Sticky notes / AI Styles / Spacing ────────
          // ⌘⇧⌥J = Layer Effects, ⌘⇧J = AI Quick Styles, ⌘J = Sticky note
          case 'j': {
            if (e.shiftKey && e.altKey) { e.preventDefault(); setShowLayerEffects(v => !v); return; }
            if (e.shiftKey) { e.preventDefault(); setShowAIQuickStyles(v => !v); return; }
            e.preventDefault(); startStickyNote(); showToast('Click canvas to place a sticky note', 'info'); return;
          }
          // ── k — Command palette / Annotations / Breakpoint Ruler ──────────
          case 'k': {
            if (e.shiftKey && e.altKey) { e.preventDefault(); setShowBreakpointRuler(v => !v); return; }
            if (e.shiftKey) { e.preventDefault(); setAnnotationsActive(a => !a); showToast(annotationsActive ? 'Annotations off' : 'Annotation mode — click canvas to add', 'info'); return; }
            e.preventDefault(); setCommandPaletteOpen(o => !o); return;
          }
          // ── l — Color grading / Grid system / Asset Library ───────────────
          case 'l': {
            if (e.shiftKey && e.altKey) { e.preventDefault(); setShowGridSystem(v => !v); return; }
            if (e.shiftKey) { e.preventDefault(); setShowColorGrading(g => !g); return; }
            if (e.altKey) { e.preventDefault(); setShowAssetLibrary(v => !v); return; }
            break;
          }
          // ── m — Snapshots / Morph blend / Minimap / Motion Preview ─────────
          case 'm': {
            if (e.shiftKey && e.altKey) { e.preventDefault(); setShowMotionPreview(v => !v); return; }
            if (e.shiftKey) { e.preventDefault(); setShowSnapshots(o => !o); return; }
            if (e.altKey) { e.preventDefault(); setShowMinimap(v => !v); return; }
            break;
          }
          // ── n — New doc / Comments / Noise texture / Spacing advisor ────────
          // ⌘⇧⌥N = Spacing Advisor, ⌘⇧N = Comment Mode, ⌘N = New Doc
          case 'n': {
            e.preventDefault();
            if (e.shiftKey && e.altKey) { setShowSpacingAdvisor(v => !v); return; }
            if (e.shiftKey) { setCommentMode(m => !m); return; }
            if (e.altKey) { setShowNoiseTexture(v => !v); return; }
            handleNewDocRef.current(); return;
          }
          // ── o — Color scheme ──────────────────────────────────────────────
          case 'o': {
            if (e.shiftKey) { e.preventDefault(); setShowColorScheme(o => !o); return; }
            break;
          }
          // ── p — Theme customizer / Presence / Prototype / Path Inspector ──
          // ⌘⇧⌥P = Prototype, ⌘⇧P = Cursor Presence, ⌘⌥P = Path Inspector, ⌘P = Theme Customizer
          case 'p': {
            if (e.shiftKey && e.altKey) { e.preventDefault(); setShowPrototype(v => !v); return; }
            if (e.shiftKey) { e.preventDefault(); setShowPresencePanel(p => !p); setShowCursorPresence(p => !p); showToast(showCursorPresence ? 'Presence off' : 'Presence mode on', 'info'); return; }
            if (e.altKey) { e.preventDefault(); setShowPathInspector(v => !v); return; }
            e.preventDefault(); setShowThemeCustomizer(o => !o); return;
          }
          // ── q — Clip path editor ──────────────────────────────────────────
          case 'q': {
            if (e.shiftKey && e.altKey) { e.preventDefault(); setShowConsistencyAudit(v => !v); return; }
            if (e.altKey) { e.preventDefault(); setShowClipPath(c => !c); return; }
            break;
          }
          // ── r — Color replace / Rulers / Responsive preview / Smart Rename ─
          case 'r': {
            if (e.shiftKey && e.altKey) { e.preventDefault(); setShowResponsivePreview(r => !r); return; }
            if (e.shiftKey) { e.preventDefault(); setShowSmartRename(v => !v); return; }
            e.preventDefault(); setShowRulers(r => !r); return;
          }
          // ── s — Save / Frame sorter ───────────────────────────────────────
          case 's': {
            e.preventDefault();
            if (e.altKey) { setShowFrameSorter(o => !o); return; }
            if (e.shiftKey) { handleSaveAsRef.current(); return; }
            handleSaveRef.current(); return;
          }
          // ── t — Type scale / Template / Tidy up / Keyframe Timeline ───────
          // ⌘⇧⌥T = Keyframe Timeline, ⌘⌥T = Tidy Up, ⌘⇧T = Type Scale
          case 't': {
            if (e.shiftKey && e.altKey) { e.preventDefault(); setShowKeyframeTimeline(v => !v); return; }
            if (e.shiftKey) { e.preventDefault(); setShowTypeScale(o => !o); return; }
            if (e.altKey) { e.preventDefault(); drawingRef.current.tidyUp(); showToast('Tidy up', 'action'); return; }
            if (!e.shiftKey && !e.altKey) { e.preventDefault(); setShowTemplateGallery(v => !v); return; }
            break;
          }
          // ── u — UI blocks ─────────────────────────────────────────────────
          case 'u': {
            if (e.shiftKey) { e.preventDefault(); setShowUIBlocks(b => !b); return; }
            break;
          }
          // ── v — Paste / Variable font / Variants ──────────────────────────
          case 'v': {
            e.preventDefault();
            if (e.shiftKey && e.altKey) { setShowVariableFont(v => !v); return; }
            if (e.altKey && !e.shiftKey) { setShowDesignDiff(v => !v); return; }
            if (e.shiftKey) { drawingRef.current.pasteInPlace(); showToast('Pasted in place', 'action'); return; }
            // Try to paste image from clipboard first (if clipboard has image items)
            navigator.clipboard.read().then(items => {
              for (const item of items) {
                const imageType = item.types.find(t => t.startsWith('image/'));
                if (imageType) {
                  item.getType(imageType).then(blob => {
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      const dataUrl = ev.target?.result as string;
                      if (!dataUrl) return;
                      const img = new window.Image();
                      img.onload = () => {
                        const maxW = 600, maxH = 600;
                        const scale = Math.min(1, maxW / img.width, maxH / img.height);
                        const w = Math.round(img.width * scale);
                        const h = Math.round(img.height * scale);
                        const shape = defaultShape('rectangle', uuid());
                        Object.assign(shape, {
                          x: 80, y: 80, width: w, height: h,
                          fillType: 'image' as const, imageUrl: dataUrl,
                          imageFit: 'fill' as const, name: 'Pasted Image',
                          borderRadius: 0, fill: '#e2e8f0',
                        });
                        drawingRef.current.addShape(shape);
                        showToast('Image pasted', 'action');
                      };
                      img.src = dataUrl;
                    };
                    reader.readAsDataURL(blob);
                  });
                  return; // handled as image
                }
              }
              drawingRef.current.paste();
              showToast('Pasted', 'action');
            }).catch(() => {
              drawingRef.current.paste();
              showToast('Pasted', 'action');
            });
            return;
          }
          // ── w — Shadow studio / Variants ──────────────────────────────────
          case 'w': {
            if (e.shiftKey && e.altKey) { e.preventDefault(); setShowVariants(v => !v); return; }
            if (e.altKey) { e.preventDefault(); setShowSpacingHeatmap(v => !v); return; }
            if (e.shiftKey) { e.preventDefault(); setShowShadowStudio(s => !s); return; }
            break;
          }
          // ── x — Accessibility ─────────────────────────────────────────────
          case 'x': {
            if (e.shiftKey && e.altKey) { e.preventDefault(); setShowAccessibility(a => !a); return; }
            if (e.altKey) { e.preventDefault(); setShowCSSSnippet(v => !v); return; }
            break;
          }
          // ── y — Color harmony / Typography Specimen / Font Pairing / Redo ──
          // ⌘⇧⌥Y = Typography Specimen, ⌘⌥Y = Font Pairing, ⌘⇧Y = Color Harmony, ⌘Y = Redo
          case 'y': {
            e.preventDefault();
            if (e.shiftKey && e.altKey) { setShowTypographySpecimen(v => !v); return; }
            if (e.altKey) { setShowFontPairing(v => !v); return; }
            if (e.shiftKey) { setShowColorHarmony(o => !o); return; }
            drawingRef.current.redo(); showToast('Redo', 'action'); return;
          }
          // ── z — Undo / Redo ───────────────────────────────────────────────
          case 'z': {
            e.preventDefault();
            if (e.altKey && !e.shiftKey) { setShowShapeVariations(v => !v); return; }
            if (e.shiftKey) { drawingRef.current.redo(); showToast('Redo', 'action'); }
            else { drawingRef.current.undo(); showToast('Undo', 'action'); }
            return;
          }
          // ── / — Code export ───────────────────────────────────────────────
          case '/': {
            if (e.shiftKey) { e.preventDefault(); setShowCodeExport(o => !o); return; }
            break;
          }
          // ── 2 — Color Contrast Checker ────────────────────────────────────
          case '2': {
            if (e.shiftKey) { e.preventDefault(); setShowColorContrast(v => !v); return; }
            break;
          }
          // ── 3 — 3D Transform ──────────────────────────────────────────────
          case '3': {
            if (e.shiftKey && e.altKey) { e.preventDefault(); setShow3DTransform(v => !v); return; }
            if (e.shiftKey) { e.preventDefault(); setShowLayoutInspector(v => !v); return; }
            break;
          }
          // ── ] [ — Z-order ─────────────────────────────────────────────────
          case ']': e.preventDefault(); drawingRef.current.bringToFront(); return;
          case '[': e.preventDefault(); drawingRef.current.sendToBack(); return;
        }
        // Backslash: toggle panels (not captured by switch because key is '\\')
        if (e.key === '\\') {
          e.preventDefault();
          if (e.shiftKey) { setRightCollapsed(c => !c); } else { setLeftCollapsed(c => !c); }
          return;
        }
        return;
      }

      // Number keys 1-9: set opacity 10-90%; 0 = 100% (when shape is selected)
      if (!e.shiftKey && /^[0-9]$/.test(e.key)) {
        const d = drawingRef.current;
        const id = d.state.selectedId;
        if (id) {
          const pct = e.key === '0' ? 100 : parseInt(e.key) * 10;
          d.updateShape(id, { opacity: pct / 100 });
          showToast(`Opacity ${pct}%`, 'info');
          return;
        }
      }

      // F5: toggle presentation mode
      if (e.key === 'F5') {
        e.preventDefault();
        setPresentationMode(m => !m);
        return;
      }

      switch (e.key.toLowerCase()) {
        case '?': setShowShortcuts(s => !s); break;
        case 'v': setActiveTool('cursor'); break;
        case 's': handleToolChange('select'); break;
        case 'h': {
          if (e.shiftKey) {
            // Shift+H: toggle hide on selected shape(s)
            const d = drawingRef.current;
            const ids = d.state.selectedIds.length > 0 ? d.state.selectedIds : (d.state.selectedId ? [d.state.selectedId] : []);
            for (const id of ids) {
              const shape = d.state.shapes.find(s => s.id === id);
              if (shape) d.updateShape(id, { hidden: !shape.hidden });
            }
            if (ids.length > 0) showToast(ids.length === 1 && drawingRef.current.state.shapes.find(s => s.id === ids[0])?.hidden ? 'Layer hidden' : 'Layer visible', 'info');
          } else {
            setActiveTool('pan');
          }
          break;
        }
        case 'l': {
          if (e.shiftKey) {
            setShowDesignLint(q => !q);
          } else {
            // L: toggle lock on selected shape(s)
            const d = drawingRef.current;
            const ids = d.state.selectedIds.length > 0 ? d.state.selectedIds : (d.state.selectedId ? [d.state.selectedId] : []);
            for (const id of ids) {
              const shape = d.state.shapes.find(s => s.id === id);
              if (shape) d.updateShape(id, { locked: !shape.locked });
            }
            if (ids.length > 0) showToast(ids.length === 1 && drawingRef.current.state.shapes.find(s => s.id === ids[0])?.locked ? 'Layer locked' : 'Layer unlocked', 'info');
          }
          break;
        }
        case 'f': setActiveTool('frame'); break;
        case 'r': setActiveTool('rectangle'); break;
        case 'o': setActiveTool('ellipse'); break;
        case 't': setActiveTool('text'); break;
        case 'p': setActiveTool('pen'); break;
        case 'i': if (e.shiftKey) { setShowIconPicker(q => !q); } else { setShowQuickInsert(q => !q); } break;
        case 'k': if (e.shiftKey) { setShowColorPalettes(q => !q); } break;
        case 'u': if (e.shiftKey) { setShowDeviceMockup(q => !q); } break;
        case '1': case '2': case '3': case '4': case '5':
        case '6': case '7': case '8': case '9': case '0': {
          // Number keys set opacity on selected shape(s): 1=10%, 2=20%,... 0=100%
          const d = drawingRef.current;
          const { selectedId, selectedIds: sIds } = d.state;
          const idsToOpacity = sIds.length > 0 ? sIds : (selectedId ? [selectedId] : []);
          if (idsToOpacity.length > 0) {
            const digit = parseInt(e.key);
            const opacity = digit === 0 ? 1 : digit / 10;
            for (const id of idsToOpacity) d.updateShape(id, { opacity });
            showToast(`Opacity ${Math.round(opacity * 100)}%`, 'action');
          }
          break;
        }
        case 'delete':
        case 'backspace': drawingRef.current.deleteSelected(); break;
        case 'escape':
          if (annotationsActive) { setAnnotationsActive(false); return; }
          if (stickyNotesPlacing) { stopStickyNote(); return; }
          if (presentationMode) { setPresentationMode(false); return; }
          if (focusModeActive) { setFocusModeActive(false); return; }
          drawingRef.current.select(null);
          drawingRef.current.setSelectedIds([]);
          if (activeTool !== 'cursor') setActiveTool('cursor');
          break;
      }

      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        const d = drawingRef.current;
        const { selectedId, selectedIds, shapes } = d.state;
        const idsToMove = selectedIds.length > 1 ? selectedIds : (selectedId ? [selectedId] : []);
        if (idsToMove.length === 0) return;
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        let dx = 0, dy = 0;
        if (e.key === 'ArrowLeft')  dx = -step;
        if (e.key === 'ArrowRight') dx = +step;
        if (e.key === 'ArrowUp')    dy = -step;
        if (e.key === 'ArrowDown')  dy = +step;
        for (const id of idsToMove) {
          const shape = shapes.find(s => s.id === id);
          if (!shape) continue;
          // Path shapes: also translate all points
          let patch: Partial<Shape> = { x: shape.x + dx, y: shape.y + dy };
          if (shape.type === 'path' && shape.points) {
            patch = { ...patch, points: shape.points.map(p => ({ x: p.x + dx, y: p.y + dy })) };
          }
          d.updateShape(id, patch);
        }
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeTool, handleToolChange]);

  // ── File actions ───────────────────────────────────────────────────────────
  const handleOpen = useCallback(async () => {
    const result = await fileManagerRef.current.openFile();
    if (!result) return;
    canvasRef.current.loadJsx(result.content);
    setActiveFilePath(result.filePath);
    setHasClaudeContent(true);
    chat.reset();
    drawingRef.current.clearAll();
  }, [chat.reset]);

  const handleSave = useCallback(async () => {
    const jsx = canvasRef.current.currentJsx;
    if (!jsx) return;
    await fileManagerRef.current.saveFile(jsx);
  }, []);

  const handleSaveAs = useCallback(async () => {
    const jsx = canvasRef.current.currentJsx;
    if (!jsx) return;
    await fileManagerRef.current.saveFileAs(jsx);
  }, []);

  const handleNewDoc = useCallback(() => {
    canvasRef.current.loadJsx('');
    canvasRef.current.clearSelection();
    chat.reset();
    fileManagerRef.current.clearFile();
    setActiveFilePath(null);
    setHasClaudeContent(false);
    setActiveTool('cursor');
    drawingRef.current.clearAll();
  }, [chat.reset]);

  handleSaveRef.current = handleSave;
  handleSaveAsRef.current = handleSaveAs;
  handleNewDocRef.current = handleNewDoc;

  // ── Layer selection ───────────────────────────────────────────────────────
  const handleLayerSelect = useCallback((path: string) => {
    canvasRef.current.highlightByPath(path);
  }, []);

  // ── Drawing handlers ──────────────────────────────────────────────────────
  const activeToolRef = useRef(activeTool);
  activeToolRef.current = activeTool;

  const handleDrawStart = useCallback((x: number, y: number) => {
    drawingRef.current.startDraw(activeToolRef.current, x, y);
  }, []);

  const handleDrawUpdate = useCallback((x: number, y: number, ox: number, oy: number) => {
    drawingRef.current.updateDraft(x, y, ox, oy);
  }, []);

  const [autoEditId, setAutoEditId] = useState<string | null>(null);

  const handleDrawCommit = useCallback(() => {
    const d = drawingRef.current;
    const drafting = d.state.drafting;
    d.commitDraft();
    if (drafting) analytics.track('shape_created', { type: drafting.shape.type });
    // Auto-enter text edit mode for text shapes, and switch to cursor
    if (drafting && drafting.shape.type === 'text') {
      setActiveTool('cursor');
      setAutoEditId(drafting.shape.id);
      setTimeout(() => setAutoEditId(null), 100);
    }
    // For all other shapes, stay on the current tool so the user can keep drawing
  }, []);

  const handleShapePreview = useCallback((patch: Partial<Shape>) => {
    const d = drawingRef.current;
    if (!d.state.selectedId) return;
    d.previewShape(d.state.selectedId, patch);
  }, []);

  const handleShapeChange = useCallback((patch: Partial<Shape>) => {
    const d = drawingRef.current;
    if (!d.state.selectedId) return;
    d.updateShape(d.state.selectedId, patch);
  }, []);

  const handleShapeChangeById = useCallback((id: string, patch: Partial<Shape>) => {
    drawingRef.current.updateShape(id, patch);
  }, []);

  const handleShapePreviewById = useCallback((id: string, patch: Partial<Shape>) => {
    drawingRef.current.previewShape(id, patch);
  }, []);

  const handleMoveEnd = useCallback(() => drawingRef.current.endMove(), []);
  const handleResizeEnd = useCallback(() => drawingRef.current.endResize(), []);

  // ── Page actions ───────────────────────────────────────────────────────────
  const handleSwitchPage = useCallback((pageId: string) => {
    pagesRef.current.switchPage(pageId, drawingRef.current.state.shapes, (shapes) => {
      drawingRef.current.loadShapes(shapes);
    });
  }, []);

  const handleAddPage = useCallback(() => {
    pagesRef.current.addPage(drawingRef.current.state.shapes, (shapes) => {
      drawingRef.current.loadShapes(shapes);
    });
    analytics.track('page_added');
  }, []);

  const handleDeletePage = useCallback((pageId: string) => {
    pagesRef.current.deletePage(pageId, drawingRef.current.state.shapes, (shapes) => {
      drawingRef.current.loadShapes(shapes);
    });
  }, []);

  // ── Derived state ──────────────────────────────────────────────────────────
  const selectedShape = drawing.state.shapes.find(s => s.id === drawing.state.selectedId) ?? null;
  // Show inspect panel when a shape is selected, regardless of active tool
  // (so users can edit properties immediately after drawing without switching to cursor)
  const showShapeInspect = selectedShape !== null && activeTool !== 'pan' && activeTool !== 'select';
  const showMultiSelect = drawing.state.selectedIds.length >= 2 && activeTool !== 'pan' && activeTool !== 'select';
  const showElementInspect = canvas.selection !== null && !showShapeInspect && !showMultiSelect;
  const showRightPanel = (showShapeInspect || showElementInspect || showMultiSelect) && !rightCollapsed;

  // When a frame with iframeJsx is selected, show its content in the main iframe
  useEffect(() => {
    if (selectedShape?.iframeJsx) {
      canvas.loadJsx(selectedShape.iframeJsx);
    }
  }, [selectedShape?.id, selectedShape?.iframeJsx, canvas.loadJsx]);

  // ── Presentation mode ─────────────────────────────────────────────────────
  // Collect all frames for slide navigation
  const presentationFrames = drawing.state.shapes.filter(s => s.type === 'frame');
  const [presentationFrameIdx, setPresentationFrameIdx] = React.useState(0);
  const [presentationAutoPlay, setPresentationAutoPlay] = React.useState(false);
  const [presentationAutoInterval, setPresentationAutoInterval] = React.useState(3000); // ms
  const [presentationProgress, setPresentationProgress] = React.useState(0); // 0-100
  const [presentationTransitionKey, setPresentationTransitionKey] = React.useState(0);
  const [presentationTransitionAnim, setPresentationTransitionAnim] = React.useState<string>('');
  const autoPlayTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const autoPlayProgressRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  // Available slide transitions
  const PRESENTATION_TRANSITIONS: { id: string; label: string; keyframes: string; animIn: string }[] = [
    { id: 'none', label: 'None', keyframes: '', animIn: '' },
    { id: 'fade', label: 'Fade', keyframes: `@keyframes pFade{from{opacity:0}to{opacity:1}}`, animIn: 'pFade 0.35s ease both' },
    { id: 'slide-left', label: 'Slide left', keyframes: `@keyframes pSlideL{from{transform:translateX(60px);opacity:0}to{transform:none;opacity:1}}`, animIn: 'pSlideL 0.35s cubic-bezier(0.4,0,0.2,1) both' },
    { id: 'slide-right', label: 'Slide right', keyframes: `@keyframes pSlideR{from{transform:translateX(-60px);opacity:0}to{transform:none;opacity:1}}`, animIn: 'pSlideR 0.35s cubic-bezier(0.4,0,0.2,1) both' },
    { id: 'zoom', label: 'Zoom', keyframes: `@keyframes pZoom{from{transform:scale(0.92);opacity:0}to{transform:scale(1);opacity:1}}`, animIn: 'pZoom 0.35s cubic-bezier(0.34,1.56,0.64,1) both' },
  ];
  const [selectedTransitionId, setSelectedTransitionId] = React.useState('fade');

  // Navigate to a specific frame in presentation mode
  const goToFrame = useCallback((idx: number) => {
    const frames = drawingRef.current.state.shapes.filter(s => s.type === 'frame');
    if (frames.length === 0) return;
    const clampedIdx = Math.max(0, Math.min(frames.length - 1, idx));
    setPresentationFrameIdx(clampedIdx);
    // Trigger animation
    const trans = PRESENTATION_TRANSITIONS.find(t => t.id === selectedTransitionId);
    if (trans && trans.animIn) {
      setPresentationTransitionAnim(trans.animIn);
      setPresentationTransitionKey(k => k + 1);
    }
    const frame = frames[clampedIdx];
    drawingRef.current.select(frame.id);
    if (frame.iframeJsx) canvas.loadJsx(frame.iframeJsx);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvas.loadJsx, selectedTransitionId]);

  // Auto-play effect for presentation mode
  useEffect(() => {
    if (!presentationMode || !presentationAutoPlay || presentationFrames.length < 2) {
      if (autoPlayTimerRef.current) { clearInterval(autoPlayTimerRef.current); autoPlayTimerRef.current = null; }
      if (autoPlayProgressRef.current) { clearInterval(autoPlayProgressRef.current); autoPlayProgressRef.current = null; }
      setPresentationProgress(0);
      return;
    }
    setPresentationProgress(0);
    const tickMs = 50;
    autoPlayProgressRef.current = setInterval(() => {
      setPresentationProgress(p => {
        const next = p + (tickMs / presentationAutoInterval) * 100;
        return next >= 100 ? 100 : next;
      });
    }, tickMs);
    autoPlayTimerRef.current = setInterval(() => {
      setPresentationProgress(0);
      setPresentationFrameIdx(i => {
        const next = (i + 1) % presentationFrames.length;
        goToFrame(next);
        return next;
      });
    }, presentationAutoInterval);
    return () => {
      if (autoPlayTimerRef.current) clearInterval(autoPlayTimerRef.current);
      if (autoPlayProgressRef.current) clearInterval(autoPlayProgressRef.current);
    };
  }, [presentationMode, presentationAutoPlay, presentationAutoInterval, presentationFrames.length, goToFrame]);

  // Keyboard nav for presentation mode
  useEffect(() => {
    if (!presentationMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        setPresentationFrameIdx(i => {
          const next = Math.min(i + 1, presentationFrames.length - 1);
          goToFrame(next);
          return next;
        });
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        setPresentationFrameIdx(i => {
          const prev = Math.max(i - 1, 0);
          goToFrame(prev);
          return prev;
        });
      } else if (e.key === 'Escape' || e.key === 'F5') {
        setPresentationMode(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [presentationMode, presentationFrames.length, goToFrame]);

  if (presentationMode) {
    const hasFrames = presentationFrames.length > 1;
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#0e0e14', zIndex: 9999, display: 'flex', flexDirection: 'column' }}>
        {/* Minimal top bar */}
        <div style={{
          height: 36, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 16px',
          background: 'rgba(0,0,0,0.4)',
          backdropFilter: 'blur(8px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', letterSpacing: '0.04em' }}>
            Quill — Presentation
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {hasFrames && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button
                  onClick={() => goToFrame(presentationFrameIdx - 1)}
                  disabled={presentationFrameIdx === 0}
                  style={{
                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 5, color: presentationFrameIdx === 0 ? 'rgba(255,255,255,0.2)' : 'var(--muted)',
                    cursor: presentationFrameIdx === 0 ? 'default' : 'pointer',
                    fontSize: 12, padding: '2px 8px', lineHeight: 1,
                  }}
                >←</button>
                <span style={{ fontSize: 11, color: 'var(--muted)', minWidth: 60, textAlign: 'center' }}>
                  {presentationFrameIdx + 1} / {presentationFrames.length}
                </span>
                <button
                  onClick={() => goToFrame(presentationFrameIdx + 1)}
                  disabled={presentationFrameIdx >= presentationFrames.length - 1}
                  style={{
                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 5,
                    color: presentationFrameIdx >= presentationFrames.length - 1 ? 'rgba(255,255,255,0.2)' : 'var(--muted)',
                    cursor: presentationFrameIdx >= presentationFrames.length - 1 ? 'default' : 'pointer',
                    fontSize: 12, padding: '2px 8px', lineHeight: 1,
                  }}
                >→</button>
              </div>
            )}
            {/* Auto-play controls */}
            {hasFrames && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button
                  onClick={() => setPresentationAutoPlay(a => !a)}
                  title={presentationAutoPlay ? 'Pause auto-play' : 'Start auto-play'}
                  style={{
                    background: presentationAutoPlay ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.06)',
                    border: `1px solid ${presentationAutoPlay ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: 5, color: presentationAutoPlay ? 'var(--accent)' : 'var(--muted)',
                    cursor: 'pointer', fontSize: 13, padding: '2px 8px', lineHeight: 1,
                    transition: 'all 0.15s',
                  }}
                >
                  {presentationAutoPlay ? '⏸' : '▶'}
                </button>
                <select
                  value={presentationAutoInterval}
                  onChange={e => setPresentationAutoInterval(parseInt(e.target.value))}
                  style={{
                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 5, color: 'var(--muted)', fontSize: 10, padding: '2px 4px',
                    cursor: 'pointer',
                  }}
                >
                  <option value={1500}>1.5s</option>
                  <option value={2000}>2s</option>
                  <option value={3000}>3s</option>
                  <option value={5000}>5s</option>
                  <option value={8000}>8s</option>
                </select>
              </div>
            )}
            {/* Transition picker */}
            {hasFrames && (
              <select
                value={selectedTransitionId}
                onChange={e => setSelectedTransitionId(e.target.value)}
                title="Slide transition"
                style={{
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 5, color: 'var(--muted)', fontSize: 10, padding: '2px 4px',
                  cursor: 'pointer',
                }}
              >
                {PRESENTATION_TRANSITIONS.map(t => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            )}
            <span style={{ fontSize: 11, color: 'var(--subtle)' }}>Esc / F5 to exit{hasFrames ? ' · ←→ navigate' : ''}</span>
            <button
              onClick={() => setPresentationMode(false)}
              style={{
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 5, color: 'var(--muted)', cursor: 'pointer',
                fontSize: 11, padding: '3px 10px',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)'; }}
            >
              ✕ Exit
            </button>
          </div>
        </div>

        {/* Auto-play progress bar */}
        {presentationAutoPlay && hasFrames && (
          <div style={{ height: 2, background: 'rgba(255,255,255,0.08)', flexShrink: 0, position: 'relative' }}>
            <div style={{
              height: '100%', background: 'var(--accent)',
              width: `${presentationProgress}%`,
              transition: 'width 0.05s linear',
            }} />
          </div>
        )}

        {/* Slide dots navigation */}
        {hasFrames && (
          <div style={{
            position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
            display: 'flex', gap: 6, zIndex: 10,
            background: 'rgba(0,0,0,0.4)', borderRadius: 20,
            padding: '6px 10px', backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}>
            {presentationFrames.map((frame, i) => (
              <button
                key={frame.id}
                onClick={() => goToFrame(i)}
                title={frame.name}
                style={{
                  width: i === presentationFrameIdx ? 20 : 7,
                  height: 7,
                  borderRadius: 4,
                  background: i === presentationFrameIdx ? 'var(--accent)' : 'rgba(255,255,255,0.25)',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  transition: 'all 0.2s',
                }}
              />
            ))}
          </div>
        )}
        {/* Inject transition keyframes */}
        <style>{PRESENTATION_TRANSITIONS.map(t => t.keyframes).join('\n')}</style>

        {/* Canvas area */}
        <div
          key={presentationTransitionKey}
          style={{
            flex: 1, position: 'relative', overflow: 'hidden',
            animation: presentationTransitionAnim || undefined,
          }}
        >
          <CanvasPane
            iframeRef={canvas.iframeRef}
            dataUri={canvas.dataUri}
            hasContent={!!canvas.currentJsx || drawing.state.shapes.length > 0}
            selection={null}
            isStreaming={false}
            streamingContent={''}
            onClearSelection={canvas.clearSelection}
            onIframeLoad={canvas.onIframeLoad}
          />
          <CanvasOverlay
            activeTool="cursor"
            shapes={drawing.state.shapes}
            drafting={null}
            selectedId={null}
            selectedIds={[]}
            marquee={null}
            isDraggingMove={false}
            isDraggingResize={false}
            hasIframeContent={hasClaudeContent}
            onDrawStart={() => {}}
            onDrawUpdate={() => {}}
            onDrawCommit={() => {}}
            onSelect={(id) => {
              // Prototype navigation: click a hotspot → go to linked frame
              if (!id) return;
              const shape = drawing.state.shapes.find(s => s.id === id);
              if (shape?.protoLink) {
                const targetFrame = drawing.state.shapes.find(s => s.id === shape.protoLink);
                if (targetFrame) {
                  const frameIdx = presentationFrames.findIndex(f => f.id === targetFrame.id);
                  if (frameIdx >= 0) goToFrame(frameIdx);
                }
              }
            }}
            onAddToSelection={() => {}}
            onRemoveFromSelection={() => {}}
            onSetMarquee={() => {}}
            onCommitMarquee={() => {}}
            onMoveStart={() => {}}
            onMove={() => {}}
            onMoveEnd={() => {}}
            onResizeStart={() => {}}
            onResize={() => {}}
            onResizeEnd={() => {}}
            onDrawCancel={() => {}}
            onShapeChange={() => {}}
            onShapePreview={() => {}}
            autoEditId={null}
            onDuplicate={() => {}}
            onDelete={() => {}}
            onBringToFront={() => {}}
            onSendToBack={() => {}}
            onCopy={() => {}}
            onPaste={() => {}}
            penPoints={[]}
            penCursor={null}
            penDragPointIndex={null}
            penPullingHandleRef={{ current: null }}
            onPenClick={() => {}}
            onPenPullHandle={() => {}}
            onPenEndHandlePull={() => {}}
            onPenMove={() => {}}
            onPenCommit={() => {}}
            onPenCancel={() => {}}
            onPenStartDragPoint={() => {}}
            onPenDragPoint={() => {}}
            onPenEndDragPoint={() => {}}
            onCanvasPointerDown={() => {}}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left icon sidebar */}
      <ToolSidebar
        activeTool={activeTool}
        hasContent={!!canvas.currentJsx || drawing.state.shapes.length > 0}
        onToolChange={handleToolChange}
        onOpen={handleOpen}
        onSave={handleSave}
        onSaveAs={handleSaveAs}
        onNew={handleNewDoc}
        leftPanelCollapsed={leftCollapsed}
        onToggleLeftPanel={() => setLeftCollapsed(c => !c)}
      />

      {/* Unified left panel (Layers / Pages / History) */}
      <LeftPanel
        collapsed={leftCollapsed}
        onCollapse={() => setLeftCollapsed(c => !c)}
        activeTab={leftTab}
        onTabChange={setLeftTab}
        layerTree={canvas.layerTree}
        shapes={drawing.state.shapes}
        selectedShapeId={drawing.state.selectedId}
        selectedShapeIds={drawing.state.selectedIds}
        onSelectShape={(id) => {
          drawing.select(id);
          if (id) setActiveTool('cursor');
        }}
        onSelectPath={handleLayerSelect}
        onRenameShape={(id, name) => drawingRef.current.updateShape(id, { name })}
        onReorderShapes={(newOrder) => drawingRef.current.reorderShapes(newOrder)}
        onToggleHidden={(id) => {
          const shape = drawingRef.current.state.shapes.find(s => s.id === id);
          if (shape) drawingRef.current.updateShape(id, { hidden: !shape.hidden });
        }}
        onToggleLocked={(id) => {
          const shape = drawingRef.current.state.shapes.find(s => s.id === id);
          if (shape) drawingRef.current.updateShape(id, { locked: !shape.locked });
        }}
        onDuplicateShape={(id) => {
          drawingRef.current.select(id);
          drawingRef.current.duplicate();
        }}
        onDeleteShape={(id) => {
          drawingRef.current.select(id);
          drawingRef.current.deleteSelected();
        }}
        canvasSelection={canvas.selection}
        pages={pages.pages}
        activePageId={pages.activePageId}
        onSwitchPage={handleSwitchPage}
        onAddPage={handleAddPage}
        onRenamePage={pages.renamePage}
        onDeletePage={handleDeletePage}
        historyEntries={drawing.historyEntries}
        historyIndex={drawing.historyIndex}
        onJumpHistory={drawing.jumpToHistory}
        components={componentLib.components}
        canSaveComponent={
          drawing.state.selectedIds.length >= 2 ||
          (!!drawing.state.selectedId && !!drawing.state.shapes.find(s => s.id === drawing.state.selectedId && (s.isGroup || s.children.length > 0)))
        }
        onInsertComponent={(componentId, x, y) => {
          const shapes = componentLib.insertInstance(componentId, x, y);
          for (const s of shapes) drawingRef.current.addShape(s);
          analytics.track('component_inserted', { componentId });
        }}
        onSaveSelectionAsComponent={(name) => {
          const { selectedId, selectedIds, shapes } = drawingRef.current.state;
          // Save the selected group, or auto-group a multi-selection first
          const id = selectedId ?? (selectedIds.length > 0 ? selectedIds[0] : null);
          if (!id) return;
          const shape = shapes.find(s => s.id === id);
          if (!shape) return;
          componentLib.saveAsComponent(name, shape, shapes);
          analytics.track('component_saved', { name });
        }}
        onDeleteComponent={componentLib.deleteComponent}
        onRenameComponent={componentLib.renameComponent}
        commentPins={commentPins}
        onCommentPinChange={updateCommentPin}
        onCommentPinDelete={deleteCommentPin}
        onCommentPinFocus={(_pin) => {
          // Navigate canvas to pin location (dispatch a synthetic zoom-to event)
          setLeftTab('comments');
        }}
        onCommentAddMode={() => setCommentMode(true)}
      />

      {/* Canvas + overlay + chat */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {/* Canvas area */}
        <div
          ref={canvasContainerRef}
          style={{ flex: 1, position: 'relative', overflow: 'hidden', minHeight: 0, filter: colorBlindFilter || undefined }}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const sx = e.clientX - rect.left;
            const sy = e.clientY - rect.top;
            setCanvasCursorScreen({ x: sx, y: sy });
            if (protoConnectingFrom) setProtoCanvasCursor({ x: sx, y: sy });
          }}
          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
          onDrop={(e) => {
            e.preventDefault();
            const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
            if (files.length === 0) return;
            const canvasEl = e.currentTarget;
            const rect = canvasEl.getBoundingClientRect();
            files.forEach((file, i) => {
              const reader = new FileReader();
              reader.onload = (ev) => {
                const dataUrl = ev.target?.result as string;
                if (!dataUrl) return;
                const img = new Image();
                img.onload = () => {
                  const maxW = 400, maxH = 400;
                  const scale = Math.min(1, maxW / img.width, maxH / img.height);
                  const w = Math.round(img.width * scale);
                  const h = Math.round(img.height * scale);
                  // Drop position in canvas coords (approx — without zoom/pan correction)
                  const dropX = e.clientX - rect.left + i * 20 - w / 2;
                  const dropY = e.clientY - rect.top + i * 20 - h / 2;
                  const shape = defaultShape('rectangle', uuid());
                  Object.assign(shape, {
                    x: Math.max(0, dropX),
                    y: Math.max(0, dropY),
                    width: w,
                    height: h,
                    fillType: 'image' as const,
                    imageUrl: dataUrl,
                    imageFit: 'fill' as const,
                    name: file.name.replace(/\.[^.]+$/, ''),
                    borderRadius: 0,
                  });
                  drawingRef.current.addShape(shape);
                  showToast(`Added image "${file.name}"`, 'action');
                };
                img.src = dataUrl;
              };
              reader.readAsDataURL(file);
            });
          }}
        >
          <CanvasPane
            iframeRef={canvas.iframeRef}
            dataUri={canvas.dataUri}
            hasContent={!!canvas.currentJsx || drawing.state.shapes.length > 0}
            selection={canvas.selection}
            isStreaming={chat.isStreaming}
            streamingContent={chat.streamingContent}
            onClearSelection={canvas.clearSelection}
            onIframeLoad={canvas.onIframeLoad}
          />

          {drawing.state.shapes.length > 0 && <ExportToolbar shapes={drawing.state.shapes} onPresent={() => setPresentationMode(true)} />}

          {/* Right panel re-open tab — visible only when panel is collapsed */}
          {rightCollapsed && (
            <button
              onClick={() => setRightCollapsed(false)}
              title="Show properties panel (⌘⇧\)"
              style={{
                position: 'absolute',
                top: 10,
                right: 0,
                width: 20,
                height: 56,
                background: 'var(--panel)',
                border: '1px solid var(--border)',
                borderRight: 'none',
                borderRadius: '6px 0 0 6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--subtle)',
                zIndex: 20,
                transition: 'color 0.12s, background 0.12s',
                boxShadow: '-2px 0 8px rgba(0,0,0,0.15)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.color = 'var(--accent)';
                e.currentTarget.style.background = 'var(--accent-dim)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = 'var(--subtle)';
                e.currentTarget.style.background = 'var(--panel)';
              }}
            >
              {/* Double-chevron left = expand leftward */}
              <svg width="10" height="14" viewBox="0 0 10 14" fill="none">
                <path d="M7 3L3 7l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}

          {/* Empty canvas hint */}
          {drawing.state.shapes.length === 0 && !hasClaudeContent && !appSettings.dismissedEmptyState && (
            <CanvasEmptyState
              onOpenShortcuts={() => setShowShortcuts(true)}
              onDismiss={() => updateAppSettings({ dismissedEmptyState: true })}
              onInsertTemplate={(shapes) => {
                const { v4: uid } = { v4: uuid };
                for (const s of shapes) {
                  const base = defaultShape((s.type ?? 'rectangle') as Shape['type'], uid());
                  const merged = { ...base, ...s } as Shape;
                  drawingRef.current.addShape(merged);
                }
                showToast(`Template inserted`, 'action');
              }}
            />
          )}

          <AlignmentBar
            shapes={drawing.state.shapes}
            selectedIds={drawing.state.selectedIds}
            onAlign={drawing.alignShapes}
            onStackH={drawing.stackHorizontal}
            onStackV={drawing.stackVertical}
            onDistributeH={drawing.distributeHorizontal}
            onDistributeV={drawing.distributeVertical}
            onAutoLayout={() => {
              const dir = drawing.autoDetectLayout();
              if (dir !== 'none') showToast(`Created ${dir} auto-layout frame`, 'action');
            }}
          />

          <CanvasOverlay
            activeTool={activeTool}
            shapes={drawing.state.shapes}
            drafting={drawing.state.drafting}
            selectedId={drawing.state.selectedId}
            selectedIds={drawing.state.selectedIds}
            marquee={drawing.state.marquee}
            isDraggingMove={drawing.state.draggingMove !== null}
            isDraggingResize={drawing.state.draggingHandle !== null}
            hasIframeContent={hasClaudeContent}
            onDrawStart={handleDrawStart}
            onDrawUpdate={handleDrawUpdate}
            onDrawCommit={handleDrawCommit}
            onSelect={drawing.select}
            onAddToSelection={drawing.addToSelection}
            onRemoveFromSelection={drawing.removeFromSelection}
            onSetMarquee={drawing.setMarquee}
            onCommitMarquee={drawing.commitMarquee}
            onMoveStart={drawing.startMove}
            onMove={drawing.move}
            onMoveEnd={handleMoveEnd}
            onResizeStart={drawing.startResize}
            onResize={drawing.resize}
            onResizeEnd={handleResizeEnd}
            onDrawCancel={drawing.cancelDraft}
            onShapeChange={handleShapeChangeById}
            onShapePreview={handleShapePreviewById}
            autoEditId={autoEditId}
            onDuplicate={drawing.duplicate}
            onDelete={drawing.deleteSelected}
            onBringToFront={drawing.bringToFront}
            onSendToBack={drawing.sendToBack}
            onCopy={drawing.copy}
            onPaste={drawing.paste}
            onGroup={drawing.group}
            onUngroup={drawing.ungroup}
            onWrapInFrame={() => drawing.wrapInFrame()}
            onSelectAll={drawing.selectAll}
            penPoints={drawing.penPoints}
            penCursor={drawing.penCursor}
            penDragPointIndex={drawing.penDragPointIndex}
            penPullingHandleRef={drawing.penPullingHandleRef}
            onPenClick={drawing.penAddPoint}
            onPenPullHandle={drawing.penPullHandle}
            onPenEndHandlePull={drawing.penEndHandlePull}
            onPenMove={drawing.penMoveCursor}
            onPenCommit={(closed) => { drawing.penCommit(closed); setActiveTool('cursor'); analytics.track('shape_created', { type: 'path', closed }); }}
            onPenCancel={() => { drawing.penCancel(); setActiveTool('cursor'); }}
            onPenStartDragPoint={drawing.penStartDragPoint}
            onPenDragPoint={drawing.penDragPoint}
            onPenEndDragPoint={drawing.penEndDragPoint}
            onCanvasPointerDown={() => setChatCollapseSignal(n => n + 1)}
            commentPins={commentPins}
            commentMode={commentMode}
            onAddCommentPin={addCommentPin}
            onUpdateCommentPin={updateCommentPin}
            onDeleteCommentPin={deleteCommentPin}
            onExitCommentMode={() => setCommentMode(false)}
            projectId={projectId}
            stickyNotesPlacing={stickyNotesPlacing}
            onStickyNotesPlacingComplete={stopStickyNote}
            onViewportChange={(z, px, py) => setViewport({ zoom: z, panX: px, panY: py })}
            guideLines={guides.map(g => g.axis === 'h' ? { y: g.position } : { x: g.position })}
          />

          {/* Canvas rulers + guides */}
          <CanvasRulers
            zoom={viewport.zoom}
            panX={viewport.panX}
            panY={viewport.panY}
            width={canvasSize.width}
            height={canvasSize.height}
            guides={guides}
            onAddGuide={(g) => setGuides(gs => [...gs, g])}
            onMoveGuide={(id, pos) => setGuides(gs => gs.map(g => g.id === id ? { ...g, position: pos } : g))}
            onDeleteGuide={(id) => setGuides(gs => gs.filter(g => g.id !== id))}
            onClearGuides={() => setGuides([])}
            visible={showRulers}
          />

          {/* Layout Grid Overlay */}
          <GridOverlay
            grids={layoutGrids}
            canvasWidth={canvasSize.width}
            canvasHeight={canvasSize.height}
            zoom={viewport.zoom}
            panX={viewport.panX}
            panY={viewport.panY}
          />

          {/* Prototype flow arrows */}
          <FlowArrowsOverlay
            interactions={protoInteractions}
            shapes={drawing.state.shapes}
            zoom={viewport.zoom}
            panX={viewport.panX}
            panY={viewport.panY}
            width={canvasSize.width}
            height={canvasSize.height}
            activeId={null}
            connectingFrom={protoConnectingFrom}
            cursorPos={protoCanvasCursor}
            onArrowClick={() => setShowPrototype(true)}
          />

          {/* Minimap navigator */}
          <MinimapNavigator
            shapes={drawing.state.shapes}
            zoom={viewport.zoom}
            panX={viewport.panX}
            panY={viewport.panY}
            canvasWidth={canvasSize.width}
            canvasHeight={canvasSize.height}
            visible={showMinimap}
            onToggle={() => setShowMinimap(v => !v)}
            onPanTo={(px, py) => window.dispatchEvent(new CustomEvent('canvas:panto', { detail: { panX: px, panY: py } }))}
          />

          {/* Prototype hotspot overlays */}
          <PrototypeHotspots
            interactions={protoInteractions}
            shapes={drawing.state.shapes}
            zoom={viewport.zoom}
            panX={viewport.panX}
            panY={viewport.panY}
            connectingFrom={protoConnectingFrom}
            active={showPrototype}
            onShapeClick={(id) => {
              if (protoConnectingFrom) {
                // Complete the connection
                if (id !== protoConnectingFrom) {
                  const newLink: Interaction = {
                    id: Math.random().toString(36).slice(2, 10),
                    fromShapeId: protoConnectingFrom,
                    toShapeId: id,
                    trigger: 'click',
                    action: 'navigate',
                    transition: 'dissolve',
                    easing: 'ease-in-out',
                    duration: 300,
                    delay: 0,
                    color: '#6366f1',
                  };
                  setProtoInteractions(prev => [...prev, newLink]);
                }
                setProtoConnectingFrom(null);
                setProtoCanvasCursor(null);
              } else {
                drawing.select(id);
                setShowPrototype(true);
              }
            }}
          />

          {/* Shape Annotations Overlay */}
          <ShapeAnnotationsOverlay
            active={annotationsActive}
            zoom={viewport.zoom}
            panX={viewport.panX}
            panY={viewport.panY}
            width={canvasSize.width}
            height={canvasSize.height}
            annotations={annotations}
            onAdd={(ann) => setAnnotations(prev => [...prev, ann])}
            onUpdate={(id, changes) => setAnnotations(prev => prev.map(a => a.id === id ? { ...a, ...changes } : a))}
            onDelete={(id) => setAnnotations(prev => prev.filter(a => a.id !== id))}
          />

          {/* Annotations list panel */}
          <AnnotationsListPanel
            annotations={annotations}
            active={annotationsActive}
            onToggleActive={() => setAnnotationsActive(a => !a)}
            onDelete={(id) => setAnnotations(prev => prev.filter(a => a.id !== id))}
            onUpdate={(id, changes) => setAnnotations(prev => prev.map(a => a.id === id ? { ...a, ...changes } : a))}
            onClear={() => setAnnotations([])}
            onExport={() => {
              const json = JSON.stringify(annotations, null, 2);
              const blob = new Blob([json], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'annotations.json';
              a.click();
              URL.revokeObjectURL(url);
              showToast('Annotations exported', 'action');
            }}
          />

          {/* Redline / measurement overlay */}
          <RedlineOverlay
            active={showRedlines}
            shapes={drawing.state.shapes}
            selectedId={drawing.state.selectedId}
            zoom={viewport.zoom}
            panX={viewport.panX}
            panY={viewport.panY}
            width={canvasSize.width}
            height={canvasSize.height}
          />

          {/* Quick Actions Bar */}
          <QuickActionsBar
            selectedShape={selectedShape ?? null}
            selectedShapeIds={drawing.state.selectedIds.length > 0 ? drawing.state.selectedIds : (drawing.state.selectedId ? [drawing.state.selectedId] : [])}
            shapes={drawing.state.shapes}
            zoom={viewport.zoom}
            panX={viewport.panX}
            panY={viewport.panY}
            canvasWidth={canvasSize.width}
            canvasHeight={canvasSize.height}
            onDuplicate={() => { drawing.duplicate(); }}
            onDelete={() => { drawing.deleteSelected(); }}
            onToggleLock={() => {
              const s = selectedShape;
              if (s) drawingRef.current.updateShape(s.id, { locked: !s.locked });
            }}
            onToggleHide={() => {
              const s = selectedShape;
              if (s) drawingRef.current.updateShape(s.id, { hidden: !s.hidden });
            }}
            onBringToFront={() => drawing.bringToFront()}
            onSendToBack={() => drawing.sendToBack()}
            onFlipH={() => {
              const s = selectedShape;
              if (s) drawingRef.current.updateShape(s.id, { flipX: !s.flipX });
            }}
            onFlipV={() => {
              const s = selectedShape;
              if (s) drawingRef.current.updateShape(s.id, { flipY: !s.flipY });
            }}
            onOpacityChange={(opacity) => {
              const ids = drawing.state.selectedIds.length > 0 ? drawing.state.selectedIds : (drawing.state.selectedId ? [drawing.state.selectedId] : []);
              for (const id of ids) drawingRef.current.updateShape(id, { opacity });
            }}
            onCopyStyle={() => {
              const s = selectedShape;
              if (!s) return;
              setCopiedStyle({
                fill: s.fill, fillType: s.fillType, fillOpacity: s.fillOpacity,
                gradientStops: s.gradientStops, gradientAngle: s.gradientAngle,
                stroke: s.stroke, strokeWidth: s.strokeWidth,
                borderRadius: s.borderRadius,
                opacity: s.opacity,
                shadows: s.shadows,
                noiseOpacity: s.noiseOpacity,
                filterBlur: s.filterBlur, filterBrightness: s.filterBrightness,
              });
              showToast('Style copied', 'action');
            }}
            onPasteStyle={() => {
              if (!copiedStyle) return;
              const ids = drawing.state.selectedIds.length > 0 ? drawing.state.selectedIds : (drawing.state.selectedId ? [drawing.state.selectedId] : []);
              for (const id of ids) drawingRef.current.updateShape(id, copiedStyle);
              showToast(`Style applied to ${ids.length} shape${ids.length !== 1 ? 's' : ''}`, 'action');
            }}
            hasCopiedStyle={copiedStyle !== null}
            enabled={showQuickActions}
          />

          {/* Smart Spacing Advisor overlay — gap lines rendered over canvas */}
          {showSpacingAdvisor && (
            <SmartSpacingAdvisor
              shapes={drawing.state.shapes}
              selectedIds={drawing.state.selectedIds.length > 0 ? drawing.state.selectedIds : (drawing.state.selectedId ? [drawing.state.selectedId] : [])}
              zoom={viewport.zoom}
              panX={viewport.panX}
              panY={viewport.panY}
              canvasWidth={canvasSize.width}
              canvasHeight={canvasSize.height}
              visible={showSpacingAdvisor}
              onApplyFix={(patches) => {
                for (const p of patches) {
                  const { id, ...rest } = p;
                  drawingRef.current.updateShape(id, rest);
                }
                showToast('Spacing fix applied', 'action');
              }}
            />
          )}

          {/* Layout Inspector overlay (⌘⇧3) */}
          <LayoutInspectorOverlay
            shapes={drawing.state.shapes}
            selectedIds={drawing.state.selectedIds.length > 0 ? drawing.state.selectedIds : (drawing.state.selectedId ? [drawing.state.selectedId] : [])}
            zoom={viewport.zoom}
            panX={viewport.panX}
            panY={viewport.panY}
            canvasWidth={canvasSize.width}
            canvasHeight={canvasSize.height}
            active={showLayoutInspector}
          />

          {/* Breakpoint Ruler Overlay (⌘⇧⌥K) */}
          <BreakpointRulerOverlay
            open={showBreakpointRuler}
            zoom={viewport.zoom}
            panX={viewport.panX}
            canvasWidth={canvasSize.width}
            canvasHeight={canvasSize.height}
          />

          {/* Focus Mode — dims canvas except selected shapes (⌘⇧F) */}
          <FocusMode
            shapes={drawing.state.shapes}
            selectedIds={drawing.state.selectedIds.length > 0 ? drawing.state.selectedIds : (drawing.state.selectedId ? [drawing.state.selectedId] : [])}
            zoom={viewport.zoom}
            panX={viewport.panX}
            panY={viewport.panY}
            canvasWidth={canvasSize.width}
            canvasHeight={canvasSize.height}
            active={focusModeActive}
            onExit={() => setFocusModeActive(false)}
          />

          {/* Live Cursor Presence (⌘⇧P) */}
          <CursorPresence
            canvasWidth={canvasSize.width}
            canvasHeight={canvasSize.height}
            active={showCursorPresence}
          />

          {/* Canvas Status Bar */}
          <CanvasStatusBar
            zoom={viewport.zoom}
            panX={viewport.panX}
            panY={viewport.panY}
            selectedShape={selectedShape ?? null}
            selectedShapeIds={drawing.state.selectedIds.length > 0 ? drawing.state.selectedIds : (drawing.state.selectedId ? [drawing.state.selectedId] : [])}
            totalShapes={drawing.state.shapes.length}
            showRulers={showRulers}
            onToggleRulers={() => setShowRulers(r => !r)}
            gridCount={layoutGrids.filter(g => g.visible).length}
            onToggleGrid={() => setShowGridSystem(v => !v)}
            onZoomReset={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: '0', metaKey: true, bubbles: true }))}
            onZoomFit={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: '1', metaKey: true, bubbles: true }))}
            cursorX={canvasCursorScreen.x}
            cursorY={canvasCursorScreen.y}
          />
        </div>

        <ChatBar
          messages={chat.messages}
          isStreaming={chat.isStreaming}
          streamingContent={chat.streamingContent}
          selection={canvas.selection}
          selectedShape={selectedShape}
          onSend={chat.send}
          onAbort={chat.abort}
          onClearSelection={canvas.clearSelection}
          collapseSignal={chatCollapseSignal}
        />
      </div>

      {/* Text Styles Panel */}
      <TextStylesPanel
        open={showTextStyles}
        onClose={() => setShowTextStyles(false)}
        styles={textStyles}
        onStylesChange={setTextStyles}
        selectedShapeIds={drawing.state.selectedIds.length > 0 ? drawing.state.selectedIds : (drawing.state.selectedId ? [drawing.state.selectedId] : [])}
        shapes={drawing.state.shapes}
        onApplyStyle={(ids, style) => {
          for (const id of ids) {
            drawingRef.current.updateShape(id, {
              fontFamily: style.fontFamily,
              fontSize: style.fontSize,
              fontWeight: String(style.fontWeight),
              color: style.color,
              lineHeight: style.lineHeight,
              letterSpacing: Math.round(style.letterSpacing * 100),
              fontStyle: style.fontStyle,
            });
          }
          showToast(`Applied "${style.name}" to ${ids.length} shape${ids.length !== 1 ? 's' : ''}`, 'action');
        }}
      />

      {/* Palette Extractor Panel */}
      <PaletteExtractorPanel
        open={showPaletteExtractor}
        onClose={() => setShowPaletteExtractor(false)}
        shapes={drawing.state.shapes}
        onSelectShapes={(ids) => {
          if (ids.length > 0) {
            drawingRef.current.select(ids[0]);
          }
        }}
      />

      {/* Template Gallery */}
      <TemplateGallery
        open={showTemplateGallery}
        onClose={() => setShowTemplateGallery(false)}
        onInsert={(partialShapes) => {
          const ids: string[] = [];
          for (const s of partialShapes) {
            const id = uuid();
            const base = defaultShape((s.type ?? 'rectangle') as Shape['type'], id);
            const merged = { ...base, ...s, id } as Shape;
            drawingRef.current.addShape(merged);
            ids.push(id);
          }
          if (ids.length > 0) drawingRef.current.select(ids[0]);
          showToast(`Template inserted (${partialShapes.length} shapes)`, 'action');
        }}
        insertX={-viewport.panX / viewport.zoom + 80}
        insertY={-viewport.panY / viewport.zoom + 80}
      />

      {/* Auto Layout Panel */}
      <AutoLayoutPanel
        open={showAutoLayout}
        onClose={() => setShowAutoLayout(false)}
        selectedShapes={(() => {
          const ids = drawing.state.selectedIds.length > 1
            ? drawing.state.selectedIds
            : drawing.state.selectedId ? [drawing.state.selectedId] : [];
          return drawing.state.shapes.filter(s => ids.includes(s.id));
        })()}
        onUpdateShapes={(updates) => {
          for (const u of updates) drawingRef.current.updateShape(u.id, { x: u.x, y: u.y });
          showToast('Auto layout applied', 'action');
        }}
      />

      {/* Layer Effects Panel */}
      <LayerEffectsPanel
        open={showLayerEffects}
        onClose={() => setShowLayerEffects(false)}
        shape={drawing.state.shapes.find(s => s.id === drawing.state.selectedId) ?? null}
        onUpdate={(patch) => {
          if (drawing.state.selectedId) drawingRef.current.updateShape(drawing.state.selectedId, patch);
        }}
      />

      {/* Color Blindness Simulator */}
      <ColorBlindPanel
        open={showColorBlind}
        onClose={() => setShowColorBlind(false)}
        activeFilter={colorBlindFilter}
        onFilterChange={setColorBlindFilter}
      />

      {/* Content Fill panel */}
      <ContentFillPanel
        open={showContentFill}
        onClose={() => setShowContentFill(false)}
        selectedShapeIds={drawing.state.selectedIds.length > 0 ? drawing.state.selectedIds : (drawing.state.selectedId ? [drawing.state.selectedId] : [])}
        shapes={drawing.state.shapes}
        onUpdateShapes={(ids, patch) => {
          for (const id of ids) drawingRef.current.updateShape(id, patch);
        }}
        onUpdateText={(id, text) => drawingRef.current.updateShape(id, { text })}
      />

      {/* Prototype / Interaction panel */}
      <PrototypePanel
        open={showPrototype}
        onClose={() => setShowPrototype(false)}
        interactions={protoInteractions}
        onChange={setProtoInteractions}
        shapes={drawing.state.shapes}
        selectedShapeId={drawing.state.selectedId}
        connectingFrom={protoConnectingFrom}
        onStartConnect={(id) => { setProtoConnectingFrom(id); setProtoCanvasCursor(null); }}
        onCancelConnect={() => { setProtoConnectingFrom(null); setProtoCanvasCursor(null); }}
      />

      {/* AI Quick Styles Panel (⌘⇧J) */}
      {showAIQuickStyles && (
        <AIQuickSuggestionsPanel
          shape={drawing.state.shapes.find(s => s.id === drawing.state.selectedId) ?? null}
          visible={showAIQuickStyles}
          onClose={() => setShowAIQuickStyles(false)}
          onApply={(patch) => {
            const id = drawing.state.selectedId;
            if (!id) return;
            // Map shadow string → shadows array if provided
            const shapePatch: Partial<Shape> = {};
            if (patch.fill !== undefined) shapePatch.fill = patch.fill;
            if (patch.stroke !== undefined) shapePatch.stroke = patch.stroke;
            if (patch.strokeWidth !== undefined) shapePatch.strokeWidth = patch.strokeWidth;
            if (patch.opacity !== undefined) shapePatch.opacity = patch.opacity;
            if (patch.borderRadius !== undefined) shapePatch.borderRadius = patch.borderRadius;
            if (patch.color !== undefined) shapePatch.color = patch.color;
            if (patch.blur !== undefined) shapePatch.filterBlur = patch.blur;
            drawingRef.current.updateShape(id, shapePatch);
            showToast('Style applied', 'action');
          }}
          style={{
            position: 'fixed',
            top: 80,
            right: 300,
            zIndex: 35,
          }}
        />
      )}

      {/* Focus Mode (⌘⇧F) */}
      {/* Rendered inside the canvas container via portal-like absolute positioning */}

      {/* Cursor Presence Panel (⌘⇧P) */}
      {showPresencePanel && (
        <CursorPresencePanel
          collaborators={[
            { id: 'alex', name: 'Alex Chen', avatar: 'AC', color: '#f59e0b', isTyping: false },
            { id: 'maya', name: 'Maya Patel', avatar: 'MP', color: '#06b6d4', isTyping: false },
            { id: 'sam', name: 'Sam Rivera', avatar: 'SR', color: '#22c55e', isTyping: false },
            { id: 'jordan', name: 'Jordan Kim', avatar: 'JK', color: '#f43f5e', isTyping: false },
          ]}
          visible={showPresencePanel}
          onClose={() => { setShowPresencePanel(false); setShowCursorPresence(false); }}
          style={{
            position: 'fixed',
            top: 80,
            right: showAIQuickStyles ? 560 : 300,
            zIndex: 35,
          }}
        />
      )}

      {/* Color Contrast Checker (⌘⇧2) */}
      <ColorContrastPanel
        open={showColorContrast}
        onClose={() => setShowColorContrast(false)}
        shapes={drawing.state.shapes}
        selectedShape={drawing.state.shapes.find(s => s.id === drawing.state.selectedId) ?? null}
      />

      {/* Gradient Editor Panel (⌘⇧⌥G) */}
      <GradientEditorPanel
        open={showGradientEditor}
        onClose={() => setShowGradientEditor(false)}
        shape={drawing.state.shapes.find(s => s.id === drawing.state.selectedId) ?? null}
        onApply={(css, stops, type, angle) => {
          const id = drawing.state.selectedId;
          if (!id) return;
          // Map to shape gradient properties
          const sortedStops = [...stops].sort((a, b) => a.position - b.position);
          const gradFillType = type === 'radial' ? 'radial-gradient' : 'linear-gradient';
          drawingRef.current.updateShape(id, {
            fillType: gradFillType as 'linear-gradient' | 'radial-gradient',
            gradientStops: sortedStops.map(s => ({ color: s.color, position: s.position / 100 })),
            gradientAngle: angle,
          });
          showToast('Gradient applied', 'action');
        }}
      />

      {/* Keyframe Timeline (⌘⇧⌥T) */}
      <KeyframeTimeline
        open={showKeyframeTimeline}
        onClose={() => setShowKeyframeTimeline(false)}
        shapeName={drawing.state.shapes.find(s => s.id === drawing.state.selectedId)?.name}
        onExportCSS={(css) => {
          const blob = new Blob([css], { type: 'text/css' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'animation.css';
          a.click();
          URL.revokeObjectURL(url);
          showToast('CSS exported', 'action');
        }}
        onPreview={(animName, duration, delay, iterations) => {
          showToast(`Preview: ${animName} ${duration}ms`, 'info');
        }}
      />

      {/* Asset Library Panel (⌘⌥L) */}
      <AssetLibraryPanel
        open={showAssetLibrary}
        onClose={() => setShowAssetLibrary(false)}
        onInsert={(asset: LibraryAsset) => {
          const drawing = drawingRef.current;
          const cx = canvasSize.width / 2;
          const cy = canvasSize.height / 2;
          const maxW = 400;
          const scale = asset.width > maxW ? maxW / asset.width : 1;
          const w = Math.round(asset.width * scale);
          const h = Math.round(asset.height * scale);
          const x = Math.round((cx - viewport.panX) / viewport.zoom - w / 2);
          const y = Math.round((cy - viewport.panY) / viewport.zoom - h / 2);
          const shape = defaultShape('rectangle', uuid());
          drawing.addShape({
            ...shape,
            x, y,
            width: w,
            height: h,
            fillType: 'image' as const,
            imageUrl: asset.dataUrl,
            name: asset.name,
          });
          showToast(`Inserted "${asset.name}"`, 'action');
        }}
      />

      {/* Smart Rename Panel (⌘⇧R) */}
      <SmartRenamePanel
        open={showSmartRename}
        onClose={() => setShowSmartRename(false)}
        shapes={drawing.state.shapes}
        onRenameShapes={(renames) => {
          for (const { id, name } of renames) {
            drawingRef.current.updateShape(id, { name });
          }
          showToast(`Renamed ${renames.length} shape${renames.length !== 1 ? 's' : ''}`, 'action');
        }}
      />

      {/* Canvas Compare Panel (⌘⇧C) */}
      <CanvasComparePanel
        open={showCanvasCompare}
        onClose={() => setShowCanvasCompare(false)}
        onCaptureCanvas={async () => {
          const el = canvasContainerRef.current;
          if (!el) return null;
          // Use html2canvas if available, otherwise fall back to SVG export
          try {
            // Attempt to use the browser's canvas capture API
            const canvasEl = el.querySelector('canvas') as HTMLCanvasElement | null;
            if (canvasEl) {
              return canvasEl.toDataURL('image/png');
            }
          } catch { /* ignore */ }
          // Fallback: create a simple placeholder PNG
          const fallback = document.createElement('canvas');
          fallback.width = el.clientWidth || 800;
          fallback.height = el.clientHeight || 600;
          const ctx = fallback.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#131320';
            ctx.fillRect(0, 0, fallback.width, fallback.height);
            ctx.fillStyle = 'rgba(99,102,241,0.3)';
            ctx.font = '16px system-ui';
            ctx.fillText(`Canvas snapshot – ${drawing.state.shapes.length} shapes`, 20, 30);
          }
          return fallback.toDataURL('image/png');
        }}
      />

      {/* Motion Preview Panel (⌘⇧⌥M) */}
      <MotionPreviewPanel
        open={showMotionPreview}
        onClose={() => setShowMotionPreview(false)}
        selectedShape={drawing.state.shapes.find(s => s.id === drawing.state.selectedId) ?? null}
      />

      {/* Moodboard Panel (⌘⇧⌥B) */}
      <MoodboardPanel
        open={showMoodboard}
        onClose={() => setShowMoodboard(false)}
        shapes={drawing.state.shapes}
        onApplyPalette={(colorMap) => {
          for (const { shapeId, color } of colorMap) {
            drawingRef.current.updateShape(shapeId, { fill: color });
          }
          showToast('Palette applied to shapes', 'action');
        }}
        onGenerateShapes={(theme: MoodTheme) => {
          // Generate 5 sample shapes in theme colors
          const colors = theme.palette;
          const sizes = [
            { w: 320, h: 200, x: 80, y: 80 },
            { w: 140, h: 140, x: 420, y: 80 },
            { w: 200, h: 60, x: 420, y: 240 },
            { w: 100, h: 100, x: 640, y: 80 },
            { w: 100, h: 100, x: 640, y: 200 },
          ];
          sizes.forEach((s, i) => {
            const shape = defaultShape('rectangle', uuid());
            drawingRef.current.addShape({
              ...shape,
              x: s.x, y: s.y, width: s.w, height: s.h,
              fill: colors[i % colors.length],
              borderRadius: 8,
              name: `${theme.name} ${i + 1}`,
            });
          });
          showToast(`Generated ${theme.name} moodboard`, 'action');
        }}
      />

      {/* Micro-interaction Builder (⌘⌥I) */}
      <MicroInteractionPanel
        open={showMicroInteraction}
        onClose={() => setShowMicroInteraction(false)}
        selectedShape={drawing.state.shapes.find(s => s.id === drawing.state.selectedId) ?? null}
      />

      {/* Grid Duplicator Panel (⌘⇧⌥D) */}
      <GridDuplicatorPanel
        open={showGridDuplicator}
        onClose={() => setShowGridDuplicator(false)}
        selectedShape={drawing.state.shapes.find(s => s.id === drawing.state.selectedId) ?? null}
        onDuplicate={(patches: ShapePatch[]) => {
          const sourceId = drawing.state.selectedId;
          const source = sourceId ? drawing.state.shapes.find(s => s.id === sourceId) : null;
          if (!source) return;
          for (const patch of patches) {
            const newShape = defaultShape(source.type, uuid());
            drawing.addShape({
              ...source,
              ...newShape,
              id: newShape.id,
              x: patch.x,
              y: patch.y,
              rotation: patch.rotation ?? source.rotation,
              opacity: patch.opacity ?? source.opacity,
              name: source.name ? `${source.name} copy` : `${source.type} copy`,
            });
          }
          showToast(`Created ${patches.length} copies`, 'action');
        }}
      />

      {/* Consistency Auditor Panel (⌘⇧⌥Q) */}
      {showConsistencyAudit && (
        <ConsistencyAuditorPanel
          open={showConsistencyAudit}
          onClose={() => setShowConsistencyAudit(false)}
          shapes={drawing.state.shapes}
          canvasWidth={canvasSize.width}
          canvasHeight={canvasSize.height}
          onSelectShape={(id) => {
            drawingRef.current.select(id);
            setActiveTool('cursor');
          }}
          onPatchShape={(id, patch) => drawingRef.current.updateShape(id, patch)}
          onPatchAll={(patches) => {
            for (const { id, patch } of patches) drawingRef.current.updateShape(id, patch);
            showToast(`Fixed ${patches.length} issues`, 'action');
          }}
        />
      )}

      {/* Perspective Grid Overlay (⌘⇧⌥G) */}
      <PerspectiveGridOverlay
        open={showPerspectiveGrid}
        canvasWidth={canvasSize.width}
        canvasHeight={canvasSize.height}
        zoom={viewport.zoom}
        panX={viewport.panX}
        panY={viewport.panY}
      />

      {/* CSS Snippet Panel (⌘⌥X) */}
      <CSSSnippetPanel
        open={showCSSSnippet}
        onClose={() => setShowCSSSnippet(false)}
        selectedShape={drawing.state.shapes.find(s => s.id === drawing.state.selectedId) ?? null}
      />

      {/* Spacing Heatmap Overlay (⌘⌥W) */}
      <SpacingHeatmapOverlay
        open={showSpacingHeatmap}
        shapes={drawing.state.shapes}
        zoom={viewport.zoom}
        panX={viewport.panX}
        panY={viewport.panY}
        canvasWidth={canvasSize.width}
        canvasHeight={canvasSize.height}
      />

      {/* Design Diff Panel (⌘⌥V) */}
      <DesignDiffPanel
        open={showDesignDiff}
        onClose={() => setShowDesignDiff(false)}
        shapes={drawing.state.shapes}
      />

      {/* Shape Variations Panel (⌘⌥Z) */}
      <ShapeVariationsPanel
        open={showShapeVariations}
        onClose={() => setShowShapeVariations(false)}
        selectedShape={drawing.state.shapes.find(s => s.id === drawing.state.selectedId) ?? null}
        onCommit={(patches: VariationPatch[]) => {
          const sourceId = drawing.state.selectedId;
          const source = sourceId ? drawing.state.shapes.find(s => s.id === sourceId) : null;
          if (!source) return;
          for (const patch of patches) {
            const newShape = defaultShape(source.type, uuid());
            drawing.addShape({
              ...source, ...newShape, id: newShape.id,
              x: patch.x, y: patch.y,
              width: patch.width ?? source.width,
              height: patch.height ?? source.height,
              fill: patch.fill ?? source.fill,
              opacity: patch.opacity ?? source.opacity,
              borderRadius: patch.borderRadius ?? source.borderRadius,
              rotation: patch.rotation ?? source.rotation,
              strokeWidth: patch.strokeWidth ?? source.strokeWidth,
              name: source.name ? `${source.name} var` : `${source.type} var`,
            });
          }
          showToast(`Placed ${patches.length} variations`, 'action');
        }}
      />

      {/* Global Search Panel (⌘⌥F) */}
      {showGlobalSearch && (
        <GlobalSearchPanel
          open={showGlobalSearch}
          onClose={() => setShowGlobalSearch(false)}
          shapes={drawing.state.shapes}
          onSelectShapes={(ids) => {
            if (ids.length === 1) {
              drawingRef.current.select(ids[0]);
            } else {
              drawingRef.current.setSelectedIds(ids);
            }
            setActiveTool('cursor');
          }}
          onPatchShapes={(patches) => {
            for (const { id, patch } of patches) drawingRef.current.updateShape(id, patch);
            showToast(`Updated ${patches.length} shapes`, 'action');
          }}
          onDeleteShapes={(ids) => {
            for (const id of ids) {
              drawingRef.current.select(id);
              drawingRef.current.deleteSelected();
            }
            showToast(`Deleted ${ids.length} shapes`, 'action');
          }}
        />
      )}

      {/* Color Vision Overlay (⌘⌥B) */}
      <ColorVisionOverlay
        open={showColorVision}
        canvasWidth={canvasSize.width}
        canvasHeight={canvasSize.height}
      />

      {/* Path Inspector Panel (⌘⌥P) */}
      <PathInspectorPanel
        open={showPathInspector}
        onClose={() => setShowPathInspector(false)}
        selectedShape={selectedShape}
        onPatchShape={(patch) => {
          if (selectedShape) drawingRef.current.updateShape(selectedShape.id, patch);
        }}
      />

      {/* Font Pairing Studio (⌘⌥Y) */}
      <FontPairingPanel
        open={showFontPairing}
        onClose={() => setShowFontPairing(false)}
        selectedShape={selectedShape}
        onApplyFont={(patch) => {
          if (selectedShape) {
            drawingRef.current.updateShape(selectedShape.id, patch);
            showToast(`Applied font: ${(patch as { fontFamily?: string }).fontFamily ?? 'font'}`, 'action');
          }
        }}
      />

      {/* Easing Curve Editor (⌘⌥E) */}
      <EasingCurvePanel
        open={showEasingCurve}
        onClose={() => setShowEasingCurve(false)}
        selectedShape={selectedShape}
        onApplyEasing={(easing, dur) => {
          if (selectedShape) {
            drawingRef.current.updateShape(selectedShape.id, { transitionEasing: easing, transitionDuration: dur });
            showToast(`Applied easing to "${selectedShape.name}"`, 'action');
          }
        }}
      />

      {/* Typography Specimen Panel (⌘⇧⌥Y) */}
      <TypographySpecimenPanel
        open={showTypographySpecimen}
        onClose={() => setShowTypographySpecimen(false)}
        selectedShape={drawing.state.shapes.find(s => s.id === drawing.state.selectedId) ?? null}
        onApplyFont={(fontFamily, fontWeight) => {
          const id = drawing.state.selectedId;
          if (id) {
            drawingRef.current.updateShape(id, {
              fontFamily,
              ...(fontWeight ? { fontWeight: String(fontWeight) } : {}),
            });
            showToast(`Font: ${fontFamily}`, 'action');
          }
        }}
      />

      {/* Keyboard shortcuts overlay */}
      <KeyboardShortcutsOverlay open={showShortcuts} onClose={() => setShowShortcuts(false)} />

      {/* Design system panel */}
      <DesignSystemPanel
        open={showDesignSystem}
        onClose={() => setShowDesignSystem(false)}
        shapes={drawing.state.shapes}
      />

      {/* Color replace panel */}
      <ColorReplacePanel
        open={showColorReplace}
        onClose={() => setShowColorReplace(false)}
        shapes={drawing.state.shapes}
        onReplaceColor={handleReplaceColor}
      />

      {/* Custom fonts panel */}
      <CustomFontsPanel
        open={showCustomFonts}
        onClose={() => setShowCustomFonts(false)}
        fonts={customFonts}
        onFontsChange={setCustomFonts}
      />

      {/* Quick Insert panel (I key) */}
      <QuickInsertPanel
        open={showQuickInsert}
        onClose={() => setShowQuickInsert(false)}
        onInsert={(shapes) => {
          for (const s of shapes) drawingRef.current.addShape(s);
          showToast(`Inserted ${shapes.length > 1 ? `${shapes.length} shapes` : shapes[0]?.name ?? 'element'}`, 'action');
          analytics.track('quick_insert', { count: shapes.length });
        }}
        insertX={80}
        insertY={80}
      />

      {/* Color Palettes Library (⇧K) */}
      <ColorPalettesPanel
        open={showColorPalettes}
        onClose={() => setShowColorPalettes(false)}
        onApplyColor={(hex) => {
          const d = drawingRef.current;
          const { selectedId, selectedIds: sIds } = d.state;
          const ids = sIds.length > 0 ? sIds : (selectedId ? [selectedId] : []);
          if (ids.length > 0) {
            for (const id of ids) d.updateShape(id, { fill: hex });
            showToast(`Applied ${hex.toUpperCase()} to ${ids.length} shape${ids.length > 1 ? 's' : ''}`, 'action');
          } else {
            navigator.clipboard.writeText(hex).catch(() => {});
            showToast(`Copied ${hex.toUpperCase()} to clipboard`, 'action');
          }
        }}
      />

      {/* Design Lint Panel (⇧L) */}
      <DesignLintPanel
        open={showDesignLint}
        onClose={() => setShowDesignLint(false)}
        shapes={drawing.state.shapes}
        onSelectShape={(id) => {
          drawingRef.current.select(id);
          setShowDesignLint(false);
        }}
      />

      {/* Find & Replace Text Panel (⌘⇧H) */}
      <FindReplacePanel
        open={showFindReplace}
        onClose={() => setShowFindReplace(false)}
        shapes={drawing.state.shapes}
        onReplaceOne={(shapeId, newText) => {
          drawingRef.current.updateShape(shapeId, { text: newText });
          showToast('Replaced text', 'action');
        }}
        onReplaceAll={(patches) => {
          for (const { id, text } of patches) {
            drawingRef.current.updateShape(id, { text });
          }
          showToast(`Replaced in ${patches.length} layer${patches.length !== 1 ? 's' : ''}`, 'action');
        }}
        onSelectShape={(id) => {
          drawingRef.current.select(id);
        }}
      />

      {/* Typography Scale Panel (⌘⇧T) */}
      <TypeScalePanel
        open={showTypeScale}
        onClose={() => setShowTypeScale(false)}
        shapes={drawing.state.shapes}
        selectedId={drawing.state.selectedId}
        onApplyToShape={(shapeId, fontSize) => {
          drawingRef.current.updateShape(shapeId, { fontSize });
          showToast(`Font size set to ${fontSize}px`, 'action');
        }}
        onApplyToSelected={(fontSize) => {
          const id = drawingRef.current.state.selectedId;
          if (id) {
            drawingRef.current.updateShape(id, { fontSize });
            showToast(`Font size set to ${fontSize}px`, 'action');
          }
        }}
      />

      {/* Color Harmony Panel (⌘⇧Y) */}
      <ColorHarmonyPanel
        open={showColorHarmony}
        onClose={() => setShowColorHarmony(false)}
        seedColor={(() => {
          const id = drawing.state.selectedId;
          if (!id) return undefined;
          const s = drawing.state.shapes.find(sh => sh.id === id);
          return s?.fill?.startsWith('#') ? s.fill.slice(0, 7) : undefined;
        })()}
        onApplyColor={(color) => {
          const id = drawingRef.current.state.selectedId;
          if (id) {
            drawingRef.current.updateShape(id, { fill: color, fillType: 'solid' });
            showToast(`Applied ${color}`, 'action');
          } else {
            navigator.clipboard.writeText(color).catch(() => {});
            showToast(`Copied ${color}`, 'action');
          }
        }}
      />

      {/* Theme Customizer Panel (⌘⇧P) */}
      <ThemeCustomizerPanel
        open={showThemeCustomizer}
        onClose={() => setShowThemeCustomizer(false)}
      />

      {/* Developer Spec Panel (⌘⇧E) */}
      <DevSpecPanel
        open={showDevSpec}
        onClose={() => setShowDevSpec(false)}
        shape={drawing.state.selectedId ? drawing.state.shapes.find(s => s.id === drawing.state.selectedId) ?? null : null}
      />

      {/* Shape Spotlight Search (⌘F) */}
      <ShapeSpotlight
        open={showSpotlight}
        onClose={() => setShowSpotlight(false)}
        shapes={drawing.state.shapes}
        onSelect={(id) => {
          drawingRef.current.select(id);
          setActiveTool('cursor');
          showToast('Shape selected', 'action');
        }}
      />

      {/* History Browser Panel (⌘⌥H) */}
      {showHistoryBrowser && (
        <HistoryBrowserPanel
          entries={drawing.historyEntries}
          currentIndex={drawing.historyIndex}
          onJump={(index) => { drawing.jumpToHistory(index); }}
          onClose={() => setShowHistoryBrowser(false)}
        />
      )}

      {/* Batch Rename Panel (⌘⇧B) */}
      {showBatchRename && (
        <BatchRenamePanel
          shapes={drawing.state.shapes}
          selectedIds={drawing.state.selectedIds.length > 0 ? drawing.state.selectedIds : (drawing.state.selectedId ? [drawing.state.selectedId] : [])}
          onRename={(patches) => {
            for (const { id, name } of patches) {
              drawingRef.current.updateShape(id, { name });
            }
            showToast(`Renamed ${patches.length} layer${patches.length !== 1 ? 's' : ''}`, 'action');
          }}
          onClose={() => setShowBatchRename(false)}
        />
      )}

      {/* Color Scheme Panel (⌘⇧O) */}
      {showColorScheme && (
        <ColorSchemePanel
          shapes={drawing.state.shapes}
          onApplyPatches={(patches) => {
            for (const { id, patch } of patches) {
              drawingRef.current.updateShape(id, patch);
            }
            showToast(`Applied color scheme to ${patches.length} shapes`, 'action');
          }}
          onClose={() => setShowColorScheme(false)}
        />
      )}

      {/* Gradient Mesh Panel (⌘⇧G) */}
      <GradientMeshPanel
        open={showGradientMesh}
        onClose={() => setShowGradientMesh(false)}
        onApply={(dataUrl) => {
          const d = drawingRef.current;
          const { selectedId, shapes: shs } = d.state;
          if (selectedId) {
            // Apply as image fill to selected shape
            d.updateShape(selectedId, { fillType: 'image', imageUrl: dataUrl, imageFit: 'fill' });
            showToast('Gradient mesh applied as fill', 'action');
          } else {
            // Insert a new rectangle with the mesh as fill
            const newShape = {
              ...defaultShape('rectangle', uuid()),
              x: 80, y: 80,
              width: 400, height: 300,
              fillType: 'image' as const, imageUrl: dataUrl, imageFit: 'fill' as const,
              stroke: 'transparent', strokeWidth: 0,
              borderRadius: 12,
              name: 'Gradient Mesh',
            };
            d.addShape(newShape);
            d.select(newShape.id);
            showToast('Gradient mesh inserted', 'action');
          }
          setShowGradientMesh(false);
        }}
      />

      {/* Animation Tween Panel */}
      <AnimationTweenPanel
        open={showAnimationTween}
        onClose={() => setShowAnimationTween(false)}
        selectedShape={selectedShape}
      />

      {/* Style Presets Panel (⌘⇧Y) */}
      <StylePresetsPanel
        open={showStylePresets}
        onClose={() => setShowStylePresets(false)}
        selectedShape={selectedShape}
        selectedShapeIds={drawing.state.selectedIds.length > 0
          ? drawing.state.selectedIds
          : (drawing.state.selectedId ? [drawing.state.selectedId] : [])}
        onApply={(ids, patch) => {
          for (const id of ids) drawingRef.current.updateShape(id, patch);
          showToast('Style preset applied', 'action');
        }}
        onPreview={(ids, patch) => {
          for (const id of ids) drawingRef.current.updateShape(id, patch);
        }}
        onPreviewEnd={(_ids) => {
          drawingRef.current.undo();
        }}
      />

      {/* Image Fill Panel (⌘⇧I) */}
      <ImageFillPanel
        open={showImageFill}
        onClose={() => setShowImageFill(false)}
        selectedShape={selectedShape}
        selectedShapeIds={drawing.state.selectedIds.length > 0
          ? drawing.state.selectedIds
          : (drawing.state.selectedId ? [drawing.state.selectedId] : [])}
        onApplyFill={(ids, imageUrl) => {
          for (const id of ids) {
            drawingRef.current.updateShape(id, { fillType: 'image', imageUrl, imageFit: 'fill' });
          }
          showToast('Image fill applied', 'action');
        }}
      />

      {/* Fluid Type Panel (⌘⇧⌥F) */}
      <FluidTypePanel
        open={showFluidType}
        onClose={() => setShowFluidType(false)}
        selectedShape={selectedShape}
        selectedShapeIds={drawing.state.selectedIds.length > 0
          ? drawing.state.selectedIds
          : (drawing.state.selectedId ? [drawing.state.selectedId] : [])}
        onApplyFontSize={(ids, fontSize) => {
          for (const id of ids) drawingRef.current.updateShape(id, { fontSize });
          showToast(`Font size applied`, 'action');
        }}
      />

      {/* Shadow Studio Panel (⌘⇧W) */}
      <ShadowStudioPanel
        open={showShadowStudio}
        onClose={() => setShowShadowStudio(false)}
        selectedShape={selectedShape}
        selectedShapeIds={drawing.state.selectedIds.length > 0
          ? drawing.state.selectedIds
          : (drawing.state.selectedId ? [drawing.state.selectedId] : [])}
        onApply={(ids, shadows) => {
          for (const id of ids) drawingRef.current.updateShape(id, { shadows, shadow: shadows.length > 0 });
          showToast('Shadows applied', 'action');
        }}
      />

      {/* UI Blocks Library (⌘⇧U) */}
      <UIBlocksLibrary
        open={showUIBlocks}
        onClose={() => setShowUIBlocks(false)}
        onInsert={(shapes, blockName) => {
          const d = drawingRef.current;
          for (const shape of shapes) {
            d.addShape(shape);
          }
          showToast(`${blockName} inserted`, 'action');
          setShowUIBlocks(false);
        }}
      />

      {/* Particle Effect Panel (⌘⇧⌥P) */}
      <ParticleEffectPanel
        open={showParticles}
        onClose={() => setShowParticles(false)}
        selectedShape={selectedShape}
        selectedShapeIds={drawing.state.selectedIds.length > 0
          ? drawing.state.selectedIds
          : (drawing.state.selectedId ? [drawing.state.selectedId] : [])}
        onApplyBackground={(ids, cssBackground) => {
          for (const id of ids) {
            drawingRef.current.updateShape(id, { fillType: 'image', imageUrl: cssBackground.replace(/^url\("/, '').replace(/"\)$/, ''), imageFit: 'fill' });
          }
          showToast('Particle effect applied', 'action');
        }}
      />

      {/* Color Grading Panel (⌘⇧L) */}
      <ColorGradingPanel
        open={showColorGrading}
        onClose={() => setShowColorGrading(false)}
        selectedShape={selectedShape}
        selectedShapeIds={drawing.state.selectedIds.length > 0
          ? drawing.state.selectedIds
          : (drawing.state.selectedId ? [drawing.state.selectedId] : [])}
        onApply={(ids, patch) => {
          for (const id of ids) drawingRef.current.updateShape(id, patch);
        }}
      />

      {/* Motion Path Panel (⌘⇧⌥A) */}
      <MotionPathPanel
        open={showMotionPath}
        onClose={() => setShowMotionPath(false)}
        selectedShape={selectedShape}
      />

      {/* Design Tokens Panel (⌘⇧⌥D) */}
      <DesignTokensPanel
        open={showDesignTokens}
        onClose={() => setShowDesignTokens(false)}
        shapes={drawing.state.shapes}
        selectedShape={selectedShape}
        selectedShapeIds={drawing.state.selectedIds.length > 0
          ? drawing.state.selectedIds
          : (drawing.state.selectedId ? [drawing.state.selectedId] : [])}
        tokens={designTokens}
        bindings={tokenBindings}
        onTokensChange={setDesignTokens}
        onBindingsChange={setTokenBindings}
        onApplyToken={(ids, property, value) => {
          for (const id of ids) {
            const patch: Record<string, unknown> = {};
            if (property === 'borderRadius') patch.borderRadius = typeof value === 'string' ? parseFloat(value) : value;
            else if (property === 'fontSize') patch.fontSize = typeof value === 'string' ? parseFloat(value) : value;
            else if (property === 'opacity') patch.opacity = typeof value === 'string' ? parseFloat(value) : value;
            else patch[property] = value;
            drawingRef.current.updateShape(id, patch as Parameters<typeof drawingRef.current.updateShape>[1]);
          }
          showToast('Token applied', 'action');
        }}
      />

      {/* Responsive Preview (⌘⇧⌥R) */}
      <ResponsivePreviewPanel
        open={showResponsivePreview}
        onClose={() => setShowResponsivePreview(false)}
        shapes={drawing.state.shapes}
        selectedShape={selectedShape}
      />

      {/* Theme Editor Panel (⌘⇧⌥T) */}
      <ThemeEditorPanel
        open={showThemeEditor}
        onClose={() => setShowThemeEditor(false)}
      />

      {/* Placeholder Content Panel (⌘⇧⌥H) */}
      <PlaceholderPanel
        open={showPlaceholder}
        onClose={() => setShowPlaceholder(false)}
        canvasCenterX={viewport.panX + (canvasSize.width / 2) / viewport.zoom}
        canvasCenterY={viewport.panY + (canvasSize.height / 2) / viewport.zoom}
        onInsert={(shapes, name) => {
          for (const s of shapes) drawingRef.current.addShape(s);
          showToast(`${name} inserted`, 'action');
        }}
      />

      {/* 3D Transform Studio (⌘⇧⌥3) */}
      <Transform3DPanel
        open={show3DTransform}
        onClose={() => setShow3DTransform(false)}
        selectedShape={selectedShape}
        selectedShapeIds={drawing.state.selectedIds.length > 0
          ? drawing.state.selectedIds
          : (drawing.state.selectedId ? [drawing.state.selectedId] : [])}
        onUpdate={(ids, patch) => {
          for (const id of ids) drawingRef.current.updateShape(id, patch);
        }}
      />

      {/* Noise & Texture Panel (⌘⇧⌥N) */}
      <NoiseTexturePanel
        open={showNoiseTexture}
        onClose={() => setShowNoiseTexture(false)}
        selectedShape={selectedShape}
        selectedShapeIds={drawing.state.selectedIds.length > 0
          ? drawing.state.selectedIds
          : (drawing.state.selectedId ? [drawing.state.selectedId] : [])}
        onUpdate={(ids, patch) => {
          for (const id of ids) drawingRef.current.updateShape(id, patch);
        }}
      />

      {/* Variable Font Panel (⌘⇧⌥V) */}
      <VariableFontPanel
        open={showVariableFont}
        onClose={() => setShowVariableFont(false)}
        selectedShape={selectedShape}
        selectedShapeIds={drawing.state.selectedIds.length > 0
          ? drawing.state.selectedIds
          : (drawing.state.selectedId ? [drawing.state.selectedId] : [])}
        onUpdate={(ids, patch) => {
          for (const id of ids) drawingRef.current.updateShape(id, patch);
        }}
      />

      {/* Component Variants Panel (⌘⇧⌥W) */}
      <VariantsPanel
        open={showVariants}
        onClose={() => setShowVariants(false)}
        selectedShape={selectedShape}
        onUpdate={(id, patch) => drawingRef.current.updateShape(id, patch)}
      />

      {/* Design Intelligence Panel (⌘⇧⌥I) */}
      <DesignIntelPanel
        open={showDesignIntel}
        onClose={() => setShowDesignIntel(false)}
        shapes={drawing.state.shapes}
        selectedShapeIds={drawing.state.selectedIds.length > 0
          ? drawing.state.selectedIds
          : (drawing.state.selectedId ? [drawing.state.selectedId] : [])}
        onSelectShape={(id) => { drawing.select(id); }}
      />

      {/* Generative Art Panel (⌘⇧⌥G) */}
      <GenerativeArtPanel
        open={showGenerativeArt}
        onClose={() => setShowGenerativeArt(false)}
        selectedShape={selectedShape}
        selectedShapeIds={drawing.state.selectedIds.length > 0
          ? drawing.state.selectedIds
          : (drawing.state.selectedId ? [drawing.state.selectedId] : [])}
        onApply={(ids, patch) => {
          for (const id of ids) drawingRef.current.updateShape(id, patch);
          showToast('Generative art applied', 'action');
        }}
      />

      {/* Grid System Panel (⌘⇧⌥L) */}
      <GridSystemPanel
        open={showGridSystem}
        onClose={() => setShowGridSystem(false)}
        grids={layoutGrids}
        onGridsChange={setLayoutGrids}
      />

      {/* Pattern Fill Panel (⌘⇧⌥B) */}
      <PatternFillPanel
        open={showPatternFill}
        onClose={() => setShowPatternFill(false)}
        selectedShape={selectedShape}
        selectedShapeIds={drawing.state.selectedIds.length > 0
          ? drawing.state.selectedIds
          : (drawing.state.selectedId ? [drawing.state.selectedId] : [])}
        onApplyToShape={(ids, cssBackground) => {
          // Extract the SVG data URI from the full background value and use it as imageUrl
          const dataUriMatch = cssBackground.match(/url\("([^"]+)"\)/);
          const dataUri = dataUriMatch ? dataUriMatch[1] : '';
          for (const id of ids) {
            drawingRef.current.updateShape(id, { fillType: 'image', imageUrl: dataUri, imageFit: 'tile' });
          }
          showToast('Pattern applied', 'action');
        }}
        onApplyToCanvas={(cssBackground) => {
          // Set as a CSS custom property on the root element for the canvas to pick up
          document.documentElement.style.setProperty('--canvas-pattern-override', cssBackground || 'none');
          showToast('Canvas pattern set', 'action');
        }}
      />

      {/* Morph Blend Panel (⌘⇧⌥M) */}
      <MorphBlendPanel
        open={showMorphBlend}
        onClose={() => setShowMorphBlend(false)}
        shapes={drawing.state.shapes}
        selectedShapeIds={drawing.state.selectedIds.length > 0
          ? drawing.state.selectedIds
          : (drawing.state.selectedId ? [drawing.state.selectedId] : [])}
        onInsertShapes={(shapesToInsert) => {
          for (const s of shapesToInsert) drawingRef.current.addShape(s);
          showToast(`${shapesToInsert.length} blend shapes inserted`, 'action');
        }}
      />

      {/* Batch Export Panel (⌘⇧⌥E) */}
      <BatchExportPanel
        open={showBatchExport}
        onClose={() => setShowBatchExport(false)}
        shapes={drawing.state.shapes}
        selectedShapeIds={drawing.state.selectedIds.length > 0
          ? drawing.state.selectedIds
          : (drawing.state.selectedId ? [drawing.state.selectedId] : [])}
      />

      {/* Accessibility Panel (⌘⇧⌥X) */}
      <AccessibilityPanel
        open={showAccessibility}
        onClose={() => setShowAccessibility(false)}
        shapes={drawing.state.shapes}
        onSelectShape={(id) => {
          drawing.select(id);
          setShowAccessibility(false);
        }}
      />

      {/* Presentation Mode (F5) */}
      <PresentationMode
        open={showPresentation}
        onClose={() => setShowPresentation(false)}
        shapes={drawing.state.shapes}
        startFrameId={presentationStartId}
      />

      {/* Clip Path Editor (⌘⇧⌥Q) */}
      <ClipPathEditor
        open={showClipPath}
        onClose={() => setShowClipPath(false)}
        selectedShape={selectedShape}
        selectedShapeIds={drawing.state.selectedIds.length > 0
          ? drawing.state.selectedIds
          : (drawing.state.selectedId ? [drawing.state.selectedId] : [])}
        onApplyClipPath={(ids, clipPath) => {
          for (const id of ids) drawingRef.current.updateShape(id, { clipPath });
          showToast('Clip path applied', 'action');
        }}
      />

      {/* Code Export Panel (⌘⇧/) */}
      {showCodeExport && (
        <CodeExportPanel
          shapes={drawing.state.shapes}
          selectedIds={drawing.state.selectedIds.length > 0
            ? drawing.state.selectedIds
            : (drawing.state.selectedId ? [drawing.state.selectedId] : [])}
          onClose={() => setShowCodeExport(false)}
        />
      )}

      {/* Frame Sorter Panel (⌘⌥S) */}
      {showFrameSorter && (
        <FrameSorterPanel
          shapes={drawing.state.shapes}
          onClose={() => setShowFrameSorter(false)}
          onReorder={(newOrder) => { drawing.reorderShapes(newOrder); }}
          onFocusFrame={(id) => {
            drawing.select(id);
            setShowFrameSorter(false);
          }}
          selectedId={drawing.state.selectedId}
        />
      )}

      {/* Canvas Snapshots Panel (⌘⇧M) */}
      <SnapshotsPanel
        open={showSnapshots}
        onClose={() => setShowSnapshots(false)}
        shapes={drawing.state.shapes}
        projectId={projectId}
        onRestore={(restoredShapes) => {
          drawing.loadShapes(restoredShapes);
        }}
      />

      {/* Device Mockup Panel (⇧U) */}
      <DeviceMockupPanel
        open={showDeviceMockup}
        onClose={() => setShowDeviceMockup(false)}
        onInsert={(device: MockupDevice) => {
          const d = drawingRef.current;
          const existing = d.state.shapes.filter(s => s.type === 'frame').length;
          const gapX = 80;
          const offsetX = existing * (device.width + gapX);
          const newFrame = {
            ...defaultShape('frame', uuid()),
            x: offsetX + 80,
            y: 80,
            width: device.screenWidth,
            height: device.screenHeight,
            name: device.name,
            fill: '#ffffff',
            stroke: '#e2e8f0',
            strokeWidth: 1,
          };
          d.addShape(newFrame);
          d.select(newFrame.id);
          showToast(`Added ${device.name} frame (${device.aspectLabel})`, 'action');
          analytics.track('device_frame_insert', { device: device.id });
        }}
      />

      {/* Icon Picker (⇧I) */}
      <IconPickerPanel
        open={showIconPicker}
        onClose={() => setShowIconPicker(false)}
        onInsert={(iconName, size, color) => {
          const d = drawingRef.current;
          // Place near top-left of canvas with small stagger to avoid stacking
          const existing = d.state.shapes.filter(s => s.iconId).length;
          const newShape = {
            ...defaultShape('rectangle', uuid()),
            x: 80 + existing * 8,
            y: 80 + existing * 8,
            width: size,
            height: size,
            fill: 'transparent',
            stroke: 'transparent',
            strokeWidth: 0,
            name: iconName,
            iconId: iconName,
            iconColor: color,
            iconSize: size,
          };
          d.addShape(newShape);
          showToast(`Inserted ${iconName} icon`, 'action');
        }}
      />

      {/* Command palette */}
      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        commands={buildCommands({
          drawing: drawingRef,
          setActiveTool,
          showToast,
          setShowShortcuts,
          setPresentationMode,
          setLeftCollapsed,
          setRightCollapsed,
          setLeftTab,
          setShowDesignSystem,
          setShowColorReplace: (v: boolean) => setShowColorReplace(v),
          setShowCustomFonts: (v: boolean) => setShowCustomFonts(v),
          setShowQuickInsert: (v: boolean) => setShowQuickInsert(v),
          setShowColorPalettes: (v: boolean) => setShowColorPalettes(v),
          setShowIconPicker: (v: boolean) => setShowIconPicker(v),
          setShowDeviceMockup: (v: boolean) => setShowDeviceMockup(v),
          setShowDesignLint: (v: boolean) => setShowDesignLint(v),
          setShowFindReplace: (v: boolean) => setShowFindReplace(v),
          setShowTypeScale: (v: boolean) => setShowTypeScale(v),
          setShowColorHarmony: (v: boolean) => setShowColorHarmony(v),
          setShowThemeCustomizer: (v: boolean) => setShowThemeCustomizer(v),
          setShowDevSpec: (v: boolean) => setShowDevSpec(v),
          setShowSnapshots: (v: boolean) => setShowSnapshots(v),
          setShowHistoryBrowser: (fn) => setShowHistoryBrowser(fn),
          setShowBatchRename: (fn) => setShowBatchRename(fn),
          setShowFrameSorter: (fn) => setShowFrameSorter(fn),
          setShowCodeExport: (fn) => setShowCodeExport(fn),
          setShowColorScheme: (fn) => setShowColorScheme(fn),
          setShowGradientMesh: (fn) => setShowGradientMesh(fn),
          setShowRulers: (fn) => setShowRulers(fn),
          setGuides,
          setShowAnimationTween: (fn) => setShowAnimationTween(fn),
          setShowStylePresets: (fn) => setShowStylePresets(fn),
          setShowMotionPath: (fn) => setShowMotionPath(fn),
          setAnnotationsActive: (fn) => setAnnotationsActive(fn),
          setShowImageFill: (fn) => setShowImageFill(fn),
          setShowColorGrading: (fn) => setShowColorGrading(fn),
          setShowParticles: (fn) => setShowParticles(fn),
          setShowShadowStudio: (fn) => setShowShadowStudio(fn),
          setShowUIBlocks: (fn) => setShowUIBlocks(fn),
          setShowFluidType: (fn) => setShowFluidType(fn),
          setShowClipPath: (fn) => setShowClipPath(fn),
          setShowPresentation: (v) => setShowPresentation(v),
          setPresentationStartId: (id) => setPresentationStartId(id),
          setShowAccessibility: (fn) => setShowAccessibility(fn),
          setShowDesignTokens: (fn) => setShowDesignTokens(fn),
          setShowBatchExport: (fn) => setShowBatchExport(fn),
          setShowPatternFill: (fn) => setShowPatternFill(fn),
          setShowMorphBlend: (fn) => setShowMorphBlend(fn),
          setShowResponsivePreview: (fn) => setShowResponsivePreview(fn),
          setShowThemeEditor: (fn) => setShowThemeEditor(fn),
          setShowPlaceholder: (fn) => setShowPlaceholder(fn),
          setShow3DTransform: (fn) => setShow3DTransform(fn),
          setShowNoiseTexture: (fn) => setShowNoiseTexture(fn),
          setShowVariableFont: (fn) => setShowVariableFont(fn),
          setShowVariants: (fn) => setShowVariants(fn),
          setShowDesignIntel: (fn) => setShowDesignIntel(fn),
          setShowGenerativeArt: (fn) => setShowGenerativeArt(fn),
          setShowGridSystem: (fn) => setShowGridSystem(fn),
          setShowPrototype: (fn) => setShowPrototype(fn),
          setShowContentFill: (fn) => setShowContentFill(fn),
          setShowColorBlind: (fn) => setShowColorBlind(fn),
          setShowTextStyles: (fn) => setShowTextStyles(fn),
          setShowPaletteExtractor: (fn) => setShowPaletteExtractor(fn),
          setShowTemplateGallery: (fn) => setShowTemplateGallery(fn),
          setShowAutoLayout: (fn) => setShowAutoLayout(fn),
          setShowLayerEffects: (fn) => setShowLayerEffects(fn),
          shapes: drawing.state.shapes,
          onSelectShape: (id: string) => { drawing.select(id); setLeftCollapsed(false); setLeftTab('layers'); setCommandPaletteOpen(false); },
        })}
      />

      {/* Sticky note placing mode indicator */}
      {stickyNotesPlacing && (
        <div style={{
          position: 'fixed', bottom: 64, left: '50%', transform: 'translateX(-50%)',
          background: '#fef08a', color: '#713f12',
          border: '2px solid #eab308',
          borderRadius: 8, padding: '8px 16px',
          fontSize: 12, fontWeight: 600,
          pointerEvents: 'none',
          zIndex: 9998,
          boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
          display: 'flex', alignItems: 'center', gap: 8,
          whiteSpace: 'nowrap',
        }}>
          📝 Click anywhere on the canvas to place a sticky note · Esc to cancel
        </div>
      )}

      {/* Toast notifications */}
      {toast && (
        <div
          key={toast.id}
          style={{
            position: 'fixed',
            bottom: 48,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(20,20,30,0.92)',
            color: toast.kind === 'action' ? 'var(--accent)' : 'var(--text)',
            border: `1px solid ${toast.kind === 'action' ? 'rgba(99,102,241,0.35)' : 'var(--border)'}`,
            borderRadius: 8,
            padding: '7px 16px',
            fontSize: 12,
            fontWeight: 500,
            backdropFilter: 'blur(12px)',
            pointerEvents: 'none',
            userSelect: 'none',
            zIndex: 9999,
            boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
            animation: 'fadeInUp 0.15s ease',
            whiteSpace: 'nowrap',
          }}
        >
          {toast.message}
        </div>
      )}

      {/* Right panel — smooth collapse via width transition */}
      <div
        style={{
          width: rightCollapsed ? 0 : 280,
          flexShrink: 0,
          overflow: 'hidden',
          borderLeft: rightCollapsed ? 'none' : '1px solid var(--border)',
          background: 'var(--panel)',
          transition: 'width 0.18s cubic-bezier(0.4,0,0.2,1)',
          position: 'relative',
        }}
      >
        {/* Inner wrapper keeps content at full width so it doesn't squish during animation */}
        <div style={{ width: 280, height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {/* Right panel header with collapse button */}
          <div style={{
            height: 36, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
            padding: '0 6px 0 10px',
            borderBottom: '1px solid var(--border)',
          }}>
            <span style={{ flex: 1, fontSize: 10, fontWeight: 600, color: 'var(--subtle)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              {selectedShape ? 'Properties' : 'Design'}
            </span>
            <button
              onClick={() => setRightCollapsed(c => !c)}
              title="Hide panel (⌘⇧\)"
              style={{
                width: 26, height: 26,
                background: 'none', border: 'none',
                color: 'var(--subtle)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: 5, flexShrink: 0,
                transition: 'color 0.12s, background 0.12s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.color = 'var(--text)';
                e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = 'var(--subtle)';
                e.currentTarget.style.background = 'none';
              }}
            >
              {/* Double-chevron right = collapse rightward */}
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M6 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.4"/>
              </svg>
            </button>
          </div>

          {/* Panel content (no longer conditionally rendered — stays mounted for smooth animation) */}
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {showShapeInspect && (
              <ShapeInspectPanel shape={selectedShape!} onPreview={handleShapePreview} onChange={handleShapeChange} allShapes={drawing.state.shapes} />
            )}
            {showElementInspect && (
              <InspectPanel
                selection={canvas.selection!}
                isPatching={silentPatch.isPatching}
                onPatch={silentPatch.patch}
              />
            )}
            {showMultiSelect && !showShapeInspect && (
              <MultiSelectPanel
                shapes={drawing.state.shapes}
                selectedIds={drawing.state.selectedIds}
                onUpdateShapes={(patches) => patches.forEach(({ id, patch }) => drawingRef.current.updateShape(id, patch))}
                onTidyUp={() => { drawing.tidyUp(); showToast('Tidy up', 'action'); }}
                onRepeatGrid={(cols, rows, gapX, gapY) => {
                  const ids = drawing.state.selectedIds;
                  if (ids.length === 0) return;
                  const allSelected = drawing.state.shapes.filter(s => ids.includes(s.id));
                  // Bounding box of selection
                  const selMinX = Math.min(...allSelected.map(s => s.x));
                  const selMinY = Math.min(...allSelected.map(s => s.y));
                  const selMaxX = Math.max(...allSelected.map(s => s.x + s.width));
                  const selMaxY = Math.max(...allSelected.map(s => s.y + s.height));
                  const selW = selMaxX - selMinX;
                  const selH = selMaxY - selMinY;
                  const stepX = selW + gapX;
                  const stepY = selH + gapY;
                  // Create copies (skip 0,0 — that's the original)
                  for (let row = 0; row < rows; row++) {
                    for (let col = 0; col < cols; col++) {
                      if (row === 0 && col === 0) continue; // skip original position
                      const offX = col * stepX;
                      const offY = row * stepY;
                      for (const s of allSelected) {
                        const newShape = { ...s, id: uuid(), x: s.x + offX, y: s.y + offY };
                        drawingRef.current.addShape(newShape);
                      }
                    }
                  }
                  showToast(`Created ${cols * rows} grid copies`, 'action');
                }}
                onArrange={(type) => {
                  const ids = drawing.state.selectedIds;
                  if (ids.length < 2) { showToast('Select 2+ shapes', 'info'); return; }
                  const allSelected = drawing.state.shapes.filter(s => ids.includes(s.id));
                  const n = allSelected.length;
                  const cx = allSelected.reduce((sum, s) => sum + s.x + s.width / 2, 0) / n;
                  const cy = allSelected.reduce((sum, s) => sum + s.y + s.height / 2, 0) / n;

                  if (type === 'circle') {
                    const r = Math.max(120, allSelected.reduce((sum, s) => sum + Math.max(s.width, s.height), 0) / n * 2);
                    allSelected.forEach((s, i) => {
                      const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
                      drawingRef.current.updateShape(s.id, { x: cx + r * Math.cos(angle) - s.width / 2, y: cy + r * Math.sin(angle) - s.height / 2 });
                    });
                    showToast(`Arranged ${n} shapes in a circle`, 'action');
                  } else if (type === 'arc') {
                    const r = Math.max(140, allSelected.reduce((sum, s) => sum + Math.max(s.width, s.height), 0) / n * 2);
                    allSelected.forEach((s, i) => {
                      const angle = -Math.PI + (i / Math.max(1, n - 1)) * Math.PI;
                      drawingRef.current.updateShape(s.id, { x: cx + r * Math.cos(angle) - s.width / 2, y: cy + r * Math.sin(angle) - s.height / 2 });
                    });
                    showToast(`Arranged ${n} shapes in a semicircle`, 'action');
                  } else if (type === 'diagonal') {
                    const sorted = [...allSelected].sort((a, b) => (a.x + a.y) - (b.x + b.y));
                    const gap = 24;
                    sorted.forEach((s, i) => {
                      const step = i * (Math.max(s.width, s.height) + gap);
                      drawingRef.current.updateShape(s.id, { x: sorted[0].x + step, y: sorted[0].y + step });
                    });
                    showToast(`Arranged ${n} shapes diagonally`, 'action');
                  } else if (type === 'stack') {
                    for (const s of allSelected) {
                      drawingRef.current.updateShape(s.id, { x: cx - s.width / 2, y: cy - s.height / 2 });
                    }
                    showToast(`Stacked ${n} shapes at center`, 'action');
                  } else if (type === 'nudge-apart') {
                    const GAP = 8;
                    const ITERATIONS = 6;
                    const positions = allSelected.map(s => ({ id: s.id, x: s.x, y: s.y, w: s.width, h: s.height }));
                    for (let iter = 0; iter < ITERATIONS; iter++) {
                      for (let i = 0; i < positions.length; i++) {
                        for (let j = i + 1; j < positions.length; j++) {
                          const a = positions[i]; const b = positions[j];
                          const overlapX = Math.min(a.x + a.w + GAP, b.x + b.w + GAP) - Math.max(a.x, b.x);
                          const overlapY = Math.min(a.y + a.h + GAP, b.y + b.h + GAP) - Math.max(a.y, b.y);
                          if (overlapX > 0 && overlapY > 0) {
                            if (overlapX < overlapY) {
                              const half = overlapX / 2;
                              if (a.x < b.x) { a.x -= half; b.x += half; } else { a.x += half; b.x -= half; }
                            } else {
                              const half = overlapY / 2;
                              if (a.y < b.y) { a.y -= half; b.y += half; } else { a.y += half; b.y -= half; }
                            }
                          }
                        }
                      }
                    }
                    for (const pos of positions) {
                      drawingRef.current.updateShape(pos.id, { x: Math.round(pos.x), y: Math.round(pos.y) });
                    }
                    showToast(`Separated ${n} shapes`, 'action');
                  }
                }}
              />
            )}
            {!showShapeInspect && !showElementInspect && !showMultiSelect && (
              <DesignOverviewPanel
                shapes={drawing.state.shapes}
                onShowShortcuts={() => setShowShortcuts(true)}
                onOpenCommandPalette={() => setCommandPaletteOpen(true)}
                onShowDesignSystem={() => setShowDesignSystem(true)}
                onShowFindReplace={() => setShowFindReplace(true)}
                onShowColorHarmony={() => setShowColorHarmony(true)}
                onShowTypeScale={() => setShowTypeScale(true)}
                onShowDesignLint={() => setShowDesignLint(true)}
                onShowThemeCustomizer={() => setShowThemeCustomizer(true)}
                onShowDevSpec={() => setShowDevSpec(true)}
                onShowSnapshots={() => setShowSnapshots(true)}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Multi-select summary panel ────────────────────────────────────────────────
function MultiSelectPanel({ shapes, selectedIds, onUpdateShapes, onArrange, onRepeatGrid, onTidyUp }: {
  shapes: Shape[];
  selectedIds: string[];
  onUpdateShapes?: (patches: { id: string; patch: Partial<Shape> }[]) => void;
  onArrange?: (type: 'circle' | 'arc' | 'diagonal' | 'stack' | 'nudge-apart') => void;
  onRepeatGrid?: (cols: number, rows: number, gapX: number, gapY: number) => void;
  onTidyUp?: () => void;
}) {
  const selected = shapes.filter(s => selectedIds.includes(s.id));
  const count = selected.length;

  // Bounding box
  const minX = Math.min(...selected.map(s => s.x));
  const minY = Math.min(...selected.map(s => s.y));
  const maxX = Math.max(...selected.map(s => s.x + s.width));
  const maxY = Math.max(...selected.map(s => s.y + s.height));
  const bw = Math.round(maxX - minX);
  const bh = Math.round(maxY - minY);

  // Type breakdown
  const typeCounts: Record<string, number> = {};
  for (const s of selected) typeCounts[s.type] = (typeCounts[s.type] ?? 0) + 1;

  // Shared opacity
  const opacities = selected.map(s => Math.round(s.opacity * 100));
  const sharedOpacity = opacities.every(o => o === opacities[0]) ? opacities[0] : null;
  const [opacityLocal, setOpacityLocal] = useState(sharedOpacity ?? 100);
  useEffect(() => { setOpacityLocal(sharedOpacity ?? 100); }, [sharedOpacity]);

  // Shared fill color
  const fills = selected.map(s => (s.fillType === 'solid' ? s.fill : null));
  const sharedFill = fills.every(f => f === fills[0] && f !== null) ? fills[0] : null;

  // Lock/hide state (mixed = some locked, some not)
  const allLocked = selected.every(s => s.locked);
  const allHidden = selected.every(s => s.hidden);
  const someLocked = selected.some(s => s.locked);
  const someHidden = selected.some(s => s.hidden);

  const labelSt: React.CSSProperties = { fontSize: 11, color: 'var(--muted)', fontWeight: 500 };
  const valueSt: React.CSSProperties = { fontSize: 12, color: 'var(--text)', fontFamily: 'monospace', fontWeight: 600 };
  const sectionTitleSt: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 };

  const batchUpdate = (patch: Partial<Shape>) =>
    onUpdateShapes?.(selectedIds.map(id => ({ id, patch })));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: 'var(--panel)', fontSize: 12 }}>
      {/* Header */}
      <div style={{
        height: 44, flexShrink: 0, display: 'flex', alignItems: 'center',
        padding: '0 12px', gap: 8, borderBottom: '1px solid var(--border)',
      }}>
        <div style={{
          fontSize: 10, fontWeight: 700, color: 'var(--accent)',
          background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)',
          borderRadius: 4, padding: '2px 7px', flexShrink: 0,
        }}>
          {count}
        </div>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', flex: 1 }}>
          shapes selected
        </span>
        {/* Lock/hide batch toggles */}
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            title={allLocked ? 'Unlock all' : someLocked ? 'Lock remaining' : 'Lock all'}
            onClick={() => batchUpdate({ locked: !allLocked })}
            style={{
              background: allLocked ? 'rgba(251,191,36,0.12)' : 'none',
              border: `1px solid ${allLocked ? 'rgba(251,191,36,0.35)' : 'transparent'}`,
              borderRadius: 5, color: allLocked ? '#fbbf24' : someLocked ? 'var(--muted)' : 'var(--muted)',
              cursor: 'pointer', padding: '3px 5px',
              display: 'flex', alignItems: 'center',
              fontSize: 10, gap: 3,
            }}
          >
            <svg width="10" height="11" viewBox="0 0 11 12" fill="none">
              {allLocked ? (
                <>
                  <rect x="1.5" y="5" width="8" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M3.5 5V3.5a2 2 0 0 1 4 0V5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </>
              ) : (
                <>
                  <rect x="1.5" y="5" width="8" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M7.5 5V3.5a2 2 0 0 0-4 0" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </>
              )}
              <circle cx="5.5" cy="8" r="1" fill="currentColor"/>
            </svg>
          </button>
          <button
            title={allHidden ? 'Show all' : someHidden ? 'Hide remaining' : 'Hide all'}
            onClick={() => batchUpdate({ hidden: !allHidden })}
            style={{
              background: allHidden ? 'rgba(99,102,241,0.1)' : 'none',
              border: `1px solid ${allHidden ? 'rgba(99,102,241,0.3)' : 'transparent'}`,
              borderRadius: 5, color: allHidden ? 'var(--accent)' : 'var(--muted)',
              cursor: 'pointer', padding: '3px 5px',
              display: 'flex', alignItems: 'center',
            }}
          >
            {allHidden ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            )}
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Bounding box */}
        <div style={{ borderBottom: '1px solid var(--border)', padding: '10px 12px 12px' }}>
          <div style={sectionTitleSt}>Bounding Box</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px' }}>
            {([['X', Math.round(minX)], ['Y', Math.round(minY)], ['W', bw], ['H', bh]] as [string, number][]).map(([label, val]) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ ...labelSt, width: 14 }}>{label}</span>
                <span style={{ ...valueSt, flex: 1, background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 4, padding: '4px 6px' }}>
                  {val}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Batch appearance */}
        <div style={{ borderBottom: '1px solid var(--border)', padding: '10px 12px 14px' }}>
          <div style={sectionTitleSt}>Batch Edit</div>

          {/* Opacity */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={labelSt}>Opacity</span>
              <input
                type="range" min={0} max={100}
                value={opacityLocal}
                onChange={(e) => {
                  const v = parseInt(e.target.value);
                  setOpacityLocal(v);
                  batchUpdate({ opacity: v / 100 });
                }}
                style={{ flex: 1, accentColor: 'var(--accent)', cursor: 'pointer' }}
              />
              <span style={{ ...labelSt, width: 32, textAlign: 'right', fontFamily: 'monospace' }}>
                {sharedOpacity !== null ? `${opacityLocal}%` : '—'}
              </span>
            </div>
          </div>

          {/* Batch fill color */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={labelSt}>Fill</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
              <input
                type="color"
                value={sharedFill ?? '#6366f1'}
                onChange={(e) => batchUpdate({ fill: e.target.value, fillType: 'solid' })}
                style={{
                  width: 24, height: 24, border: '1px solid var(--border)', borderRadius: 4,
                  cursor: 'pointer', background: 'none', padding: 1,
                }}
                title="Apply fill color to all selected shapes"
              />
              <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'monospace' }}>
                {sharedFill ?? 'mixed'}
              </span>
            </div>
          </div>

          {/* Batch blend mode */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={labelSt}>Blend</span>
            <select
              value={selected.every(s => s.blendMode === selected[0].blendMode) ? (selected[0].blendMode ?? 'normal') : ''}
              onChange={(e) => { if (e.target.value) batchUpdate({ blendMode: e.target.value }); }}
              style={{
                flex: 1, background: 'var(--input-bg)', border: '1px solid var(--border)',
                borderRadius: 4, color: 'var(--text)', fontSize: 11, padding: '3px 6px',
                cursor: 'pointer',
              }}
            >
              {!selected.every(s => s.blendMode === selected[0].blendMode) && (
                <option value="">Mixed…</option>
              )}
              {['normal','multiply','screen','overlay','darken','lighten','color-dodge','color-burn','difference','exclusion','hue','saturation','color','luminosity'].map(m => (
                <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1).replace(/-/g,' ')}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Type breakdown */}
        <div style={{ padding: '10px 12px 12px', borderBottom: '1px solid var(--border)' }}>
          <div style={sectionTitleSt}>Selection</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {Object.entries(typeCounts).map(([type, n]) => (
              <div key={type} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: type === 'ellipse' ? '50%' : 2,
                    background: 'var(--accent)', opacity: 0.6,
                  }} />
                  <span style={{ ...labelSt, textTransform: 'capitalize' }}>{type}</span>
                </div>
                <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600,
                  background: 'rgba(99,102,241,0.08)', borderRadius: 4, padding: '1px 6px' }}>
                  {n}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick actions */}
        <div style={{ padding: '10px 12px 14px' }}>
          <div style={sectionTitleSt}>Quick Actions</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <ActionRow label="Group selection" shortcut="⌘G" onClick={() => {/* keyboard shortcut handles it */}} />
          </div>

          {/* Arrange shapes */}
          <div style={{ marginTop: 12 }}>
            <div style={{ ...sectionTitleSt, marginBottom: 6 }}>Arrange</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
              {([
                { label: 'Circle', icon: '◯', type: 'circle' as const, title: 'Arrange in a circle' },
                { label: 'Semicircle', icon: '◠', type: 'arc' as const, title: 'Arrange in a semicircle' },
                { label: 'Diagonal', icon: '↗', type: 'diagonal' as const, title: 'Arrange on diagonal' },
                { label: 'Stack', icon: '⊕', type: 'stack' as const, title: 'Stack centered' },
                { label: 'Separate', icon: '↔', type: 'nudge-apart' as const, title: 'Nudge overlapping shapes apart' },
              ]).map(({ label, icon, type, title }) => (
                <button
                  key={type}
                  title={title}
                  onClick={() => onArrange?.(type)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    background: 'var(--panel-alt)', border: '1px solid var(--border)',
                    borderRadius: 5, padding: '5px 8px', cursor: 'pointer',
                    color: 'var(--muted)', fontSize: 11, transition: 'all 0.1s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'rgba(99,102,241,0.07)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--panel-alt)'; }}
                >
                  <span style={{ fontSize: 13, lineHeight: 1 }}>{icon}</span>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Tidy Up */}
          {onTidyUp && (
            <div style={{ marginTop: 8 }}>
              <button
                onClick={onTidyUp}
                title="Arrange shapes in a neat grid (⌘⌥T)"
                style={{
                  width: '100%', height: 30, background: 'var(--panel-alt)',
                  border: '1px solid var(--border)', borderRadius: 5,
                  color: 'var(--muted)', cursor: 'pointer', fontSize: 11,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                  transition: 'all 0.1s',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)'; e.currentTarget.style.background = 'rgba(99,102,241,0.07)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--panel-alt)'; }}
              >
                <span style={{ fontSize: 13, lineHeight: 1 }}>⊞</span>
                Tidy Up — Arrange in Grid
                <span style={{ fontSize: 9, fontFamily: 'monospace', color: 'var(--subtle)' }}>⌘⌥T</span>
              </button>
            </div>
          )}

          {/* Grid Repeat */}
          <RepeatGridSection onRepeat={onRepeatGrid} />

          {/* Opacity Ramp */}
          <OpacityRampSection shapes={selected} onUpdateShapes={onUpdateShapes} />

          {/* Color Ramp */}
          <ColorRampSection shapes={selected} onUpdateShapes={onUpdateShapes} />

          {/* Batch Rename */}
          <BatchRenameSection shapes={selected} onUpdateShapes={onUpdateShapes} />

          <div style={{
            marginTop: 10, padding: '8px 10px',
            background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)',
            borderRadius: 6, fontSize: 11, color: 'var(--subtle)', lineHeight: 1.7,
          }}>
            <strong style={{ color: 'var(--muted)', display: 'block', marginBottom: 2 }}>Tip</strong>
            Use the alignment bar at the top of the canvas to align or distribute shapes.
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Opacity Ramp Section ──────────────────────────────────────────────────────

function OpacityRampSection({ shapes, onUpdateShapes }: {
  shapes: Shape[];
  onUpdateShapes?: (patches: { id: string; patch: Partial<Shape> }[]) => void;
}) {
  const [fromOp, setFromOp] = React.useState(100);
  const [toOp, setToOp] = React.useState(0);
  const [applied, setApplied] = React.useState(false);
  const n = shapes.length;

  const applyRamp = () => {
    if (n < 2) return;
    const patches = shapes.map((s, i) => {
      const t = i / (n - 1);
      const opacity = Math.round(fromOp + (toOp - fromOp) * t) / 100;
      return { id: s.id, patch: { opacity } };
    });
    onUpdateShapes?.(patches);
    setApplied(true);
    setTimeout(() => setApplied(false), 1500);
  };

  if (n < 2) return null;

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
        Opacity Ramp
      </div>
      {/* Preview bar */}
      <div style={{
        height: 10, borderRadius: 4, marginBottom: 8,
        background: `linear-gradient(to right, rgba(99,102,241,${fromOp/100}), rgba(99,102,241,${toOp/100}))`,
        border: '1px solid var(--border)',
      }} />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9.5, color: 'var(--subtle)', marginBottom: 3 }}>From</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input
              type="range" min={0} max={100} value={fromOp}
              onChange={e => setFromOp(parseInt(e.target.value))}
              style={{ flex: 1, accentColor: 'var(--accent)', cursor: 'pointer' }}
            />
            <span style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'monospace', width: 28, textAlign: 'right' }}>{fromOp}%</span>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9.5, color: 'var(--subtle)', marginBottom: 3 }}>To</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input
              type="range" min={0} max={100} value={toOp}
              onChange={e => setToOp(parseInt(e.target.value))}
              style={{ flex: 1, accentColor: 'var(--accent)', cursor: 'pointer' }}
            />
            <span style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'monospace', width: 28, textAlign: 'right' }}>{toOp}%</span>
          </div>
        </div>
      </div>
      <button
        onClick={applyRamp}
        style={{
          width: '100%', height: 26, borderRadius: 5,
          border: `1px solid ${applied ? 'rgba(34,197,94,0.5)' : 'var(--border)'}`,
          background: applied ? 'rgba(34,197,94,0.12)' : 'rgba(99,102,241,0.08)',
          color: applied ? '#22c55e' : 'var(--accent)',
          cursor: 'pointer', fontSize: 10, fontWeight: 600, transition: 'all 0.12s',
        }}
      >
        {applied ? '✓ Applied!' : `Ramp opacity across ${n} shapes`}
      </button>
    </div>
  );
}

// ── Color Ramp Section ────────────────────────────────────────────────────────

function ColorRampSection({ shapes, onUpdateShapes }: {
  shapes: Shape[];
  onUpdateShapes?: (patches: { id: string; patch: Partial<Shape> }[]) => void;
}) {
  const [fromColor, setFromColor] = React.useState('#6366f1');
  const [toColor, setToColor] = React.useState('#ec4899');
  const [applied, setApplied] = React.useState(false);
  const n = shapes.length;

  // Lerp two hex colors
  const lerpColor = (a: string, b: string, t: number): string => {
    const parse = (hex: string) => [
      parseInt(hex.slice(1, 3), 16),
      parseInt(hex.slice(3, 5), 16),
      parseInt(hex.slice(5, 7), 16),
    ];
    const [r1, g1, b1] = parse(a);
    const [r2, g2, b2] = parse(b);
    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const bv = Math.round(b1 + (b2 - b1) * t);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bv.toString(16).padStart(2, '0')}`;
  };

  const applyRamp = (target: 'fill' | 'stroke' | 'color') => {
    if (n < 2) return;
    const patches = shapes.map((s, i) => {
      const t = i / (n - 1);
      const color = lerpColor(fromColor, toColor, t);
      if (target === 'fill') return { id: s.id, patch: { fill: color, fillType: 'solid' as const } };
      if (target === 'stroke') return { id: s.id, patch: { stroke: color } };
      return { id: s.id, patch: { color } };
    });
    onUpdateShapes?.(patches);
    setApplied(true);
    setTimeout(() => setApplied(false), 1500);
  };

  if (n < 2) return null;

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
        Color Ramp
      </div>
      {/* Gradient preview */}
      <div style={{
        height: 14, borderRadius: 4, marginBottom: 8,
        background: `linear-gradient(to right, ${fromColor}, ${toColor})`,
        border: '1px solid var(--border)',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Step markers */}
        {n <= 12 && Array.from({ length: n }, (_, i) => (
          <div key={i} style={{
            position: 'absolute', top: 2, bottom: 2,
            left: `calc(${(i / (n - 1)) * 100}% - 1px)`,
            width: 2, borderRadius: 1,
            background: 'rgba(255,255,255,0.6)',
          }} />
        ))}
      </div>
      {/* Color pickers */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flex: 1 }}>
          <span style={{ fontSize: 9.5, color: 'var(--subtle)' }}>From</span>
          <input
            type="color" value={fromColor}
            onChange={e => setFromColor(e.target.value)}
            style={{ width: 22, height: 22, border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', background: 'none', padding: 1 }}
          />
          <span style={{ fontSize: 9.5, color: 'var(--muted)', fontFamily: 'monospace' }}>{fromColor}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flex: 1 }}>
          <span style={{ fontSize: 9.5, color: 'var(--subtle)' }}>To</span>
          <input
            type="color" value={toColor}
            onChange={e => setToColor(e.target.value)}
            style={{ width: 22, height: 22, border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', background: 'none', padding: 1 }}
          />
          <span style={{ fontSize: 9.5, color: 'var(--muted)', fontFamily: 'monospace' }}>{toColor}</span>
        </div>
      </div>
      {/* Apply buttons */}
      <div style={{ display: 'flex', gap: 4 }}>
        {(['fill', 'stroke', 'color'] as const).map(target => (
          <button
            key={target}
            onClick={() => applyRamp(target)}
            style={{
              flex: 1, height: 24, borderRadius: 5,
              border: `1px solid ${applied ? 'rgba(34,197,94,0.5)' : 'var(--border)'}`,
              background: applied ? 'rgba(34,197,94,0.1)' : 'var(--panel-alt)',
              color: applied ? '#22c55e' : 'var(--muted)',
              cursor: 'pointer', fontSize: 9.5, fontWeight: 600,
              transition: 'all 0.12s', textTransform: 'capitalize',
            }}
            onMouseEnter={e => { if (!applied) { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.35)'; e.currentTarget.style.background = 'rgba(99,102,241,0.07)'; } }}
            onMouseLeave={e => { if (!applied) { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--panel-alt)'; } }}
          >
            {target}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Batch Rename Section ──────────────────────────────────────────────────────

function BatchRenameSection({ shapes, onUpdateShapes }: {
  shapes: Shape[];
  onUpdateShapes?: (patches: { id: string; patch: Partial<Shape> }[]) => void;
}) {
  const [pattern, setPattern] = React.useState('');
  const [startNum, setStartNum] = React.useState(1);
  const [applied, setApplied] = React.useState(false);

  const preview = shapes.slice(0, 3).map((s, i) =>
    pattern.replace('{n}', String(startNum + i)).replace('{type}', s.type) || s.name || s.type
  );

  const applyRename = () => {
    if (!pattern.trim()) return;
    const patches = shapes.map((s, i) => ({
      id: s.id,
      patch: { name: pattern.replace('{n}', String(startNum + i)).replace('{type}', s.type) },
    }));
    onUpdateShapes?.(patches);
    setApplied(true);
    setTimeout(() => setApplied(false), 1500);
  };

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
        Batch Rename
      </div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
        <input
          placeholder='Pattern: "Button {n}" or "{type} {n}"'
          value={pattern}
          onChange={e => setPattern(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') applyRename(); }}
          style={{
            flex: 1, background: 'var(--input-bg)', border: '1px solid var(--border)',
            borderRadius: 5, color: 'var(--text)', fontSize: 10.5, padding: '4px 7px',
            outline: 'none',
          }}
          onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
          onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
        />
        <input
          type="number"
          value={startNum}
          min={0}
          onChange={e => setStartNum(Math.max(0, parseInt(e.target.value) || 1))}
          title="Starting number"
          style={{
            width: 36, background: 'var(--input-bg)', border: '1px solid var(--border)',
            borderRadius: 5, color: 'var(--text)', fontSize: 10.5, padding: '4px 5px',
            outline: 'none', textAlign: 'center',
          }}
        />
      </div>
      {pattern && (
        <div style={{ fontSize: 9.5, color: 'var(--subtle)', marginBottom: 4, fontStyle: 'italic', paddingLeft: 2 }}>
          Preview: {preview.join(' · ')}{shapes.length > 3 ? ' …' : ''}
        </div>
      )}
      <button
        onClick={applyRename}
        disabled={!pattern.trim()}
        style={{
          width: '100%', height: 26, borderRadius: 5,
          border: `1px solid ${applied ? 'rgba(34,197,94,0.5)' : 'var(--border)'}`,
          background: applied ? 'rgba(34,197,94,0.12)' : (pattern ? 'rgba(99,102,241,0.08)' : 'var(--panel-alt)'),
          color: applied ? '#22c55e' : (pattern ? 'var(--accent)' : 'var(--subtle)'),
          cursor: pattern ? 'pointer' : 'default', fontSize: 10, fontWeight: 600,
          transition: 'all 0.12s',
        }}
      >
        {applied ? '✓ Renamed!' : `Rename ${shapes.length} shapes`}
      </button>
      <div style={{ fontSize: 9, color: 'var(--subtle)', marginTop: 3, paddingLeft: 2 }}>
        Use <code style={{ color: 'var(--muted)' }}>{'{n}'}</code> for number, <code style={{ color: 'var(--muted)' }}>{'{type}'}</code> for shape type
      </div>
    </div>
  );
}

function RepeatGridSection({ onRepeat }: {
  onRepeat?: (cols: number, rows: number, gapX: number, gapY: number) => void;
}) {
  const [cols, setCols] = React.useState(3);
  const [rows, setRows] = React.useState(2);
  const [gapX, setGapX] = React.useState(16);
  const [gapY, setGapY] = React.useState(16);
  const [done, setDone] = React.useState(false);

  const handleRepeat = () => {
    onRepeat?.(cols, rows, gapX, gapY);
    setDone(true);
    setTimeout(() => setDone(false), 1500);
  };

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
        Repeat Grid
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 4, marginBottom: 6 }}>
        {([
          { label: 'Cols', value: cols, set: setCols, min: 1, max: 20 },
          { label: 'Rows', value: rows, set: setRows, min: 1, max: 20 },
          { label: 'Gap X', value: gapX, set: setGapX, min: 0, max: 200 },
          { label: 'Gap Y', value: gapY, set: setGapY, min: 0, max: 200 },
        ] as const).map(({ label, value, set, min, max }) => (
          <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 9, color: 'var(--subtle)', textAlign: 'center' }}>{label}</span>
            <input
              type="number"
              value={value}
              min={min}
              max={max}
              onChange={e => set(Math.max(min, Math.min(max, parseInt(e.target.value) || min)))}
              onKeyDown={e => e.stopPropagation()}
              style={{
                background: 'var(--input-bg)', border: '1px solid var(--border)',
                borderRadius: 4, color: 'var(--text)', fontSize: 11,
                padding: '3px 4px', textAlign: 'center', width: '100%',
                outline: 'none',
              }}
              onFocus={e => e.currentTarget.style.borderColor = 'var(--accent)'}
              onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
            />
          </div>
        ))}
      </div>
      {/* Preview label */}
      <div style={{ fontSize: 9.5, color: 'var(--subtle)', marginBottom: 4, fontStyle: 'italic' }}>
        Creates {cols}×{rows} = {cols * rows} copies with {gapX}px / {gapY}px gap
      </div>
      <button
        onClick={handleRepeat}
        disabled={!onRepeat}
        style={{
          width: '100%', height: 26, borderRadius: 5,
          border: `1px solid ${done ? 'rgba(34,197,94,0.5)' : 'var(--border)'}`,
          background: done ? 'rgba(34,197,94,0.12)' : 'rgba(99,102,241,0.08)',
          color: done ? '#22c55e' : 'var(--accent)',
          cursor: 'pointer', fontSize: 10, fontWeight: 600,
          transition: 'all 0.12s',
        }}
      >
        {done ? `✓ Created ${cols * rows} copies!` : `⊞ Create ${cols}×${rows} Grid`}
      </button>
    </div>
  );
}

function ActionRow({ label, shortcut, onClick }: { label: string; shortcut?: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        width: '100%', background: 'var(--panel-alt)', border: '1px solid var(--border)',
        borderRadius: 5, padding: '5px 8px', cursor: 'pointer',
        color: 'var(--text)', fontSize: 11, gap: 8, textAlign: 'left',
        transition: 'background 0.1s',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.08)'; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.3)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'var(--panel-alt)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
    >
      <span>{label}</span>
      {shortcut && <span style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'monospace' }}>{shortcut}</span>}
    </button>
  );
}

// ── Design overview panel (shown in right panel when nothing selected) ─────────

function OverviewAction({ label, shortcut, icon, onClick }: { label: string; shortcut?: string; icon?: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        width: '100%', background: 'var(--panel-alt)', border: '1px solid var(--border)',
        borderRadius: 5, padding: '5px 8px', cursor: 'pointer',
        color: 'var(--text)', fontSize: 11, gap: 8, textAlign: 'left',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.08)'; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.3)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'var(--panel-alt)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        {icon && <span style={{ fontSize: 12, opacity: 0.7 }}>{icon}</span>}
        {label}
      </span>
      {shortcut && <span style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'monospace' }}>{shortcut}</span>}
    </button>
  );
}

function DesignOverviewPanel({
  shapes,
  onShowShortcuts,
  onOpenCommandPalette,
  onShowDesignSystem,
  onShowFindReplace,
  onShowColorHarmony,
  onShowTypeScale,
  onShowDesignLint,
  onShowThemeCustomizer,
  onShowDevSpec,
  onShowSnapshots,
}: {
  shapes: Shape[];
  onShowShortcuts: () => void;
  onOpenCommandPalette: () => void;
  onShowDesignSystem?: () => void;
  onShowFindReplace?: () => void;
  onShowColorHarmony?: () => void;
  onShowTypeScale?: () => void;
  onShowDesignLint?: () => void;
  onShowThemeCustomizer?: () => void;
  onShowDevSpec?: () => void;
  onShowSnapshots?: () => void;
}) {
  // Extract unique colors from design
  const docColors = React.useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const s of shapes) {
      for (const c of [s.fill, s.stroke, s.color]) {
        if (c && c !== 'transparent' && /^#[0-9a-fA-F]{6}$/.test(c)) {
          const n = c.toLowerCase();
          if (!seen.has(n)) { seen.add(n); out.push(n); }
        }
      }
      for (const st of s.gradientStops ?? []) {
        const n = st.color.toLowerCase();
        if (!seen.has(n)) { seen.add(n); out.push(n); }
      }
    }
    return out.slice(0, 20);
  }, [shapes]);

  // Shape type counts
  const typeCounts = React.useMemo(() => {
    const m: Record<string, number> = {};
    for (const s of shapes) { m[s.type] = (m[s.type] ?? 0) + 1; }
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [shapes]);

  const panelSt: React.CSSProperties = {
    fontSize: 10, fontWeight: 700, color: 'var(--muted)',
    letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8,
  };
  const divSt: React.CSSProperties = {
    borderBottom: '1px solid var(--border)', padding: '10px 12px 12px',
  };

  if (shapes.length === 0) {
    return (
      <div style={{
        height: '100%', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 12, padding: 24, color: 'var(--muted)', textAlign: 'center',
      }}>
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none" style={{ opacity: 0.25 }}>
          <rect x="4" y="4" width="28" height="28" rx="5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M12 18h12M18 12v12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
            Canvas is empty
          </div>
          <span style={{ fontSize: 11, lineHeight: 1.6 }}>
            Draw shapes or use the<br />
            AI assistant to get started
          </span>
        </div>
        <button
          onClick={onShowShortcuts}
          style={{
            background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)',
            borderRadius: 6, color: 'var(--accent)', cursor: 'pointer',
            fontSize: 11, padding: '5px 12px',
            display: 'flex', alignItems: 'center', gap: 5,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.14)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.08)'; }}
        >
          <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>?</span>
          Keyboard shortcuts
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', fontSize: 12 }}>
      {/* Header */}
      <div style={{
        height: 44, flexShrink: 0, display: 'flex', alignItems: 'center',
        padding: '0 12px', gap: 8, borderBottom: '1px solid var(--border)',
      }}>
        <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Design
        </span>
        <span style={{
          fontSize: 10, fontWeight: 700, color: 'var(--accent)',
          background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)',
          borderRadius: 4, padding: '1px 6px', marginLeft: 'auto',
        }}>
          {shapes.length} shape{shapes.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Shape breakdown */}
      {typeCounts.length > 0 && (
        <div style={divSt}>
          <div style={panelSt}>Layers</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {typeCounts.map(([type, n]) => (
              <div key={type} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'capitalize' }}>{type}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {/* Progress bar */}
                  <div style={{ width: 60, height: 3, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${(n / shapes.length) * 100}%`, height: '100%', background: 'var(--accent)', borderRadius: 2 }} />
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, minWidth: 16, textAlign: 'right' }}>{n}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Document colors */}
      {docColors.length > 0 && (
        <div style={divSt}>
          <div style={panelSt}>Colors in Design</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {docColors.map(c => (
              <div
                key={c}
                title={c}
                style={{
                  width: 20, height: 20, borderRadius: 4,
                  background: c,
                  border: '1px solid rgba(255,255,255,0.1)',
                  boxShadow: '0 0 0 1px rgba(0,0,0,0.2) inset',
                  cursor: 'default',
                  position: 'relative',
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div style={divSt}>
        <div style={panelSt}>Quick Actions</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <OverviewAction label="Command palette" shortcut="⌘K" icon="⌘" onClick={onOpenCommandPalette} />
          <OverviewAction label="Keyboard shortcuts" shortcut="?" icon="⌨" onClick={onShowShortcuts} />
          {onShowDesignSystem && (
            <OverviewAction label="Design system & tokens" shortcut="⌘⇧D" onClick={onShowDesignSystem} />
          )}
          {onShowDesignLint && (
            <OverviewAction label="Design lint & issues" shortcut="⇧L" icon="⚡" onClick={onShowDesignLint} />
          )}
          {onShowFindReplace && (
            <OverviewAction label="Find & replace text" shortcut="⌘⇧H" icon="🔍" onClick={onShowFindReplace} />
          )}
          {onShowColorHarmony && (
            <OverviewAction label="Color harmony" shortcut="⌘⇧Y" icon="◉" onClick={onShowColorHarmony} />
          )}
          {onShowTypeScale && (
            <OverviewAction label="Typography scale" shortcut="⌘⇧T" icon="T" onClick={onShowTypeScale} />
          )}
          {onShowThemeCustomizer && (
            <OverviewAction label="Theme customizer" shortcut="⌘⇧P" icon="🎨" onClick={onShowThemeCustomizer} />
          )}
          {onShowDevSpec && (
            <OverviewAction label="Developer spec / handoff" shortcut="⌘⇧E" icon="</>" onClick={onShowDevSpec} />
          )}
          {onShowSnapshots && (
            <OverviewAction label="Canvas snapshots" shortcut="⌘⇧M" icon="📷" onClick={onShowSnapshots} />
          )}
        </div>
      </div>

      {/* Click to select hint */}
      <div style={{ padding: '10px 12px', marginTop: 'auto' }}>
        <div style={{ fontSize: 11, color: 'var(--subtle)', lineHeight: 1.6, textAlign: 'center' }}>
          Click any shape on the canvas<br />to edit its properties
        </div>
      </div>
    </div>
  );
}

// ── Command palette builder ────────────────────────────────────────────────────

function buildCommands({
  drawing,
  setActiveTool,
  showToast,
  setShowShortcuts,
  setPresentationMode,
  setLeftCollapsed,
  setRightCollapsed,
  setShowHistoryBrowser,
  setShowBatchRename,
  setShowFrameSorter,
  setShowCodeExport,
  setShowColorScheme,
  setShowGradientMesh,
  setShowRulers,
  setGuides,
  setShowAnimationTween,
  setShowStylePresets,
  setShowMotionPath,
  setAnnotationsActive,
  setShowImageFill,
  setShowColorGrading,
  setShowParticles,
  setShowShadowStudio,
  setShowUIBlocks,
  setShowFluidType,
  setShowClipPath,
  setShowPresentation,
  setPresentationStartId,
  setShowAccessibility,
  setShowDesignTokens,
  setShowBatchExport,
  setShowPatternFill,
  setShowMorphBlend,
  setShowResponsivePreview,
  setShowThemeEditor,
  setShowPlaceholder,
  setShow3DTransform,
  setShowNoiseTexture,
  setShowVariableFont,
  setShowVariants,
  setShowDesignIntel,
  setShowGenerativeArt,
  setShowGridSystem,
  setShowPrototype,
  setShowContentFill,
  setShowColorBlind,
  setShowTextStyles,
  setShowPaletteExtractor,
  setShowTemplateGallery,
  setShowAutoLayout,
  setShowLayerEffects,
  setLeftTab,
  setShowDesignSystem,
  setShowColorReplace,
  setShowCustomFonts,
  setShowQuickInsert,
  setShowColorPalettes,
  setShowIconPicker,
  setShowDeviceMockup,
  setShowDesignLint,
  setShowFindReplace,
  setShowTypeScale,
  setShowColorHarmony,
  setShowThemeCustomizer,
  setShowDevSpec,
  setShowSnapshots,
  shapes = [],
  onSelectShape,
}: {
  drawing: React.MutableRefObject<ReturnType<typeof import('./hooks/useDrawingTools').useDrawingTools>>;
  setActiveTool: (t: import('./components/layout/ToolSidebar').Tool) => void;
  showToast: (msg: string, kind?: 'info' | 'action') => void;
  setShowShortcuts: (v: boolean) => void;
  setPresentationMode: (v: boolean) => void;
  setLeftCollapsed: (fn: (c: boolean) => boolean) => void;
  setRightCollapsed: (fn: (c: boolean) => boolean) => void;
  setLeftTab: (tab: import('./components/layout/LeftPanel').LeftTab) => void;
  setShowDesignSystem: (v: boolean) => void;
  setShowColorReplace?: (v: boolean) => void;
  setShowCustomFonts?: (v: boolean) => void;
  setShowQuickInsert?: (v: boolean) => void;
  setShowColorPalettes?: (v: boolean) => void;
  setShowIconPicker?: (v: boolean) => void;
  setShowDeviceMockup?: (v: boolean) => void;
  setShowDesignLint?: (v: boolean) => void;
  setShowFindReplace?: (v: boolean) => void;
  setShowTypeScale?: (v: boolean) => void;
  setShowColorHarmony?: (v: boolean) => void;
  setShowThemeCustomizer?: (v: boolean) => void;
  setShowDevSpec?: (v: boolean) => void;
  setShowSnapshots?: (v: boolean) => void;
  setShowHistoryBrowser?: (fn: (o: boolean) => boolean) => void;
  setShowBatchRename?: (fn: (o: boolean) => boolean) => void;
  setShowFrameSorter?: (fn: (o: boolean) => boolean) => void;
  setShowCodeExport?: (fn: (o: boolean) => boolean) => void;
  setShowColorScheme?: (fn: (o: boolean) => boolean) => void;
  setShowGradientMesh?: (fn: (o: boolean) => boolean) => void;
  setShowRulers?: (fn: (r: boolean) => boolean) => void;
  setGuides?: (guides: import('./components/canvas/CanvasRulers').Guide[]) => void;
  setShowAnimationTween?: (fn: (a: boolean) => boolean) => void;
  setShowStylePresets?: (fn: (s: boolean) => boolean) => void;
  setShowMotionPath?: (fn: (m: boolean) => boolean) => void;
  setAnnotationsActive?: (fn: (a: boolean) => boolean) => void;
  setShowImageFill?: (fn: (i: boolean) => boolean) => void;
  setShowColorGrading?: (fn: (g: boolean) => boolean) => void;
  setShowParticles?: (fn: (p: boolean) => boolean) => void;
  setShowShadowStudio?: (fn: (s: boolean) => boolean) => void;
  setShowUIBlocks?: (fn: (b: boolean) => boolean) => void;
  setShowFluidType?: (fn: (f: boolean) => boolean) => void;
  setShowClipPath?: (fn: (c: boolean) => boolean) => void;
  setShowPresentation?: (v: boolean) => void;
  setPresentationStartId?: (id: string | null) => void;
  setShowAccessibility?: (fn: (a: boolean) => boolean) => void;
  setShowDesignTokens?: (fn: (t: boolean) => boolean) => void;
  setShowBatchExport?: (fn: (b: boolean) => boolean) => void;
  setShowPatternFill?: (fn: (p: boolean) => boolean) => void;
  setShowMorphBlend?: (fn: (m: boolean) => boolean) => void;
  setShowResponsivePreview?: (fn: (r: boolean) => boolean) => void;
  setShowThemeEditor?: (fn: (t: boolean) => boolean) => void;
  setShowPlaceholder?: (fn: (h: boolean) => boolean) => void;
  setShow3DTransform?: (fn: (v: boolean) => boolean) => void;
  setShowNoiseTexture?: (fn: (v: boolean) => boolean) => void;
  setShowVariableFont?: (fn: (v: boolean) => boolean) => void;
  setShowVariants?: (fn: (v: boolean) => boolean) => void;
  setShowDesignIntel?: (fn: (v: boolean) => boolean) => void;
  setShowGenerativeArt?: (fn: (v: boolean) => boolean) => void;
  setShowGridSystem?: (fn: (v: boolean) => boolean) => void;
  setShowPrototype?: (fn: (v: boolean) => boolean) => void;
  setShowContentFill?: (fn: (v: boolean) => boolean) => void;
  setShowColorBlind?: (fn: (v: boolean) => boolean) => void;
  setShowTextStyles?: (fn: (v: boolean) => boolean) => void;
  setShowPaletteExtractor?: (fn: (v: boolean) => boolean) => void;
  setShowTemplateGallery?: (fn: (v: boolean) => boolean) => void;
  setShowAutoLayout?: (fn: (v: boolean) => boolean) => void;
  setShowLayerEffects?: (fn: (v: boolean) => boolean) => void;
  shapes?: Shape[];
  onSelectShape?: (id: string) => void;
}): CommandItem[] {
  const d = () => drawing.current;

  // Shape "Go to" commands — one per shape, grouped under "Layers"
  const shapeCommands: CommandItem[] = shapes
    .filter(s => !s.hidden)
    .map(s => ({
      id: `goto-${s.id}`,
      label: s.name || `${s.type} (unnamed)`,
      group: 'Layers',
      icon: s.type === 'frame' ? '⬜' : s.type === 'text' ? 'T' : s.type === 'ellipse' ? '○' : '▭',
      action: () => onSelectShape?.(s.id),
    }));

  return [
    ...shapeCommands,
    // Tools
    { id: 'tool-cursor', label: 'Cursor', group: 'Tools', shortcut: 'V', icon: '↖', action: () => setActiveTool('cursor') },
    { id: 'tool-rectangle', label: 'Rectangle', group: 'Tools', shortcut: 'R', icon: '▬', action: () => setActiveTool('rectangle') },
    { id: 'tool-ellipse', label: 'Ellipse', group: 'Tools', shortcut: 'O', icon: '○', action: () => setActiveTool('ellipse') },
    { id: 'tool-text', label: 'Text', group: 'Tools', shortcut: 'T', icon: 'T', action: () => setActiveTool('text') },
    { id: 'tool-frame', label: 'Frame', group: 'Tools', shortcut: 'F', icon: '⊡', action: () => setActiveTool('frame') },
    { id: 'tool-pen', label: 'Pen', group: 'Tools', shortcut: 'P', icon: '✎', action: () => setActiveTool('pen') },
    { id: 'tool-pan', label: 'Pan', group: 'Tools', shortcut: 'H', icon: '✋', action: () => setActiveTool('pan') },

    // Edit
    { id: 'edit-undo', label: 'Undo', group: 'Edit', shortcut: '⌘Z', icon: '↩', action: () => { d().undo(); showToast('Undo', 'action'); } },
    { id: 'edit-redo', label: 'Redo', group: 'Edit', shortcut: '⌘⇧Z', icon: '↪', action: () => { d().redo(); showToast('Redo', 'action'); } },
    { id: 'edit-copy', label: 'Copy', group: 'Edit', shortcut: '⌘C', icon: '⊞', action: () => d().copy() },
    { id: 'edit-paste', label: 'Paste', group: 'Edit', shortcut: '⌘V', icon: '⊟', action: () => d().paste() },
    { id: 'edit-duplicate', label: 'Duplicate', group: 'Edit', shortcut: '⌘D', icon: '⊕', action: () => d().duplicate() },
    { id: 'edit-delete', label: 'Delete selected', group: 'Edit', shortcut: '⌫', icon: '✕', action: () => d().deleteSelected() },
    { id: 'edit-select-all', label: 'Select all', group: 'Edit', shortcut: '⌘A', icon: '⬜', action: () => d().selectAll() },
    { id: 'edit-group', label: 'Group selection', group: 'Edit', shortcut: '⌘G', icon: '⊞', action: () => { d().group(); showToast('Grouped', 'action'); } },
    { id: 'edit-ungroup', label: 'Ungroup', group: 'Edit', shortcut: '⌘⇧G', icon: '⊟', action: () => { d().ungroup(); showToast('Ungrouped', 'action'); } },

    // Arrange
    { id: 'arrange-front', label: 'Bring to front', group: 'Arrange', shortcut: '⌘]', icon: '↑', action: () => d().bringToFront() },
    { id: 'arrange-back', label: 'Send to back', group: 'Arrange', shortcut: '⌘[', icon: '↓', action: () => d().sendToBack() },
    { id: 'arrange-align-left', label: 'Align left edges', group: 'Arrange', icon: '⊢', action: () => d().alignShapes('align-left') },
    { id: 'arrange-align-center-h', label: 'Align horizontal centers', group: 'Arrange', icon: '⊣', action: () => d().alignShapes('align-center-h') },
    { id: 'arrange-align-right', label: 'Align right edges', group: 'Arrange', icon: '⊣', action: () => d().alignShapes('align-right') },
    { id: 'arrange-align-top', label: 'Align top edges', group: 'Arrange', icon: '⊤', action: () => d().alignShapes('align-top') },
    { id: 'arrange-align-center-v', label: 'Align vertical centers', group: 'Arrange', icon: '⊥', action: () => d().alignShapes('align-center-v') },
    { id: 'arrange-align-bottom', label: 'Align bottom edges', group: 'Arrange', icon: '⊤', action: () => d().alignShapes('align-bottom') },
    { id: 'arrange-distribute-h', label: 'Distribute horizontally', group: 'Arrange', icon: '↔', action: () => d().alignShapes('distribute-h') },
    { id: 'arrange-distribute-v', label: 'Distribute vertically', group: 'Arrange', icon: '↕', action: () => d().alignShapes('distribute-v') },

    // Layers
    { id: 'layer-toggle-hide', label: 'Toggle hide selected', group: 'Layers', shortcut: '⇧H', icon: '👁', action: () => {
      const { selectedId, selectedIds: ids, shapes } = d().state;
      const allIds = ids.length > 0 ? ids : (selectedId ? [selectedId] : []);
      for (const id of allIds) {
        const s = shapes.find(sh => sh.id === id);
        if (s) d().updateShape(id, { hidden: !s.hidden });
      }
    }},
    { id: 'layer-toggle-lock', label: 'Toggle lock selected', group: 'Layers', shortcut: 'L', icon: '🔒', action: () => {
      const { selectedId, selectedIds: ids, shapes } = d().state;
      const allIds = ids.length > 0 ? ids : (selectedId ? [selectedId] : []);
      for (const id of allIds) {
        const s = shapes.find(sh => sh.id === id);
        if (s) d().updateShape(id, { locked: !s.locked });
      }
    }},

    // View
    { id: 'view-zoom-fit', label: 'Zoom to fit all', group: 'View', shortcut: '1', icon: '⊡', action: () => {
      // Dispatch zoom-to-fit via keyboard shortcut
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '1', metaKey: true, bubbles: true }));
    }},
    { id: 'view-zoom-selection', label: 'Zoom to selection', group: 'View', shortcut: '⇧2', icon: '⊞', action: () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '2', shiftKey: true, metaKey: true, bubbles: true }));
    }},
    { id: 'view-zoom-reset', label: 'Reset zoom to 100%', group: 'View', shortcut: '0', icon: '⊙', action: () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '0', metaKey: true, bubbles: true }));
    }},
    { id: 'view-presentation', label: 'Presentation mode', group: 'View', shortcut: 'F5', icon: '▶', action: () => setPresentationMode(true) },
    { id: 'view-shortcuts', label: 'Keyboard shortcuts', group: 'View', shortcut: '?', icon: '?', action: () => setShowShortcuts(true) },
    { id: 'view-left-panel', label: 'Toggle left panel', group: 'View', icon: '◧', action: () => setLeftCollapsed(c => !c) },
    { id: 'view-right-panel', label: 'Toggle properties panel', group: 'View', icon: '◨', action: () => setRightCollapsed(c => !c) },
    { id: 'view-layers', label: 'Show layers panel', group: 'View', icon: '≡', action: () => { setLeftCollapsed(() => false); setLeftTab('layers'); } },
    { id: 'view-pages', label: 'Show pages panel', group: 'View', icon: '□', action: () => { setLeftCollapsed(() => false); setLeftTab('pages'); } },
    { id: 'view-history', label: 'Show history panel', group: 'View', icon: '↺', action: () => { setLeftCollapsed(() => false); setLeftTab('history'); } },
    { id: 'view-assets', label: 'Show assets panel', group: 'View', icon: '◈', action: () => { setLeftCollapsed(() => false); setLeftTab('components'); } },
    { id: 'view-design-system', label: 'Design system & tokens', group: 'View', shortcut: '⌘⇧D', icon: '◉', action: () => setShowDesignSystem(true) },
    { id: 'view-tokens', label: 'Extracted design tokens', group: 'View', icon: '🎨', action: () => { setLeftCollapsed(() => false); setLeftTab('tokens'); } },
    { id: 'view-frame-sorter', label: 'Frame Sorter — reorder slides', group: 'View', shortcut: '⌘⌥S', icon: '▤', action: () => setShowFrameSorter?.(o => !o) },
    { id: 'view-code-export', label: 'Export Code — React / CSS / SVG', group: 'View', shortcut: '⌘⇧/', icon: '</>', action: () => setShowCodeExport?.(o => !o) },
    { id: 'tools-color-scheme', label: 'Apply Color Scheme — retheme entire design', group: 'Tools', shortcut: '⌘⇧O', icon: '🎨', action: () => setShowColorScheme?.(o => !o) },
    { id: 'view-comments', label: 'Show comments panel', group: 'View', shortcut: '⌘⇧N', icon: '💬', action: () => { setLeftCollapsed(() => false); setLeftTab('comments'); } },
    { id: 'tools-color-replace', label: 'Find & replace colors', group: 'Tools', shortcut: '⌘⇧R', icon: '🎨', action: () => setShowColorReplace?.(true) },
    { id: 'tools-custom-fonts', label: 'Import custom fonts', group: 'Tools', shortcut: '⌘⇧F', icon: '𝓐', action: () => setShowCustomFonts?.(true) },
    { id: 'tools-quick-insert', label: 'Quick Insert — UI elements', group: 'Tools', shortcut: 'I', icon: '⊞', action: () => setShowQuickInsert?.(true) },
    { id: 'tools-color-palettes', label: 'Color Palettes Library', group: 'Tools', shortcut: '⇧K', icon: '🎨', action: () => setShowColorPalettes?.(true) },
    { id: 'tools-icon-picker', label: 'Icon Picker — Lucide icons', group: 'Tools', shortcut: '⇧I', icon: '⬡', action: () => setShowIconPicker?.(true) },
    { id: 'tools-device-mockup', label: 'Device Frames — Insert device frame', group: 'Tools', shortcut: '⇧U', icon: '📱', action: () => setShowDeviceMockup?.(true) },
    { id: 'tools-design-lint', label: 'Design Lint — Check for issues', group: 'Tools', shortcut: '⇧L', icon: '⚡', action: () => setShowDesignLint?.(true) },
    { id: 'tools-find-replace', label: 'Find & Replace Text', group: 'Tools', shortcut: '⌘⇧H', icon: '🔍', action: () => setShowFindReplace?.(true) },
    { id: 'tools-type-scale', label: 'Typography Scale — Apply modular scale', group: 'Tools', shortcut: '⌘⇧T', icon: 'T', action: () => setShowTypeScale?.(true) },
    { id: 'tools-color-harmony', label: 'Color Harmony — Generate color palettes', group: 'Tools', shortcut: '⌘⇧Y', icon: '◉', action: () => setShowColorHarmony?.(true) },
    { id: 'tools-theme-customizer', label: 'Theme Customizer — Retheme the app', group: 'Tools', shortcut: '⌘⇧P', icon: '🎨', action: () => setShowThemeCustomizer?.(true) },
    { id: 'tools-dev-spec', label: 'Developer Spec — Inspect shape for handoff', group: 'Tools', shortcut: '⌘⇧E', icon: '</>', action: () => setShowDevSpec?.(true) },
    { id: 'tools-snapshots', label: 'Canvas Snapshots — Save & restore checkpoints', group: 'Tools', shortcut: '⌘⇧M', icon: '📷', action: () => setShowSnapshots?.(true) },
    { id: 'tools-history', label: 'History Browser — Jump to any undo state', group: 'Tools', shortcut: '⌘⌥H', icon: '↺', action: () => setShowHistoryBrowser?.(o => !o) },
    { id: 'tools-batch-rename', label: 'Batch Rename — Rename layers with pattern', group: 'Tools', shortcut: '⌘⇧B', icon: '✏', action: () => setShowBatchRename?.(o => !o) },
    { id: 'tools-gradient-mesh', label: 'Gradient Mesh — Generate mesh gradient fill', group: 'Tools', icon: '🌈', action: () => setShowGradientMesh?.(o => !o) },
    { id: 'view-rulers', label: 'Toggle Rulers — show/hide canvas rulers & guides', group: 'View', shortcut: '⌘R', icon: '⊢', action: () => setShowRulers?.(r => !r) },
    { id: 'tools-animation', label: 'Animation Editor — keyframe animation for shapes', group: 'Tools', shortcut: '⌘⇧A', icon: '▶', action: () => setShowAnimationTween?.(a => !a) },
    { id: 'tools-style-presets', label: 'Style Presets — apply glass, neon, neumorphic & more', group: 'Tools', shortcut: '⌘⇧Y', icon: '🎨', action: () => setShowStylePresets?.(s => !s) },
    { id: 'tools-motion-path', label: 'Motion Path — animate shape along a custom path', group: 'Tools', shortcut: '⌘⇧⌥A', icon: '〜', action: () => setShowMotionPath?.(m => !m) },
    { id: 'tools-annotations', label: 'Annotations — add spec callout labels to canvas', group: 'Tools', shortcut: '⌘⇧K', icon: '◈', action: () => setAnnotationsActive?.(a => !a) },
    { id: 'tools-image-fill', label: 'Image Fill — search & apply photo fills to shapes', group: 'Tools', shortcut: '⌘⇧I', icon: '🖼', action: () => setShowImageFill?.(i => !i) },
    { id: 'tools-color-grading', label: 'Color Grading — Lightroom-style filters for shapes', group: 'Tools', shortcut: '⌘⇧L', icon: '🎞', action: () => setShowColorGrading?.(g => !g) },
    { id: 'tools-particles', label: 'Particle Effects — animated particle system backgrounds', group: 'Tools', shortcut: '⌘⇧⌥P', icon: '✦', action: () => setShowParticles?.(p => !p) },
    { id: 'tools-shadow-studio', label: 'Shadow Studio — multi-layer box-shadow editor', group: 'Tools', shortcut: '⌘⇧W', icon: '◈', action: () => setShowShadowStudio?.(s => !s) },
    { id: 'tools-ui-blocks', label: 'UI Blocks Library — insert pre-built UI components', group: 'Tools', shortcut: '⌘⇧U', icon: '⊞', action: () => setShowUIBlocks?.(b => !b) },
    { id: 'tools-fluid-type', label: 'Fluid Typography — generate CSS clamp() type scales', group: 'Tools', shortcut: '⌘⇧⌥F', icon: '⟳', action: () => setShowFluidType?.(f => !f) },
    { id: 'tools-clip-path', label: 'Clip Path Editor — visual polygon clip mask editor', group: 'Tools', shortcut: '⌘⇧⌥Q', icon: '✦', action: () => setShowClipPath?.(c => !c) },
    { id: 'view-presentation', label: 'Presentation Mode — full-screen slideshow of frames', group: 'View', shortcut: 'F5', icon: '▶', action: () => { setPresentationStartId?.(null); setShowPresentation?.(true); } },
    { id: 'tools-accessibility', label: 'Accessibility Checker — WCAG contrast & a11y audit', group: 'Tools', shortcut: '⌘⇧⌥X', icon: '♿', action: () => setShowAccessibility?.(a => !a) },
    { id: 'tools-design-tokens', label: 'Design Tokens — named token system with CSS/JSON export', group: 'Tools', shortcut: '⌘⇧⌥D', icon: '◈', action: () => setShowDesignTokens?.(t => !t) },
    { id: 'tools-batch-export', label: 'Batch Export — export all frames as PNG/SVG/JPG files', group: 'Tools', shortcut: '⌘⇧⌥E', icon: '⬇', action: () => setShowBatchExport?.(b => !b) },
    { id: 'tools-pattern-fill', label: 'Pattern Fill — SVG pattern generator: dots, grid, hex, circuits…', group: 'Tools', shortcut: '⌘⇧⌥B', icon: '⊞', action: () => setShowPatternFill?.(p => !p) },
    { id: 'tools-morph-blend', label: 'Morph Blend — blend/tween between two shapes with easing', group: 'Tools', shortcut: '⌘⇧⌥M', icon: '⟷', action: () => setShowMorphBlend?.(m => !m) },
    { id: 'view-responsive', label: 'Responsive Preview — multi-breakpoint design preview with device frames', group: 'View', shortcut: '⌘⇧⌥R', icon: '📱', action: () => setShowResponsivePreview?.(r => !r) },
    { id: 'tools-theme-editor', label: 'Theme Editor — live CSS variable editor with premade themes', group: 'Tools', shortcut: '⌘⇧⌥T', icon: '🎨', action: () => setShowThemeEditor?.(t => !t) },
    { id: 'tools-placeholder', label: 'Placeholder Content — insert realistic UI content (cards, forms, tables…)', group: 'Tools', shortcut: '⌘⇧⌥H', icon: '⊞', action: () => setShowPlaceholder?.(h => !h) },
    { id: 'tools-3d-transform', label: '3D Transform Studio — perspective, rotateX/Y/Z, isometric presets', group: 'Tools', shortcut: '⌘⇧⌥3', icon: '🧊', action: () => setShow3DTransform?.(v => !v) },
    { id: 'tools-noise-texture', label: 'Noise & Texture — film grain, halftone, crosshatch, geometric overlays', group: 'Tools', shortcut: '⌘⇧⌥N', icon: '🌾', action: () => setShowNoiseTexture?.(v => !v) },
    { id: 'tools-variable-font', label: 'Variable Font Studio — interactive axis controls for variable web fonts', group: 'Tools', shortcut: '⌘⇧⌥V', icon: '𝑓', action: () => setShowVariableFont?.(v => !v) },
    { id: 'tools-variants', label: 'Component Variants — define Hover/Pressed/Disabled/Dark visual states', group: 'Tools', shortcut: '⌘⇧⌥W', icon: '🎭', action: () => setShowVariants?.(v => !v) },
    { id: 'tools-design-intel', label: 'Design Intelligence — smart contrast, spacing, hierarchy & a11y analysis', group: 'Tools', shortcut: '⌘⇧⌥I', icon: '🧠', action: () => setShowDesignIntel?.(v => !v) },
    { id: 'tools-generative-art', label: 'Generative Art — Truchet, Lissajous, spirograph, flow fields, fractals', group: 'Tools', shortcut: '⌘⇧⌥G', icon: '🎲', action: () => setShowGenerativeArt?.(v => !v) },
    { id: 'tools-grid-system', label: 'Grid System — column/row/baseline layout grids with live canvas overlay', group: 'View', shortcut: '⌘⇧⌥L', icon: '⊞', action: () => setShowGridSystem?.(v => !v) },
    { id: 'tools-prototype', label: 'Prototype Interactions — draw click/hover/drag links between shapes with transitions', group: 'Tools', shortcut: '⌘⇧⌥P', icon: '⇄', action: () => setShowPrototype?.(v => !v) },
    { id: 'tools-content-fill', label: 'Content Fill — add realistic photos, avatars, text, charts, and gradients', group: 'Tools', shortcut: '⌘⇧⌥C', icon: '✦', action: () => setShowContentFill?.(v => !v) },
    { id: 'tools-color-blind', label: 'Color Blindness Simulator — preview design for protanopia, deuteranopia, tritanopia', group: 'Tools', shortcut: '⌘⇧⌥B', icon: '👁', action: () => setShowColorBlind?.(v => !v) },
    { id: 'tools-text-styles', label: 'Text Styles — define and apply named typography styles (H1, Body, Caption…)', group: 'Tools', shortcut: '⌘⇧T', icon: 'T', action: () => setShowTextStyles?.(v => !v) },
    { id: 'tools-palette-extractor', label: 'Color Extractor — extract all design colors, rename and export as CSS/SCSS/Tailwind', group: 'Tools', shortcut: '⌘⇧⌥E', icon: '◐', action: () => setShowPaletteExtractor?.(v => !v) },
    { id: 'tools-template-gallery', label: 'Template Gallery — insert pre-built hero, dashboard, form, mobile layouts', group: 'Tools', shortcut: '⌘⇧⌥T', icon: '⬡', action: () => setShowTemplateGallery?.(v => !v) },
    { id: 'tools-auto-layout', label: 'Auto Layout — arrange selected shapes with gap, padding, direction, alignment', group: 'Tools', shortcut: '⌘⌥A', icon: '⟺', action: () => setShowAutoLayout?.(v => !v) },
    { id: 'tools-layer-effects', label: 'Layer Effects — add drop shadows, inner shadows, blur, blend modes to shapes', group: 'Tools', shortcut: '⌘⇧⌥J', icon: '✦', action: () => setShowLayerEffects?.(v => !v) },
    { id: 'view-clear-guides', label: 'Clear All Guides', group: 'View', icon: '✕', action: () => { setGuides?.([]); showToast('Guides cleared', 'action'); } },
    { id: 'layer-wrap-frame', label: 'Wrap selection in Frame', group: 'Layers', shortcut: '⌘⌥G', icon: '⬜', action: () => d().wrapInFrame() },
    { id: 'arrange-tidy', label: 'Tidy up — arrange shapes in grid', group: 'Arrange', shortcut: '⌘⌥T', icon: '⊞', action: () => d().tidyUp() },
    { id: 'edit-paste-in-place', label: 'Paste in place', group: 'Edit', shortcut: '⌘⇧V', icon: '⎘', action: () => { d().pasteInPlace(); } },

    // ── Frame / artboard size presets ────────────────────────────────────────
    ...([
      ['iPhone 15 Pro', 393, 852],
      ['iPhone SE', 375, 667],
      ['iPhone 15 Pro Max', 430, 932],
      ['iPad Pro 12.9"', 1024, 1366],
      ['iPad Air', 820, 1180],
      ['Android Large', 412, 915],
      ['Desktop HD', 1440, 900],
      ['Desktop FHD', 1920, 1080],
      ['MacBook Air 13"', 1280, 800],
      ['Twitter/X Post', 1200, 675],
      ['Instagram Post', 1080, 1080],
      ['Instagram Story', 1080, 1920],
      ['Open Graph (1.91:1)', 1200, 628],
      ['A4 Portrait', 794, 1123],
      ['A4 Landscape', 1123, 794],
    ] as [string, number, number][]).map(([name, w, h]) => ({
      id: `frame-preset-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      label: `Resize frame to ${name} (${w}×${h})`,
      group: 'Frame Presets',
      icon: '⬜',
      action: () => {
        const { selectedId, selectedIds: sids, shapes: ss } = d().state;
        const ids = sids.length > 0 ? sids : (selectedId ? [selectedId] : []);
        if (ids.length === 0) { showToast('Select a frame first', 'info'); return; }
        let resized = 0;
        ids.forEach(id => {
          const s = ss.find(sh => sh.id === id);
          if (s && (s.type === 'frame' || s.type === 'rectangle')) {
            d().updateShape(id, { width: w, height: h });
            resized++;
          }
        });
        showToast(resized > 0 ? `Resized to ${name} (${w}×${h})` : 'Select frames to resize', resized > 0 ? 'action' : 'info');
      },
    })),
    { id: 'arrange-center-canvas', label: 'Center selection on canvas', group: 'Arrange', shortcut: '⌘⌥C', icon: '⊙', action: () => {
      d().centerOnCanvas();
      showToast('Centered on canvas', 'action');
    }},

    // Select same...
    { id: 'select-same-fill', label: 'Select all with same fill color', group: 'Select', icon: '▣', action: () => {
      const { selectedId, shapes: ss } = d().state;
      if (!selectedId) return;
      const sel = ss.find(s => s.id === selectedId);
      if (!sel) return;
      const sameIds = ss.filter(s => s.fill === sel.fill && !s.hidden).map(s => s.id);
      d().setSelectedIds(sameIds);
      showToast(`Selected ${sameIds.length} shapes with fill ${sel.fill}`, 'action');
    }},
    { id: 'select-same-type', label: 'Select all of same type', group: 'Select', icon: '▧', action: () => {
      const { selectedId, shapes: ss } = d().state;
      if (!selectedId) return;
      const sel = ss.find(s => s.id === selectedId);
      if (!sel) return;
      const sameIds = ss.filter(s => s.type === sel.type && !s.hidden).map(s => s.id);
      d().setSelectedIds(sameIds);
      showToast(`Selected ${sameIds.length} ${sel.type} shapes`, 'action');
    }},
    { id: 'select-same-font', label: 'Select all text with same font', group: 'Select', icon: 'T', action: () => {
      const { selectedId, shapes: ss } = d().state;
      if (!selectedId) return;
      const sel = ss.find(s => s.id === selectedId && s.type === 'text');
      if (!sel) { showToast('Select a text shape first', 'info'); return; }
      const sameIds = ss.filter(s => s.type === 'text' && s.fontFamily === sel.fontFamily).map(s => s.id);
      d().setSelectedIds(sameIds);
      showToast(`Selected ${sameIds.length} text shapes with ${sel.fontFamily.split(',')[0]}`, 'action');
    }},
    { id: 'select-hidden', label: 'Select all hidden layers', group: 'Select', icon: '👁', action: () => {
      const { shapes: ss } = d().state;
      const hiddenIds = ss.filter(s => s.hidden).map(s => s.id);
      if (hiddenIds.length === 0) { showToast('No hidden layers', 'info'); return; }
      d().setSelectedIds(hiddenIds);
      showToast(`Selected ${hiddenIds.length} hidden layers`, 'action');
    }},
    { id: 'select-locked', label: 'Select all locked layers', group: 'Select', icon: '🔒', action: () => {
      const { shapes: ss } = d().state;
      const lockedIds = ss.filter(s => s.locked).map(s => s.id);
      if (lockedIds.length === 0) { showToast('No locked layers', 'info'); return; }
      d().setSelectedIds(lockedIds);
      showToast(`Selected ${lockedIds.length} locked layers`, 'action');
    }},
    // Tag-based selection — dynamically generate one command per unique tag
    ...(() => {
      const { shapes: ss } = d().state;
      const allTags = [...new Set(ss.flatMap(s => s.tags ?? []))].sort();
      return allTags.map(tag => ({
        id: `select-tag-${tag}`,
        label: `Select all shapes tagged #${tag}`,
        group: 'Select',
        icon: '#',
        action: () => {
          const taggedIds = ss.filter(s => (s.tags ?? []).includes(tag)).map(s => s.id);
          d().setSelectedIds(taggedIds);
          showToast(`Selected ${taggedIds.length} shape${taggedIds.length !== 1 ? 's' : ''} tagged #${tag}`, 'action');
        },
      }));
    })(),

    // Quick shape insert
    ...QUICK_SHAPE_DEFS.map(def => ({
      id: `quick-shape-${def.id}`,
      label: `Insert ${def.label}`,
      group: 'Shapes',
      icon: def.label.split(' ')[0],
      action: () => {
        const { shapes: ss } = d().state;
        // Place at center of current viewport or after last shape
        const lastX = ss.length > 0 ? Math.max(...ss.map(s => s.x + s.width)) + 32 : 80;
        const lastY = ss.length > 0 ? ss[ss.length - 1].y : 80;
        const shape = def.make(uuid(), lastX, lastY);
        d().addShape(shape);
        d().select(shape.id);
        showToast(`Inserted ${def.label.split(' ').slice(1).join(' ')}`, 'action');
      },
    })),

    // Transform
    { id: 'transform-flip-h', label: 'Flip horizontal', group: 'Transform', icon: '↔', action: () => {
      const { selectedId, selectedIds: sids, shapes: ss } = d().state;
      const ids = sids.length > 0 ? sids : (selectedId ? [selectedId] : []);
      for (const id of ids) {
        const s = ss.find(sh => sh.id === id);
        if (s) d().updateShape(id, { flipX: !s.flipX });
      }
      showToast('Flipped horizontal', 'action');
    }},
    { id: 'transform-flip-v', label: 'Flip vertical', group: 'Transform', icon: '↕', action: () => {
      const { selectedId, selectedIds: sids, shapes: ss } = d().state;
      const ids = sids.length > 0 ? sids : (selectedId ? [selectedId] : []);
      for (const id of ids) {
        const s = ss.find(sh => sh.id === id);
        if (s) d().updateShape(id, { flipY: !s.flipY });
      }
      showToast('Flipped vertical', 'action');
    }},
    { id: 'transform-rotate-90', label: 'Rotate 90° clockwise', group: 'Transform', icon: '↻', action: () => {
      const { selectedId, selectedIds: sids, shapes: ss } = d().state;
      const ids = sids.length > 0 ? sids : (selectedId ? [selectedId] : []);
      for (const id of ids) {
        const s = ss.find(sh => sh.id === id);
        if (s) d().updateShape(id, { rotation: (s.rotation + 90) % 360 });
      }
      showToast('Rotated 90°', 'action');
    }},
    { id: 'transform-rotate-neg90', label: 'Rotate 90° counter-clockwise', group: 'Transform', icon: '↺', action: () => {
      const { selectedId, selectedIds: sids, shapes: ss } = d().state;
      const ids = sids.length > 0 ? sids : (selectedId ? [selectedId] : []);
      for (const id of ids) {
        const s = ss.find(sh => sh.id === id);
        if (s) d().updateShape(id, { rotation: ((s.rotation - 90) + 360) % 360 });
      }
      showToast('Rotated -90°', 'action');
    }},
    { id: 'transform-reset-rotation', label: 'Reset rotation', group: 'Transform', icon: '○', action: () => {
      const { selectedId, selectedIds: sids } = d().state;
      const ids = sids.length > 0 ? sids : (selectedId ? [selectedId] : []);
      for (const id of ids) d().updateShape(id, { rotation: 0, flipX: false, flipY: false });
      showToast('Rotation reset', 'action');
    }},

    // Arrange — Repeat Grid
    { id: 'arrange-repeat-2x2', label: 'Repeat selection 2×2 grid', group: 'Arrange', icon: '⊞', action: () => {
      const { selectedId, selectedIds: sids, shapes: ss } = d().state;
      const id = sids.length > 0 ? sids[0] : selectedId;
      if (!id) { showToast('Select a shape first', 'info'); return; }
      const src = ss.find(s => s.id === id);
      if (!src) return;
      const gapX = 16, gapY = 16;
      const rows = 2, cols = 2;
      let count = 0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (r === 0 && c === 0) continue; // skip original
          const clone = { ...src, id: uuid(), x: src.x + c * (src.width + gapX), y: src.y + r * (src.height + gapY), name: `${src.name} ${r * cols + c + 1}` };
          d().addShape(clone);
          count++;
        }
      }
      showToast(`Repeated 2×2 grid (+${count} copies)`, 'action');
    }},
    { id: 'arrange-repeat-3x3', label: 'Repeat selection 3×3 grid', group: 'Arrange', icon: '⣿', action: () => {
      const { selectedId, selectedIds: sids, shapes: ss } = d().state;
      const id = sids.length > 0 ? sids[0] : selectedId;
      if (!id) { showToast('Select a shape first', 'info'); return; }
      const src = ss.find(s => s.id === id);
      if (!src) return;
      const gapX = 16, gapY = 16;
      const rows = 3, cols = 3;
      let count = 0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (r === 0 && c === 0) continue;
          const clone = { ...src, id: uuid(), x: src.x + c * (src.width + gapX), y: src.y + r * (src.height + gapY), name: `${src.name} ${r * cols + c + 1}` };
          d().addShape(clone);
          count++;
        }
      }
      showToast(`Repeated 3×3 grid (+${count} copies)`, 'action');
    }},
    { id: 'arrange-repeat-row-4', label: 'Repeat in a row (×4)', group: 'Arrange', icon: '⬛⬛⬛⬛', action: () => {
      const { selectedId, selectedIds: sids, shapes: ss } = d().state;
      const id = sids.length > 0 ? sids[0] : selectedId;
      if (!id) { showToast('Select a shape first', 'info'); return; }
      const src = ss.find(s => s.id === id);
      if (!src) return;
      const gap = 16;
      for (let i = 1; i < 4; i++) {
        const clone = { ...src, id: uuid(), x: src.x + i * (src.width + gap), y: src.y, name: `${src.name} ${i + 1}` };
        d().addShape(clone);
      }
      showToast('Repeated in a row (×4)', 'action');
    }},
    { id: 'arrange-repeat-col-4', label: 'Repeat in a column (×4)', group: 'Arrange', icon: '▪▪▪▪', action: () => {
      const { selectedId, selectedIds: sids, shapes: ss } = d().state;
      const id = sids.length > 0 ? sids[0] : selectedId;
      if (!id) { showToast('Select a shape first', 'info'); return; }
      const src = ss.find(s => s.id === id);
      if (!src) return;
      const gap = 16;
      for (let i = 1; i < 4; i++) {
        const clone = { ...src, id: uuid(), x: src.x, y: src.y + i * (src.height + gap), name: `${src.name} ${i + 1}` };
        d().addShape(clone);
      }
      showToast('Repeated in a column (×4)', 'action');
    }},
    { id: 'arrange-distribute-random', label: 'Scatter selection randomly', group: 'Arrange', icon: '✦', action: () => {
      const { selectedIds: sids, selectedId, shapes: ss } = d().state;
      const ids = sids.length > 0 ? sids : (selectedId ? [selectedId] : []);
      if (ids.length === 0) { showToast('Select shapes first', 'info'); return; }
      const allSelected = ss.filter(s => ids.includes(s.id));
      const bounds = { minX: Math.min(...allSelected.map(s => s.x)), minY: Math.min(...allSelected.map(s => s.y)), maxX: Math.max(...allSelected.map(s => s.x + s.width)), maxY: Math.max(...allSelected.map(s => s.y + s.height)) };
      const rangeX = Math.max(300, bounds.maxX - bounds.minX);
      const rangeY = Math.max(300, bounds.maxY - bounds.minY);
      for (const s of allSelected) {
        const newX = bounds.minX + Math.random() * rangeX;
        const newY = bounds.minY + Math.random() * rangeY;
        d().updateShape(s.id, { x: newX, y: newY });
      }
      showToast(`Scattered ${ids.length} shapes`, 'action');
    }},
    { id: 'arrange-circle', label: 'Arrange in a circle', group: 'Arrange', icon: '◯', action: () => {
      const { selectedIds: sids, selectedId, shapes: ss } = d().state;
      const ids = sids.length > 0 ? sids : (selectedId ? [selectedId] : []);
      if (ids.length < 2) { showToast('Select 2+ shapes to arrange in a circle', 'info'); return; }
      const allSelected = ss.filter(s => ids.includes(s.id));
      const n = allSelected.length;
      // Compute centroid of current selection as circle center
      const cx = allSelected.reduce((sum, s) => sum + s.x + s.width / 2, 0) / n;
      const cy = allSelected.reduce((sum, s) => sum + s.y + s.height / 2, 0) / n;
      // Radius = max of half-diagonal of bounding box, minimum 120
      const minX = Math.min(...allSelected.map(s => s.x));
      const minY = Math.min(...allSelected.map(s => s.y));
      const maxX = Math.max(...allSelected.map(s => s.x + s.width));
      const maxY = Math.max(...allSelected.map(s => s.y + s.height));
      const r = Math.max(120, Math.hypot(maxX - minX, maxY - minY) / 2);
      allSelected.forEach((s, i) => {
        const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
        const nx = cx + r * Math.cos(angle) - s.width / 2;
        const ny = cy + r * Math.sin(angle) - s.height / 2;
        d().updateShape(s.id, { x: nx, y: ny });
      });
      showToast(`Arranged ${n} shapes in a circle`, 'action');
    }},
    { id: 'arrange-arc', label: 'Arrange in a semicircle (arc)', group: 'Arrange', icon: '◠', action: () => {
      const { selectedIds: sids, selectedId, shapes: ss } = d().state;
      const ids = sids.length > 0 ? sids : (selectedId ? [selectedId] : []);
      if (ids.length < 2) { showToast('Select 2+ shapes to arrange in an arc', 'info'); return; }
      const allSelected = ss.filter(s => ids.includes(s.id));
      const n = allSelected.length;
      const cx = allSelected.reduce((sum, s) => sum + s.x + s.width / 2, 0) / n;
      const cy = allSelected.reduce((sum, s) => sum + s.y + s.height / 2, 0) / n;
      const r = Math.max(140, allSelected.reduce((sum, s) => sum + Math.max(s.width, s.height), 0) / n * 2);
      allSelected.forEach((s, i) => {
        // Arc from -π to 0 (top semicircle)
        const angle = -Math.PI + (i / (n - 1)) * Math.PI;
        const nx = cx + r * Math.cos(angle) - s.width / 2;
        const ny = cy + r * Math.sin(angle) - s.height / 2;
        d().updateShape(s.id, { x: nx, y: ny });
      });
      showToast(`Arranged ${n} shapes in a semicircle`, 'action');
    }},
    { id: 'arrange-diagonal', label: 'Arrange on diagonal', group: 'Arrange', icon: '↗', action: () => {
      const { selectedIds: sids, selectedId, shapes: ss } = d().state;
      const ids = sids.length > 0 ? sids : (selectedId ? [selectedId] : []);
      if (ids.length < 2) { showToast('Select 2+ shapes', 'info'); return; }
      const allSelected = ss.filter(s => ids.includes(s.id));
      const sorted = [...allSelected].sort((a, b) => (a.x + a.y) - (b.x + b.y));
      const startX = sorted[0].x;
      const startY = sorted[0].y;
      const gap = 24;
      sorted.forEach((s, i) => {
        const step = i * (Math.max(s.width, s.height) + gap);
        d().updateShape(s.id, { x: startX + step, y: startY + step });
      });
      showToast(`Arranged ${sorted.length} shapes diagonally`, 'action');
    }},
    { id: 'arrange-stack-center', label: 'Stack centered (Z-pile)', group: 'Arrange', icon: '⊕', action: () => {
      const { selectedIds: sids, selectedId, shapes: ss } = d().state;
      const ids = sids.length > 0 ? sids : (selectedId ? [selectedId] : []);
      if (ids.length < 2) { showToast('Select 2+ shapes', 'info'); return; }
      const allSelected = ss.filter(s => ids.includes(s.id));
      const cx = allSelected.reduce((sum, s) => sum + s.x + s.width / 2, 0) / allSelected.length;
      const cy = allSelected.reduce((sum, s) => sum + s.y + s.height / 2, 0) / allSelected.length;
      for (const s of allSelected) {
        d().updateShape(s.id, { x: cx - s.width / 2, y: cy - s.height / 2 });
      }
      showToast(`Stacked ${allSelected.length} shapes at center`, 'action');
    }},
    { id: 'arrange-nudge-apart', label: 'Nudge overlapping shapes apart', group: 'Arrange', icon: '↔', action: () => {
      const { selectedIds: sids, selectedId, shapes: ss } = d().state;
      const ids = sids.length > 0 ? sids : (selectedId ? [selectedId] : []);
      if (ids.length < 2) { showToast('Select 2+ shapes', 'info'); return; }
      const allSelected = ss.filter(s => ids.includes(s.id));
      const GAP = 8;
      // Simple iterative separation: for each pair, push apart if overlapping
      const ITERATIONS = 5;
      const positions = allSelected.map(s => ({ id: s.id, x: s.x, y: s.y, w: s.width, h: s.height }));
      for (let iter = 0; iter < ITERATIONS; iter++) {
        for (let i = 0; i < positions.length; i++) {
          for (let j = i + 1; j < positions.length; j++) {
            const a = positions[i]; const b = positions[j];
            const overlapX = Math.min(a.x + a.w + GAP, b.x + b.w + GAP) - Math.max(a.x, b.x);
            const overlapY = Math.min(a.y + a.h + GAP, b.y + b.h + GAP) - Math.max(a.y, b.y);
            if (overlapX > 0 && overlapY > 0) {
              // Push along the smaller overlap axis
              if (overlapX < overlapY) {
                const half = overlapX / 2;
                if (a.x < b.x) { a.x -= half; b.x += half; } else { a.x += half; b.x -= half; }
              } else {
                const half = overlapY / 2;
                if (a.y < b.y) { a.y -= half; b.y += half; } else { a.y += half; b.y -= half; }
              }
            }
          }
        }
      }
      for (const pos of positions) {
        d().updateShape(pos.id, { x: Math.round(pos.x), y: Math.round(pos.y) });
      }
      showToast(`Separated ${allSelected.length} shapes`, 'action');
    }},

    { id: 'arrange-radial', label: 'Arrange in radial circle (hook)', group: 'Arrange', icon: '◉', action: () => { d().arrangeRadial(); showToast('Arranged radially', 'action'); }},
    { id: 'arrange-spiral', label: 'Arrange in golden spiral', group: 'Arrange', icon: '🌀', action: () => { d().arrangeSpiral(); showToast('Arranged in spiral', 'action'); }},
    { id: 'arrange-scatter', label: 'Scatter shapes randomly (seeded)', group: 'Arrange', icon: '✦', action: () => { d().scatterRandom(); showToast('Scattered shapes', 'action'); }},
    { id: 'arrange-morph-5', label: 'Morph between 2 selected shapes (5 steps)', group: 'Arrange', icon: '↔', action: () => {
      const { selectedIds } = d().state;
      if (selectedIds.length !== 2) { showToast('Select exactly 2 shapes to morph', 'info'); return; }
      d().morphShapes(5);
      showToast('Created 5 morph steps', 'action');
    }},
    { id: 'arrange-morph-10', label: 'Morph between 2 selected shapes (10 steps)', group: 'Arrange', icon: '↔', action: () => {
      const { selectedIds } = d().state;
      if (selectedIds.length !== 2) { showToast('Select exactly 2 shapes to morph', 'info'); return; }
      d().morphShapes(10);
      showToast('Created 10 morph steps', 'action');
    }},
    { id: 'arrange-swap', label: 'Swap positions of 2 selected shapes', group: 'Arrange', icon: '⇄', action: () => {
      const { selectedIds } = d().state;
      if (selectedIds.length !== 2) { showToast('Select exactly 2 shapes to swap', 'info'); return; }
      d().swapPositions();
      showToast('Positions swapped', 'action');
    }},
    { id: 'arrange-stack-h', label: 'Stack selected shapes horizontally (gap 16)', group: 'Arrange', icon: '⬛⬛⬛', action: () => {
      const { selectedIds } = d().state;
      if (selectedIds.length < 2) { showToast('Select 2+ shapes to stack', 'info'); return; }
      d().stackHorizontal(16);
      showToast(`Stacked ${selectedIds.length} shapes horizontally`, 'action');
    }},
    { id: 'arrange-stack-h-tight', label: 'Stack selected shapes horizontally (tight, gap 0)', group: 'Arrange', icon: '⬜⬜⬜', action: () => {
      const { selectedIds } = d().state;
      if (selectedIds.length < 2) { showToast('Select 2+ shapes to stack', 'info'); return; }
      d().stackHorizontal(0);
      showToast(`Stacked ${selectedIds.length} shapes (tight)`, 'action');
    }},
    { id: 'arrange-stack-v', label: 'Stack selected shapes vertically (gap 16)', group: 'Arrange', icon: '▪▪▪', action: () => {
      const { selectedIds } = d().state;
      if (selectedIds.length < 2) { showToast('Select 2+ shapes to stack', 'info'); return; }
      d().stackVertical(16);
      showToast(`Stacked ${selectedIds.length} shapes vertically`, 'action');
    }},
    { id: 'arrange-auto-layout', label: 'Auto-detect layout and wrap in frame', group: 'Arrange', icon: '⊞', action: () => {
      const { selectedIds } = d().state;
      if (selectedIds.length < 2) { showToast('Select 2+ shapes', 'info'); return; }
      const dir = d().autoDetectLayout();
      if (dir === 'none') { showToast('Select 2+ shapes', 'info'); }
      else { showToast(`Created ${dir} auto-layout frame`, 'action'); }
    }},
    { id: 'arrange-distribute-h-equal', label: 'Distribute horizontal spacing equally', group: 'Arrange', icon: '↔', action: () => {
      const { selectedIds } = d().state;
      if (selectedIds.length < 3) { showToast('Select 3+ shapes to distribute', 'info'); return; }
      d().distributeHorizontal();
      showToast('Distributed horizontally', 'action');
    }},
    { id: 'arrange-distribute-v-equal', label: 'Distribute vertical spacing equally', group: 'Arrange', icon: '↕', action: () => {
      const { selectedIds } = d().state;
      if (selectedIds.length < 3) { showToast('Select 3+ shapes to distribute', 'info'); return; }
      d().distributeVertical();
      showToast('Distributed vertically', 'action');
    }},
    { id: 'arrange-grid-2x2', label: 'Grid repeat: 2×2', group: 'Arrange', icon: '⊞', action: () => {
      const { selectedId, selectedIds } = d().state;
      if (!selectedId && selectedIds.length === 0) { showToast('Select a shape first', 'info'); return; }
      d().gridRepeat(2, 2, 16, 16);
      showToast('Grid 2×2 created', 'action');
    }},
    { id: 'arrange-grid-3x3', label: 'Grid repeat: 3×3', group: 'Arrange', icon: '⣿', action: () => {
      const { selectedId, selectedIds } = d().state;
      if (!selectedId && selectedIds.length === 0) { showToast('Select a shape first', 'info'); return; }
      d().gridRepeat(3, 3, 16, 16);
      showToast('Grid 3×3 created', 'action');
    }},
    { id: 'arrange-grid-4x1', label: 'Grid repeat: row of 4', group: 'Arrange', icon: '⬛⬛⬛⬛', action: () => {
      const { selectedId, selectedIds } = d().state;
      if (!selectedId && selectedIds.length === 0) { showToast('Select a shape first', 'info'); return; }
      d().gridRepeat(4, 1, 16, 16);
      showToast('Row of 4 created', 'action');
    }},
    { id: 'arrange-grid-1x4', label: 'Grid repeat: column of 4', group: 'Arrange', icon: '▪▪▪▪', action: () => {
      const { selectedId, selectedIds } = d().state;
      if (!selectedId && selectedIds.length === 0) { showToast('Select a shape first', 'info'); return; }
      d().gridRepeat(1, 4, 16, 16);
      showToast('Column of 4 created', 'action');
    }},

    // ── Generate effects ──────────────────────────────────────────────────────
    { id: 'effect-gradient-mesh', label: 'Generate gradient mesh (aurora blobs) at cursor', group: 'Generate', icon: '🌈', action: () => {
      // Creates 5-6 overlapping, blurred, colorful ellipses forming an aurora mesh
      const MESH_COLORS = [
        '#6366f1', '#a855f7', '#ec4899', '#3b82f6', '#14b8a6', '#f59e0b',
      ];
      const { shapes: ss } = d().state;
      const baseX = ss.length > 0 ? Math.max(...ss.map(s => s.x + s.width)) + 60 : 100;
      const baseY = 100;
      const W = 400, H = 300;
      const count = 5 + Math.floor(Math.random() * 2);
      const newIds: string[] = [];
      for (let i = 0; i < count; i++) {
        const color = MESH_COLORS[i % MESH_COLORS.length];
        const blobW = 200 + Math.random() * 120;
        const blobH = 160 + Math.random() * 100;
        const blobX = baseX + Math.random() * (W - blobW);
        const blobY = baseY + Math.random() * (H - blobH);
        const blob = defaultShape('ellipse', uuid());
        Object.assign(blob, {
          x: blobX, y: blobY,
          width: blobW, height: blobH,
          fill: color,
          fillType: 'solid',
          stroke: 'transparent',
          strokeWidth: 0,
          opacity: 0.55 + Math.random() * 0.25,
          filterBlur: 40 + Math.random() * 30,
          blendMode: i === 0 ? 'normal' : 'screen',
          name: `Mesh Blob ${i + 1}`,
        });
        d().addShape(blob);
        newIds.push(blob.id);
      }
      // Add a dark frame behind the blobs
      const bg = defaultShape('rectangle', uuid());
      Object.assign(bg, {
        x: baseX, y: baseY, width: W, height: H,
        fill: '#0f0f1a', fillType: 'solid',
        stroke: 'transparent', strokeWidth: 0,
        borderRadius: 16,
        name: 'Mesh Background',
      });
      d().addShape(bg);
      // Move bg to back
      d().sendToBack();
      d().setSelectedIds([bg.id, ...newIds]);
      showToast('Gradient mesh generated — group to combine', 'action');
    }},
    { id: 'effect-glassmorphism', label: 'Generate glassmorphism card', group: 'Generate', icon: '🔮', action: () => {
      const { shapes: ss } = d().state;
      const baseX = ss.length > 0 ? Math.max(...ss.map(s => s.x + s.width)) + 60 : 100;
      const baseY = 100;
      // Background gradient blob
      const blob = defaultShape('ellipse', uuid());
      Object.assign(blob, {
        x: baseX - 40, y: baseY - 40, width: 280, height: 200,
        fill: '#6366f1', fillType: 'solid',
        opacity: 0.8, filterBlur: 60, name: 'Glass Blob',
        stroke: 'transparent', strokeWidth: 0,
      });
      // Glass card
      const card = defaultShape('rectangle', uuid());
      Object.assign(card, {
        x: baseX, y: baseY, width: 240, height: 140,
        fill: 'rgba(255,255,255,0.1)', fillType: 'solid',
        stroke: 'rgba(255,255,255,0.25)', strokeWidth: 1,
        borderRadius: 16,
        filterBackdropBlur: 20,
        shadow: true, shadowX: 0, shadowY: 8, shadowBlur: 32, shadowColor: 'rgba(0,0,0,0.25)',
        name: 'Glass Card',
      });
      // Text inside
      const title = defaultShape('text', uuid());
      Object.assign(title, {
        x: baseX + 20, y: baseY + 20, width: 200, height: 28,
        text: 'Glassmorphism', color: '#ffffff', fontSize: 18, fontWeight: '700', name: 'Card Title',
      });
      const sub = defaultShape('text', uuid());
      Object.assign(sub, {
        x: baseX + 20, y: baseY + 52, width: 200, height: 20,
        text: 'Frosted glass effect', color: 'rgba(255,255,255,0.7)', fontSize: 13, name: 'Card Subtitle',
      });
      [blob, card, title, sub].forEach(s => d().addShape(s));
      d().setSelectedIds([blob.id, card.id, title.id, sub.id]);
      showToast('Glassmorphism card generated', 'action');
    }},
    { id: 'effect-neumorphism', label: 'Generate neumorphism card', group: 'Generate', icon: '⬜', action: () => {
      const { shapes: ss } = d().state;
      const baseX = ss.length > 0 ? Math.max(...ss.map(s => s.x + s.width)) + 60 : 100;
      const baseY = 100;
      const bg = defaultShape('rectangle', uuid());
      Object.assign(bg, {
        x: baseX - 30, y: baseY - 30, width: 300, height: 220,
        fill: '#e0e5ec', fillType: 'solid', stroke: 'transparent', strokeWidth: 0,
        borderRadius: 20,
        shadows: [
          { x: 8, y: 8, blur: 16, color: '#a3b1c6', inset: false },
          { x: -8, y: -8, blur: 16, color: '#ffffff', inset: false },
        ],
        name: 'Neumorphic Background',
      });
      const button = defaultShape('rectangle', uuid());
      Object.assign(button, {
        x: baseX + 55, y: baseY + 80, width: 130, height: 48,
        fill: '#e0e5ec', fillType: 'solid', stroke: 'transparent', strokeWidth: 0,
        borderRadius: 24,
        shadows: [
          { x: 6, y: 6, blur: 12, color: '#a3b1c6', inset: false },
          { x: -6, y: -6, blur: 12, color: '#ffffff', inset: false },
        ],
        name: 'Neumorphic Button',
      });
      const label = defaultShape('text', uuid());
      Object.assign(label, {
        x: baseX + 55, y: baseY + 92, width: 130, height: 24,
        text: 'Get Started', color: '#6366f1', fontSize: 14, fontWeight: '600', textAlign: 'center', name: 'Button Label',
      });
      [bg, button, label].forEach(s => d().addShape(s));
      d().setSelectedIds([bg.id, button.id, label.id]);
      showToast('Neumorphism card generated', 'action');
    }},
    { id: 'effect-bento-grid', label: 'Generate Bento grid layout (6 cards)', group: 'Generate', icon: '⊞', action: () => {
      const { shapes: ss } = d().state;
      const bx = ss.length > 0 ? Math.max(...ss.map(s => s.x + s.width)) + 60 : 100;
      const by = 100;
      const GAP = 12;
      const BG = '#0f0f17';
      // background
      const bg = Object.assign(defaultShape('rectangle', uuid()), {
        x: bx - 20, y: by - 20, width: 500, height: 420,
        fill: BG, fillType: 'solid', stroke: 'transparent', strokeWidth: 0, borderRadius: 20, name: 'Bento Background',
      });
      // Bento card layouts: [x%, y%, w%, h%, color, text]
      const cells: [number, number, number, number, string, string][] = [
        [0,    0,    0.58, 0.48, '#6366f1', 'Main Feature'],
        [0.62, 0,    0.38, 0.48, '#8b5cf6', 'Stat'],
        [0,    0.52, 0.38, 0.48, '#10b981', 'Growth'],
        [0.42, 0.52, 0.2,  0.48, '#f97316', 'API'],
        [0.66, 0.52, 0.34, 0.48, '#3b82f6', 'Integrations'],
      ];
      const BENTO_W = 460, BENTO_H = 380;
      const newIds: string[] = [bg.id];
      d().addShape(bg);
      for (const [rx, ry, rw, rh, fill, text] of cells) {
        const card = Object.assign(defaultShape('rectangle', uuid()), {
          x: bx + rx * BENTO_W, y: by + ry * BENTO_H,
          width: rw * BENTO_W - GAP, height: rh * BENTO_H - GAP,
          fill, fillType: 'solid', stroke: 'transparent', strokeWidth: 0,
          borderRadius: 12, opacity: 0.92, name: `Bento: ${text}`,
        });
        const label = Object.assign(defaultShape('text', uuid()), {
          x: card.x + 16, y: card.y + 12, width: card.width - 32, height: 24,
          text, color: '#fff', fontSize: 14, fontWeight: '700', name: `${text} Label`,
        });
        d().addShape(card); d().addShape(label);
        newIds.push(card.id, label.id);
      }
      d().setSelectedIds(newIds);
      showToast('Bento grid generated', 'action');
    }},
    { id: 'effect-dashboard-stats', label: 'Generate dashboard stat cards (4 metrics)', group: 'Generate', icon: '📊', action: () => {
      const { shapes: ss } = d().state;
      const bx = ss.length > 0 ? Math.max(...ss.map(s => s.x + s.width)) + 60 : 100;
      const by = 100;
      const stats = [
        { label: 'Total Revenue', value: '$45,231', change: '↑ 20.1%', color: '#6366f1' },
        { label: 'Subscriptions', value: '+2,350', change: '↑ 180.1%', color: '#10b981' },
        { label: 'Active Users', value: '12,234', change: '↑ 19%', color: '#3b82f6' },
        { label: 'Churn Rate', value: '3.2%', change: '↓ 4.1%', color: '#f97316' },
      ];
      const newIds: string[] = [];
      stats.forEach((stat, i) => {
        const cx = bx + i * 160;
        const card = Object.assign(defaultShape('rectangle', uuid()), {
          x: cx, y: by, width: 148, height: 90,
          fill: '#1a1a2e', fillType: 'solid', stroke: 'rgba(255,255,255,0.08)', strokeWidth: 1,
          borderRadius: 10, name: `Stat: ${stat.label}`,
        });
        const labelT = Object.assign(defaultShape('text', uuid()), {
          x: cx + 12, y: by + 12, width: 124, height: 16,
          text: stat.label, color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '500',
        });
        const valueT = Object.assign(defaultShape('text', uuid()), {
          x: cx + 12, y: by + 32, width: 124, height: 28,
          text: stat.value, color: '#fff', fontSize: 22, fontWeight: '700',
        });
        const changeT = Object.assign(defaultShape('text', uuid()), {
          x: cx + 12, y: by + 64, width: 124, height: 16,
          text: stat.change, color: stat.color, fontSize: 11, fontWeight: '600',
        });
        [card, labelT, valueT, changeT].forEach(s => { d().addShape(s); newIds.push(s.id); });
      });
      d().setSelectedIds(newIds);
      showToast('Dashboard stats generated', 'action');
    }},
    { id: 'effect-hero-section', label: 'Generate hero section', group: 'Generate', icon: '🦸', action: () => {
      const { shapes: ss } = d().state;
      const bx = ss.length > 0 ? Math.max(...ss.map(s => s.x + s.width)) + 60 : 100;
      const by = 100;
      const newIds: string[] = [];
      // Hero background with gradient
      const heroBg = Object.assign(defaultShape('rectangle', uuid()), {
        x: bx, y: by, width: 600, height: 320,
        fill: '#6366f1', fillType: 'linear-gradient',
        gradientStops: [{ color: '#4f46e5', position: 0 }, { color: '#a855f7', position: 1 }],
        gradientAngle: 135,
        stroke: 'transparent', strokeWidth: 0, borderRadius: 16,
        name: 'Hero Background',
      });
      // Badge
      const badge = Object.assign(defaultShape('rectangle', uuid()), {
        x: bx + 40, y: by + 48, width: 120, height: 24,
        fill: 'rgba(255,255,255,0.15)', fillType: 'solid',
        stroke: 'rgba(255,255,255,0.3)', strokeWidth: 1, borderRadius: 12, name: 'Hero Badge',
      });
      const badgeT = Object.assign(defaultShape('text', uuid()), {
        x: bx + 40, y: by + 51, width: 120, height: 18,
        text: '✨ New in 2025', color: '#fff', fontSize: 11, fontWeight: '600', textAlign: 'center',
      });
      // Heading
      const h1 = Object.assign(defaultShape('text', uuid()), {
        x: bx + 40, y: by + 88, width: 520, height: 60,
        text: 'Ship faster with Quill', color: '#fff', fontSize: 36, fontWeight: '800', name: 'Hero Heading',
      });
      // Subtext
      const sub = Object.assign(defaultShape('text', uuid()), {
        x: bx + 40, y: by + 158, width: 400, height: 40,
        text: 'Design beautiful interfaces in half the time. No design experience required.',
        color: 'rgba(255,255,255,0.8)', fontSize: 15, lineHeight: 1.5, name: 'Hero Subtext',
      });
      // CTA button
      const cta = Object.assign(defaultShape('rectangle', uuid()), {
        x: bx + 40, y: by + 220, width: 140, height: 44,
        fill: '#fff', fillType: 'solid', stroke: 'transparent', strokeWidth: 0, borderRadius: 10,
        shadow: true, shadowX: 0, shadowY: 4, shadowBlur: 16, shadowColor: 'rgba(0,0,0,0.2)',
        name: 'CTA Button',
      });
      const ctaT = Object.assign(defaultShape('text', uuid()), {
        x: bx + 40, y: by + 232, width: 140, height: 20,
        text: 'Get started →', color: '#6366f1', fontSize: 14, fontWeight: '700', textAlign: 'center',
      });
      // Secondary button
      const sec = Object.assign(defaultShape('rectangle', uuid()), {
        x: bx + 196, y: by + 220, width: 120, height: 44,
        fill: 'rgba(255,255,255,0.1)', fillType: 'solid',
        stroke: 'rgba(255,255,255,0.3)', strokeWidth: 1, borderRadius: 10, name: 'Secondary Button',
      });
      const secT = Object.assign(defaultShape('text', uuid()), {
        x: bx + 196, y: by + 232, width: 120, height: 20,
        text: 'Learn more', color: '#fff', fontSize: 14, fontWeight: '600', textAlign: 'center',
      });
      [heroBg, badge, badgeT, h1, sub, cta, ctaT, sec, secT].forEach(s => { d().addShape(s); newIds.push(s.id); });
      d().setSelectedIds(newIds);
      showToast('Hero section generated', 'action');
    }},

    // ── Variant commands (dynamic based on selected shape) ──────────────────
    ...(() => {
      const { selectedId, shapes: ss } = d().state;
      const sel = selectedId ? ss.find(s => s.id === selectedId) : undefined;
      if (!sel || !sel.variants || Object.keys(sel.variants).length === 0) return [];
      const cmds: CommandItem[] = [];
      const allNames = ['Default', ...Object.keys(sel.variants).filter(k => k !== 'Default')];
      for (const name of allNames) {
        const capName = name; // capture
        const capSelId = sel.id;
        cmds.push({
          id: `variant-switch-${capName}`,
          label: `Switch to "${capName}" variant`,
          group: 'Variants',
          icon: '⊞',
          action: () => {
            const current = d().state.shapes.find(s => s.id === capSelId);
            if (!current) return;
            if (capName === 'Default') {
              const def = current.variants?.['Default'];
              if (def) {
                d().updateShape(capSelId, { activeVariant: 'Default', ...def });
              } else {
                d().updateShape(capSelId, { activeVariant: 'Default' });
              }
            } else {
              const v = current.variants?.[capName];
              if (v) {
                d().updateShape(capSelId, { activeVariant: capName, ...v });
              }
            }
            showToast(`Switched to "${capName}" variant`, 'action');
          },
        });
      }
      return cmds;
    })(),

    // ── Constraint commands ─────────────────────────────────────────────────
    { id: 'constraint-h-left', label: 'Constraint: pin left (horizontal)', group: 'Constraints', icon: '⟵', action: () => {
      const { selectedIds: sids, selectedId } = d().state;
      const ids = sids.length > 0 ? sids : (selectedId ? [selectedId] : []);
      ids.forEach(id => d().updateShape(id, { constraintH: 'left' }));
    }},
    { id: 'constraint-h-right', label: 'Constraint: pin right (horizontal)', group: 'Constraints', icon: '⟶', action: () => {
      const { selectedIds: sids, selectedId } = d().state;
      const ids = sids.length > 0 ? sids : (selectedId ? [selectedId] : []);
      ids.forEach(id => d().updateShape(id, { constraintH: 'right' }));
    }},
    { id: 'constraint-h-center', label: 'Constraint: center horizontally', group: 'Constraints', icon: '↔', action: () => {
      const { selectedIds: sids, selectedId } = d().state;
      const ids = sids.length > 0 ? sids : (selectedId ? [selectedId] : []);
      ids.forEach(id => d().updateShape(id, { constraintH: 'center' }));
    }},
    { id: 'constraint-h-stretch', label: 'Constraint: stretch (pin left + right)', group: 'Constraints', icon: '⟷', action: () => {
      const { selectedIds: sids, selectedId } = d().state;
      const ids = sids.length > 0 ? sids : (selectedId ? [selectedId] : []);
      ids.forEach(id => d().updateShape(id, { constraintH: 'left-right' }));
    }},
    { id: 'constraint-v-top', label: 'Constraint: pin top (vertical)', group: 'Constraints', icon: '⟰', action: () => {
      const { selectedIds: sids, selectedId } = d().state;
      const ids = sids.length > 0 ? sids : (selectedId ? [selectedId] : []);
      ids.forEach(id => d().updateShape(id, { constraintV: 'top' }));
    }},
    { id: 'constraint-v-bottom', label: 'Constraint: pin bottom (vertical)', group: 'Constraints', icon: '⟱', action: () => {
      const { selectedIds: sids, selectedId } = d().state;
      const ids = sids.length > 0 ? sids : (selectedId ? [selectedId] : []);
      ids.forEach(id => d().updateShape(id, { constraintV: 'bottom' }));
    }},
    { id: 'constraint-v-center', label: 'Constraint: center vertically', group: 'Constraints', icon: '↕', action: () => {
      const { selectedIds: sids, selectedId } = d().state;
      const ids = sids.length > 0 ? sids : (selectedId ? [selectedId] : []);
      ids.forEach(id => d().updateShape(id, { constraintV: 'center' }));
    }},
    { id: 'constraint-v-stretch', label: 'Constraint: stretch (pin top + bottom)', group: 'Constraints', icon: '⥉', action: () => {
      const { selectedIds: sids, selectedId } = d().state;
      const ids = sids.length > 0 ? sids : (selectedId ? [selectedId] : []);
      ids.forEach(id => d().updateShape(id, { constraintV: 'top-bottom' }));
    }},
    { id: 'constraint-scale', label: 'Constraint: scale proportionally (both axes)', group: 'Constraints', icon: '⤢', action: () => {
      const { selectedIds: sids, selectedId } = d().state;
      const ids = sids.length > 0 ? sids : (selectedId ? [selectedId] : []);
      ids.forEach(id => d().updateShape(id, { constraintH: 'scale', constraintV: 'scale' }));
    }},

    // ── Color commands ──────────────────────────────────────────────────────
    { id: 'color-randomize', label: 'Randomize fill colors of selected shapes', group: 'Color', icon: '🎲', action: () => {
      const { selectedIds: sids, selectedId, shapes: ss } = d().state;
      const ids = sids.length > 0 ? sids : (selectedId ? [selectedId] : []);
      if (ids.length === 0) { showToast('Select shapes first', 'info'); return; }
      const palette = ['#6366f1', '#8b5cf6', '#ec4899', '#f97316', '#14b8a6', '#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#a855f7'];
      for (const id of ids) {
        const color = palette[Math.floor(Math.random() * palette.length)];
        d().updateShape(id, { fill: color, fillType: 'solid' });
      }
      showToast(`Randomized ${ids.length} colors`, 'action');
    }},
    { id: 'color-make-monochrome', label: 'Make selection monochrome (desaturate)', group: 'Color', icon: '◑', action: () => {
      const { selectedIds: sids, selectedId, shapes: ss } = d().state;
      const ids = sids.length > 0 ? sids : (selectedId ? [selectedId] : []);
      if (ids.length === 0) { showToast('Select shapes first', 'info'); return; }
      for (const id of ids) {
        const shape = ss.find(s => s.id === id);
        if (!shape || !shape.fill || shape.fill === 'transparent') continue;
        // Convert hex to grayscale
        const hex = shape.fill.replace('#', '');
        if (hex.length !== 6) continue;
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
        const grayHex = gray.toString(16).padStart(2, '0');
        d().updateShape(id, { fill: `#${grayHex}${grayHex}${grayHex}`, filterSaturate: 0 });
      }
      showToast(`Desaturated ${ids.length} shapes`, 'action');
    }},
    { id: 'color-invert', label: 'Invert fill colors of selected shapes', group: 'Color', icon: '⊙', action: () => {
      const { selectedIds: sids, selectedId, shapes: ss } = d().state;
      const ids = sids.length > 0 ? sids : (selectedId ? [selectedId] : []);
      if (ids.length === 0) { showToast('Select shapes first', 'info'); return; }
      for (const id of ids) {
        const shape = ss.find(s => s.id === id);
        if (!shape || !shape.fill || shape.fill === 'transparent') continue;
        const hex = shape.fill.replace('#', '');
        if (hex.length !== 6) continue;
        const r = (255 - parseInt(hex.slice(0, 2), 16)).toString(16).padStart(2, '0');
        const g = (255 - parseInt(hex.slice(2, 4), 16)).toString(16).padStart(2, '0');
        const b = (255 - parseInt(hex.slice(4, 6), 16)).toString(16).padStart(2, '0');
        d().updateShape(id, { fill: `#${r}${g}${b}` });
      }
      showToast(`Inverted ${ids.length} colors`, 'action');
    }},
    { id: 'color-copy-gradient-to-all', label: 'Apply selected shape\'s gradient to all selected', group: 'Color', icon: '∿', action: () => {
      const { selectedIds: sids, selectedId, shapes: ss } = d().state;
      const ids = sids.length > 1 ? sids : [];
      if (ids.length < 2) { showToast('Select 2+ shapes. First selected gets copied.', 'info'); return; }
      const src = ss.find(s => s.id === ids[0]);
      if (!src) return;
      const patch = { fill: src.fill, fillType: src.fillType, gradientStops: src.gradientStops, gradientAngle: src.gradientAngle };
      for (const id of ids.slice(1)) { d().updateShape(id, patch); }
      showToast(`Applied gradient to ${ids.length - 1} shapes`, 'action');
    }},

    // ── Shape size commands ─────────────────────────────────────────────────
    { id: 'size-make-same-width', label: 'Make selected shapes same width', group: 'Size', icon: '↔', action: () => {
      const { selectedIds: sids, selectedId, shapes: ss } = d().state;
      const ids = sids.length > 1 ? sids : [];
      if (ids.length < 2) { showToast('Select 2+ shapes', 'info'); return; }
      const src = ss.find(s => s.id === ids[0]);
      if (!src) return;
      for (const id of ids.slice(1)) { d().updateShape(id, { width: src.width }); }
      showToast(`Made ${ids.length - 1} shapes ${src.width}px wide`, 'action');
    }},
    { id: 'size-make-same-height', label: 'Make selected shapes same height', group: 'Size', icon: '↕', action: () => {
      const { selectedIds: sids, selectedId, shapes: ss } = d().state;
      const ids = sids.length > 1 ? sids : [];
      if (ids.length < 2) { showToast('Select 2+ shapes', 'info'); return; }
      const src = ss.find(s => s.id === ids[0]);
      if (!src) return;
      for (const id of ids.slice(1)) { d().updateShape(id, { height: src.height }); }
      showToast(`Made ${ids.length - 1} shapes ${src.height}px tall`, 'action');
    }},
    { id: 'size-make-same-size', label: 'Make selected shapes same size as first', group: 'Size', icon: '⊞', action: () => {
      const { selectedIds: sids, selectedId, shapes: ss } = d().state;
      const ids = sids.length > 1 ? sids : [];
      if (ids.length < 2) { showToast('Select 2+ shapes', 'info'); return; }
      const src = ss.find(s => s.id === ids[0]);
      if (!src) return;
      for (const id of ids.slice(1)) { d().updateShape(id, { width: src.width, height: src.height }); }
      showToast(`Resized ${ids.length - 1} shapes to ${src.width}×${src.height}`, 'action');
    }},
    { id: 'size-double', label: 'Double size of selected shapes', group: 'Size', icon: '⊕', action: () => {
      const { selectedIds: sids, selectedId, shapes: ss } = d().state;
      const ids = sids.length > 0 ? sids : (selectedId ? [selectedId] : []);
      if (ids.length === 0) { showToast('Select shapes first', 'info'); return; }
      for (const id of ids) {
        const s = ss.find(sh => sh.id === id);
        if (s) d().updateShape(id, { width: s.width * 2, height: s.height * 2 });
      }
      showToast(`Doubled ${ids.length} shapes`, 'action');
    }},
    { id: 'size-halve', label: 'Halve size of selected shapes', group: 'Size', icon: '⊖', action: () => {
      const { selectedIds: sids, selectedId, shapes: ss } = d().state;
      const ids = sids.length > 0 ? sids : (selectedId ? [selectedId] : []);
      if (ids.length === 0) { showToast('Select shapes first', 'info'); return; }
      for (const id of ids) {
        const s = ss.find(sh => sh.id === id);
        if (s) d().updateShape(id, { width: Math.max(8, s.width / 2), height: Math.max(8, s.height / 2) });
      }
      showToast(`Halved ${ids.length} shapes`, 'action');
    }},

    // ── Placeholder content ──────────────────────────────────────────────────
    { id: 'placeholder-lorem-short', label: 'Fill text with short Lorem Ipsum', group: 'Content', icon: '¶', action: () => {
      const { selectedIds: sids, selectedId, shapes: ss } = d().state;
      const ids = sids.length > 0 ? sids : (selectedId ? [selectedId] : []);
      const texts = ['Lorem ipsum dolor sit amet', 'Consectetur adipiscing elit', 'Sed do eiusmod tempor', 'Ut labore et dolore magna', 'Quis nostrud exercitation'];
      let changed = 0;
      ids.forEach((id, i) => {
        const s = ss.find(sh => sh.id === id);
        if (s?.type === 'text') { d().updateShape(id, { text: texts[i % texts.length] }); changed++; }
      });
      showToast(changed > 0 ? `Filled ${changed} text shapes` : 'Select text shapes first', changed > 0 ? 'action' : 'info');
    }},
    { id: 'placeholder-lorem-paragraph', label: 'Fill text with Lorem Ipsum paragraph', group: 'Content', icon: '¶', action: () => {
      const { selectedIds: sids, selectedId, shapes: ss } = d().state;
      const ids = sids.length > 0 ? sids : (selectedId ? [selectedId] : []);
      const paras = [
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
        'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
        'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.',
      ];
      let changed = 0;
      ids.forEach((id, i) => {
        const s = ss.find(sh => sh.id === id);
        if (s?.type === 'text') { d().updateShape(id, { text: paras[i % paras.length] }); changed++; }
      });
      showToast(changed > 0 ? `Filled ${changed} text shapes` : 'Select text shapes first', changed > 0 ? 'action' : 'info');
    }},
    { id: 'placeholder-image-unsplash', label: 'Set placeholder image (random Unsplash)', group: 'Content', icon: '🖼', action: () => {
      const { selectedIds: sids, selectedId, shapes: ss } = d().state;
      const ids = sids.length > 0 ? sids : (selectedId ? [selectedId] : []);
      const topics = ['nature', 'architecture', 'technology', 'people', 'abstract', 'city'];
      let changed = 0;
      ids.forEach((id, i) => {
        const s = ss.find(sh => sh.id === id);
        if (s && s.type !== 'text' && s.type !== 'path') {
          const topic = topics[i % topics.length];
          const seed = Math.floor(Math.random() * 1000);
          const url = `https://picsum.photos/seed/${seed}/${Math.round(s.width)}/${Math.round(s.height)}`;
          d().updateShape(id, { imageUrl: url, fillType: 'image', imageFit: 'fill' });
          changed++;
        }
      });
      showToast(changed > 0 ? `Set placeholder image on ${changed} shapes` : 'Select non-text shapes', changed > 0 ? 'action' : 'info');
    }},
    { id: 'placeholder-names', label: 'Fill text with random names', group: 'Content', icon: '👤', action: () => {
      const { selectedIds: sids, selectedId, shapes: ss } = d().state;
      const ids = sids.length > 0 ? sids : (selectedId ? [selectedId] : []);
      const names = ['Alex Johnson', 'Jordan Smith', 'Sam Rivera', 'Taylor Chen', 'Morgan Davis', 'Casey Brown', 'Riley Wilson', 'Quinn Martinez'];
      let changed = 0;
      ids.forEach((id, i) => {
        const s = ss.find(sh => sh.id === id);
        if (s?.type === 'text') { d().updateShape(id, { text: names[i % names.length] }); changed++; }
      });
      showToast(changed > 0 ? `Filled ${changed} text shapes with names` : 'Select text shapes first', changed > 0 ? 'action' : 'info');
    }},
    { id: 'placeholder-numbers', label: 'Fill text with random numbers (stats/metrics)', group: 'Content', icon: '#', action: () => {
      const { selectedIds: sids, selectedId, shapes: ss } = d().state;
      const ids = sids.length > 0 ? sids : (selectedId ? [selectedId] : []);
      const stats = ['$4,291', '98.7%', '12,543', '↑ 24%', '3.2k', '$12.4M', '99.9%', '1,024'];
      let changed = 0;
      ids.forEach((id, i) => {
        const s = ss.find(sh => sh.id === id);
        if (s?.type === 'text') { d().updateShape(id, { text: stats[i % stats.length] }); changed++; }
      });
      showToast(changed > 0 ? `Filled ${changed} text shapes with numbers` : 'Select text shapes first', changed > 0 ? 'action' : 'info');
    }},

    // ── Annotation / Measurement ─────────────────────────────────────────────
    { id: 'annotate-dimensions', label: 'Add dimension annotations to selected shapes', group: 'Annotate', icon: '⟺', action: () => {
      const { selectedIds: sids, selectedId, shapes: ss } = d().state;
      const ids = sids.length > 0 ? sids : (selectedId ? [selectedId] : []);
      if (ids.length === 0) { showToast('Select shapes first', 'info'); return; }
      const newIds: string[] = [];
      for (const id of ids) {
        const s = ss.find(sh => sh.id === id);
        if (!s) continue;
        // Width dimension line (below the shape)
        const yPos = s.y + s.height + 20;
        const wLine = Object.assign(defaultShape('path', uuid()), {
          x: s.x, y: yPos, width: s.width, height: 1,
          fill: 'transparent', stroke: '#ef4444', strokeWidth: 1.5,
          points: [
            { x: 0, y: 0.5 }, { x: 1, y: 0.5 },  // main line
          ],
          name: `↔ ${Math.round(s.width)}px`,
        });
        const wLabel = Object.assign(defaultShape('text', uuid()), {
          x: s.x + s.width / 2 - 30, y: yPos + 4, width: 60, height: 16,
          text: `${Math.round(s.width)}px`, color: '#ef4444',
          fontSize: 10, fontWeight: '600', textAlign: 'center',
          name: `Width: ${Math.round(s.width)}px`,
        });
        // Height dimension line (to the right of the shape)
        const xPos = s.x + s.width + 20;
        const hLine = Object.assign(defaultShape('path', uuid()), {
          x: xPos, y: s.y, width: 1, height: s.height,
          fill: 'transparent', stroke: '#3b82f6', strokeWidth: 1.5,
          points: [
            { x: 0.5, y: 0 }, { x: 0.5, y: 1 },
          ],
          name: `↕ ${Math.round(s.height)}px`,
        });
        const hLabel = Object.assign(defaultShape('text', uuid()), {
          x: xPos + 4, y: s.y + s.height / 2 - 8, width: 60, height: 16,
          text: `${Math.round(s.height)}px`, color: '#3b82f6',
          fontSize: 10, fontWeight: '600',
          name: `Height: ${Math.round(s.height)}px`,
        });
        [wLine, wLabel, hLine, hLabel].forEach(sh => { d().addShape(sh); newIds.push(sh.id); });
      }
      d().setSelectedIds(newIds);
      showToast(`Added dimension annotations for ${ids.length} shape${ids.length > 1 ? 's' : ''}`, 'action');
    }},
    { id: 'annotate-spacing', label: 'Add spacing annotation between 2 shapes', group: 'Annotate', icon: '↔', action: () => {
      const { selectedIds: sids, shapes: ss } = d().state;
      if (sids.length !== 2) { showToast('Select exactly 2 shapes', 'info'); return; }
      const [a, b] = sids.map(id => ss.find(s => s.id === id)).filter(Boolean) as typeof ss;
      if (!a || !b) return;
      // Measure horizontal gap between them
      const leftShape = a.x < b.x ? a : b;
      const rightShape = a.x < b.x ? b : a;
      const gapH = rightShape.x - (leftShape.x + leftShape.width);
      const midY = Math.min(a.y, b.y) + Math.abs(a.y - b.y) / 2;

      if (gapH > 0) {
        // Draw horizontal spacing indicator
        const line = Object.assign(defaultShape('path', uuid()), {
          x: leftShape.x + leftShape.width, y: midY,
          width: gapH, height: 1,
          fill: 'transparent', stroke: '#f97316', strokeWidth: 1.5,
          points: [{ x: 0, y: 0.5 }, { x: 1, y: 0.5 }],
          name: `Gap: ${Math.round(gapH)}px`,
        });
        const label = Object.assign(defaultShape('text', uuid()), {
          x: leftShape.x + leftShape.width + gapH / 2 - 24, y: midY - 18,
          width: 48, height: 16, text: `${Math.round(gapH)}px`,
          color: '#f97316', fontSize: 10, fontWeight: '700', textAlign: 'center',
          name: `Gap H: ${Math.round(gapH)}px`,
        });
        [line, label].forEach(s => { d().addShape(s); });
        d().setSelectedIds([line.id, label.id]);
        showToast(`Horizontal gap: ${Math.round(gapH)}px`, 'action');
      } else {
        showToast('Shapes overlap — no horizontal gap to annotate', 'info');
      }
    }},
  ];
}
