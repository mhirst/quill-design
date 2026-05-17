/**
 * IconPickerPanel
 * A floating icon picker backed by Lucide React.
 * Search → preview 5-column grid → click to insert on canvas.
 *
 * Inserted as a special shape: type='rectangle' with iconId set.
 * The canvas renders it as an SVG icon scaled to fill the shape.
 */
import React, { useState, useCallback, useEffect, useRef, lazy, Suspense } from 'react';
import { X, Search } from 'lucide-react';
import * as LucideIcons from 'lucide-react';

// ─── Icon catalog ─────────────────────────────────────────────────────────────
// Curated list of the most useful icons for UI/UX design work, organized by category.

const ICON_CATALOG: { category: string; icons: string[] }[] = [
  {
    category: 'Interface',
    icons: [
      'Home', 'Settings', 'User', 'Users', 'Search', 'Bell', 'BellOff', 'Menu',
      'X', 'Check', 'ChevronDown', 'ChevronUp', 'ChevronLeft', 'ChevronRight',
      'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'ArrowUpRight',
      'Plus', 'Minus', 'MoreHorizontal', 'MoreVertical', 'Grid', 'Grid2X2',
      'List', 'Filter', 'SortAsc', 'SortDesc', 'Sliders', 'Maximize', 'Minimize',
      'Maximize2', 'Minimize2', 'ExternalLink', 'Link', 'Link2', 'Unlink',
      'Copy', 'Clipboard', 'ClipboardCheck', 'Scissors', 'Move', 'Grab',
    ],
  },
  {
    category: 'Navigation',
    icons: [
      'Map', 'MapPin', 'Navigation', 'Navigation2', 'Compass', 'Globe',
      'Globe2', 'Route', 'Crosshair', 'Locate', 'LocateFixed', 'Flag',
      'Milestone', 'FlagTriangleRight', 'ArrowUpLeft', 'ArrowUpRight',
      'ArrowDownLeft', 'ArrowDownRight', 'CornerUpLeft', 'CornerUpRight',
      'CornerDownLeft', 'CornerDownRight', 'Undo', 'Redo', 'Undo2', 'Redo2',
    ],
  },
  {
    category: 'Communication',
    icons: [
      'Mail', 'MailOpen', 'Inbox', 'Send', 'MessageSquare', 'MessageCircle',
      'MessageSquarePlus', 'MessagesSquare', 'Phone', 'PhoneCall', 'PhoneOff',
      'Video', 'VideoOff', 'Mic', 'MicOff', 'Volume', 'Volume1', 'Volume2',
      'VolumeX', 'Speaker', 'Radio', 'Rss', 'AtSign', 'Hash', 'Share',
      'Share2', 'Forward', 'Reply', 'ReplyAll',
    ],
  },
  {
    category: 'Files & Data',
    icons: [
      'File', 'FileText', 'FileImage', 'FileVideo', 'FileAudio', 'FileCode',
      'FileJson', 'FileSpreadsheet', 'FileArchive', 'Folder', 'FolderOpen',
      'FolderPlus', 'FolderMinus', 'Archive', 'Download', 'Upload', 'Save',
      'Database', 'Server', 'HardDrive', 'Cloud', 'CloudUpload', 'CloudDownload',
      'Package', 'Box', 'Boxes', 'Layers', 'LayersIcon',
    ],
  },
  {
    category: 'Media',
    icons: [
      'Play', 'Pause', 'Square', 'SkipBack', 'SkipForward', 'Rewind',
      'FastForward', 'Shuffle', 'Repeat', 'Repeat1', 'PlayCircle', 'PauseCircle',
      'StopCircle', 'Music', 'Music2', 'Headphones', 'Image', 'Images',
      'Camera', 'CameraOff', 'Film', 'Clapperboard', 'Monitor', 'Tv',
      'Cast', 'Airplay', 'Podcast', 'Disc',
    ],
  },
  {
    category: 'Commerce',
    icons: [
      'ShoppingCart', 'ShoppingBag', 'CreditCard', 'Wallet', 'DollarSign',
      'Euro', 'PoundSterling', 'Bitcoin', 'Banknote', 'Receipt', 'Tag',
      'Tags', 'Ticket', 'Store', 'Package2', 'Truck', 'PackageCheck',
      'Gift', 'Percent', 'TrendingUp', 'TrendingDown', 'BarChart',
      'BarChart2', 'BarChart3', 'LineChart', 'PieChart', 'Landmark',
    ],
  },
  {
    category: 'Security',
    icons: [
      'Lock', 'LockOpen', 'Unlock', 'Shield', 'ShieldCheck', 'ShieldAlert',
      'ShieldOff', 'Key', 'KeyRound', 'Fingerprint', 'Eye', 'EyeOff',
      'Scan', 'QrCode', 'Barcode', 'AlertTriangle', 'AlertCircle',
      'AlertOctagon', 'Info', 'HelpCircle', 'CheckCircle', 'XCircle',
      'Ban', 'Skull', 'Bug', 'ShieldX', 'ShieldPlus',
    ],
  },
  {
    category: 'Design',
    icons: [
      'Pen', 'PenLine', 'PenTool', 'Pencil', 'Eraser', 'Ruler', 'Paintbrush',
      'Paintbrush2', 'Palette', 'Pipette', 'Wand', 'Wand2', 'Crop',
      'Scissors', 'Sliders', 'Sliders2', 'Frame', 'Layout', 'LayoutDashboard',
      'LayoutGrid', 'LayoutList', 'LayoutTemplate', 'PanelLeft', 'PanelRight',
      'PanelTop', 'PanelBottom', 'Columns', 'Rows', 'Sidebar',
    ],
  },
  {
    category: 'Social',
    icons: [
      'Heart', 'HeartOff', 'ThumbsUp', 'ThumbsDown', 'Bookmark', 'BookmarkCheck',
      'BookmarkPlus', 'BookmarkMinus', 'Star', 'StarOff', 'Sparkles',
      'Smile', 'SmilePlus', 'Frown', 'Meh', 'UserPlus', 'UserMinus',
      'UserCheck', 'UserX', 'UserCog', 'UserCircle', 'Contact', 'Handshake',
      'PartyPopper', 'Trophy', 'Medal', 'Award', 'Crown',
    ],
  },
  {
    category: 'Tools & Tech',
    icons: [
      'Code', 'Code2', 'CodeXml', 'Terminal', 'Command', 'Cpu', 'Memory',
      'Wifi', 'WifiOff', 'Bluetooth', 'BluetoothConnected', 'Usb',
      'Battery', 'BatteryCharging', 'BatteryFull', 'BatteryLow',
      'Plug', 'Power', 'Zap', 'ZapOff', 'Wrench', 'Hammer', 'Screwdriver',
      'Settings2', 'Cog', 'Bot', 'BrainCircuit', 'Microchip',
    ],
  },
  {
    category: 'Weather & Nature',
    icons: [
      'Sun', 'Moon', 'CloudSun', 'Cloud', 'CloudRain', 'CloudSnow',
      'CloudLightning', 'Wind', 'Umbrella', 'Thermometer', 'Droplet',
      'Droplets', 'Waves', 'Flame', 'Snowflake', 'Rainbow',
      'Leaf', 'TreePine', 'TreeDeciduous', 'Flower', 'Flower2',
      'Mountain', 'MountainSnow', 'Sunrise', 'Sunset', 'Sparkle',
    ],
  },
  {
    category: 'Time',
    icons: [
      'Clock', 'Clock1', 'Clock2', 'Clock3', 'Clock4', 'Clock5', 'Clock6',
      'Clock7', 'Clock8', 'Clock9', 'Clock10', 'Clock11', 'Clock12',
      'AlarmClock', 'Timer', 'TimerOff', 'TimerReset', 'Hourglass',
      'Calendar', 'CalendarDays', 'CalendarCheck', 'CalendarPlus',
      'CalendarMinus', 'CalendarX', 'CalendarRange', 'CalendarClock',
    ],
  },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  onInsert: (iconName: string, size: number, color: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

const SIZES = [16, 24, 32, 48, 64, 96, 128];
const DEFAULT_SIZE = 48;
const DEFAULT_COLOR = '#1e293b';

export function IconPickerPanel({ open, onClose, onInsert }: Props) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('All');
  const [selectedIcon, setSelectedIcon] = useState<string | null>(null);
  const [size, setSize] = useState(DEFAULT_SIZE);
  const [color, setColor] = useState(DEFAULT_COLOR);
  const searchRef = useRef<HTMLInputElement>(null);

  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    window.addEventListener('keydown', handleKey);
    setTimeout(() => searchRef.current?.focus(), 50);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, handleKey]);

  if (!open) return null;

  // Filter icons
  const q = query.toLowerCase().replace(/\s+/g, '');
  const categories = ['All', ...ICON_CATALOG.map(c => c.category)];

  const visibleIcons: { name: string; category: string }[] = [];
  for (const cat of ICON_CATALOG) {
    if (category !== 'All' && cat.category !== category) continue;
    for (const icon of cat.icons) {
      if (!q || icon.toLowerCase().includes(q)) {
        visibleIcons.push({ name: icon, category: cat.category });
      }
    }
  }

  const handleInsert = () => {
    if (!selectedIcon) return;
    onInsert(selectedIcon, size, color);
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 420,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{ position: 'absolute', inset: 0, pointerEvents: 'auto' }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      />
      <div style={{
        position: 'relative',
        marginTop: 48, marginRight: 8,
        background: 'var(--panel)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        boxShadow: '0 24px 64px rgba(0,0,0,0.55)',
        width: 320,
        maxHeight: 'calc(100vh - 64px)',
        display: 'flex', flexDirection: 'column',
        pointerEvents: 'auto',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px 0', flexShrink: 0 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: 'linear-gradient(135deg,#f59e0b,#ef4444)',
            flexShrink: 0,
          }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', flex: 1 }}>
            Icons ({visibleIcons.length})
          </span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'var(--panel-alt)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.background = 'none'; }}
          >
            <X size={13} />
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '10px 14px 0', flexShrink: 0 }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={12} style={{ position: 'absolute', left: 8, color: 'var(--muted)', pointerEvents: 'none' }} />
            <input
              ref={searchRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search icons…"
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'var(--panel-alt)', border: '1px solid var(--border)',
                borderRadius: 7, padding: '5px 8px 5px 26px',
                fontSize: 11, color: 'var(--text)', outline: 'none',
              }}
            />
          </div>
        </div>

        {/* Category filter */}
        <div style={{
          display: 'flex', gap: 4, padding: '8px 14px',
          overflowX: 'auto', flexShrink: 0, scrollbarWidth: 'none',
        }}>
          {categories.map(c => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              style={{
                background: category === c ? 'var(--accent)' : 'var(--panel-alt)',
                color: category === c ? '#fff' : 'var(--muted)',
                border: '1px solid',
                borderColor: category === c ? 'var(--accent)' : 'var(--border)',
                borderRadius: 20, padding: '3px 9px',
                fontSize: 10, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                transition: 'all 0.1s',
              }}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Icon grid */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 14px 8px' }}>
          {visibleIcons.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--muted)', fontSize: 12 }}>
              No icons match "{query}"
            </div>
          ) : (
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 4,
            }}>
              {visibleIcons.map(({ name }) => {
                const IconComp = (LucideIcons as unknown as Record<string, React.ComponentType<{ size?: number; stroke?: string }>>)[name];
                const isSelected = selectedIcon === name;
                if (!IconComp) return null;
                return (
                  <button
                    key={name}
                    title={name}
                    onClick={() => setSelectedIcon(isSelected ? null : name)}
                    onDoubleClick={() => { setSelectedIcon(name); handleInsert(); }}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      gap: 3, padding: '8px 4px 6px', borderRadius: 6, cursor: 'pointer',
                      background: isSelected ? 'var(--accent-dim)' : 'transparent',
                      border: '1.5px solid',
                      borderColor: isSelected ? 'var(--accent)' : 'transparent',
                      transition: 'all 0.1s',
                    }}
                    onMouseEnter={e => { if (!isSelected) { e.currentTarget.style.background = 'var(--panel-alt)'; e.currentTarget.style.borderColor = 'var(--border)'; } }}
                    onMouseLeave={e => { if (!isSelected) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; } }}
                  >
                    <IconComp size={18} stroke={isSelected ? 'var(--accent)' : 'var(--text)'} />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected icon controls */}
        {selectedIcon && (() => {
          const IconComp = (LucideIcons as unknown as Record<string, React.ComponentType<{ size?: number; stroke?: string }>>)[selectedIcon];
          return (
            <div style={{
              borderTop: '1px solid var(--border)',
              padding: '12px 14px',
              flexShrink: 0,
              display: 'flex', flexDirection: 'column', gap: 10,
            }}>
              {/* Preview + name */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 8,
                  background: 'var(--panel-alt)', border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <IconComp size={28} stroke={color} />
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{selectedIcon}</div>
                  <div style={{ fontSize: 10, color: 'var(--muted)' }}>Lucide · {size}×{size}px</div>
                </div>
              </div>

              {/* Size picker */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 10, color: 'var(--muted)', width: 36 }}>Size</span>
                <div style={{ display: 'flex', gap: 3 }}>
                  {SIZES.map(s => (
                    <button
                      key={s}
                      onClick={() => setSize(s)}
                      style={{
                        padding: '2px 6px', borderRadius: 4, border: '1px solid',
                        borderColor: size === s ? 'var(--accent)' : 'var(--border)',
                        background: size === s ? 'var(--accent-dim)' : 'transparent',
                        color: size === s ? 'var(--accent)' : 'var(--muted)',
                        fontSize: 10, cursor: 'pointer', fontWeight: 600,
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color picker */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 10, color: 'var(--muted)', width: 36 }}>Color</span>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {['#1e293b', '#6366f1', '#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#ec4899', '#ffffff', '#000000'].map(c => (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      style={{
                        width: 20, height: 20, borderRadius: '50%', border: '2px solid',
                        borderColor: color === c ? 'var(--accent)' : 'var(--border)',
                        background: c, cursor: 'pointer',
                        boxShadow: c === '#ffffff' ? 'inset 0 0 0 1px rgba(0,0,0,0.1)' : 'none',
                      }}
                    />
                  ))}
                  <input
                    type="color"
                    value={color}
                    onChange={e => setColor(e.target.value)}
                    style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid var(--border)', cursor: 'pointer', padding: 0, background: 'none' }}
                    title="Custom color"
                  />
                </div>
              </div>

              {/* Insert button */}
              <button
                onClick={handleInsert}
                style={{
                  background: 'var(--accent)', color: '#fff',
                  border: 'none', borderRadius: 7, padding: '7px 0',
                  fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  transition: 'opacity 0.1s',
                }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '0.85'; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
              >
                Insert {selectedIcon} ({size}px)
              </button>
            </div>
          );
        })()}

        {/* Footer */}
        {!selectedIcon && (
          <div style={{
            padding: '8px 14px', borderTop: '1px solid var(--border)',
            fontSize: 10, color: 'var(--subtle)', flexShrink: 0,
          }}>
            Double-click to insert · Click to select
          </div>
        )}
      </div>
    </div>
  );
}
