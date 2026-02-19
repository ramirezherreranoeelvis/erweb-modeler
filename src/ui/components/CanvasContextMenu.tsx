import React, { useRef, useEffect } from 'react';
import {
  Check,
  ChevronRight,
  Grid,
  GitMerge,
  MousePointer2,
  Hand,
  BoxSelect,
  MoreHorizontal,
  Database,
  Eye,
} from 'lucide-react';
import type { ViewOptions } from '../types';
import type { DbEngine } from '../../utils/dbDataTypes';
import { DB_ENGINES } from '../../utils/dbDataTypes';

// --- Sub Components ---

const MenuItem = ({
  label,
  icon,
  checked,
  onClick,
}: {
  label: string;
  icon?: React.ReactNode;
  checked?: boolean;
  onClick: () => void;
}) => {
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 px-3 py-2 mx-1 text-xs text-slate-700 dark:text-slate-200 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/30 cursor-pointer transition-colors"
    >
      <div className="w-4 flex items-center justify-center text-blue-600 dark:text-blue-400">
        {checked && <Check size={14} />}
      </div>
      <div className="flex items-center gap-2 flex-1">
        {icon && <span className="text-slate-400 dark:text-slate-500">{icon}</span>}
        <span>{label}</span>
      </div>
    </div>
  );
};

const SubMenu = ({
  label,
  icon,
  children,
  invertX,
  invertY,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  invertX?: boolean;
  invertY?: boolean;
}) => {
  return (
    <div className="group relative px-1">
      <div className="flex items-center gap-3 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/30 cursor-pointer transition-colors">
        <span className="text-slate-400 dark:text-slate-500">{icon}</span>
        <span className="flex-1 font-medium">{label}</span>
        <ChevronRight size={14} className="text-slate-400" />
      </div>

      {/* Nested Menu */}
      <div
        className={`hidden group-hover:block absolute ${invertX ? 'right-full mr-1' : 'left-full ml-1'} ${invertY ? 'bottom-0' : 'top-0'} w-48 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl py-1.5 animate-in fade-in ${invertX ? 'slide-in-from-right-2' : 'slide-in-from-left-2'} duration-100 z-50`}
      >
        {/* Invisible Bridge */}
        <div
          className={`absolute ${invertX ? '-right-3' : '-left-3'} top-0 bottom-0 w-4 bg-transparent`}
        />
        {children}
      </div>
    </div>
  );
};

interface CanvasContextMenuProps {
  x: number;
  y: number;
  viewOptions: ViewOptions;
  setViewOptions: React.Dispatch<React.SetStateAction<ViewOptions>>;
  viewMode: string;
  setViewMode?: (mode: string) => void;
  dbEngine: DbEngine;
  setDbEngine?: (engine: DbEngine) => void;
  onClose: () => void;
}

const CanvasContextMenu: React.FC<CanvasContextMenuProps> = ({
  x,
  y,
  viewOptions,
  setViewOptions,
  viewMode,
  setViewMode,
  dbEngine,
  setDbEngine,
  onClose,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  const screenW = window.innerWidth;
  const screenH = window.innerHeight;
  // Estimated dimensions for decision making
  const menuEstimatedW = 224; // w-56
  const menuEstimatedH = 380;

  // Determine directions based on available space
  const invertX = x + menuEstimatedW > screenW;
  const invertY = y + menuEstimatedH > screenH;

  const positionStyle: React.CSSProperties = {};

  if (invertX) {
    positionStyle.right = screenW - x;
  } else {
    positionStyle.left = x;
  }

  if (invertY) {
    positionStyle.bottom = screenH - y;
  } else {
    positionStyle.top = y;
  }

  // Origin for animation
  const transformOrigin = `${invertY ? 'bottom' : 'top'} ${invertX ? 'right' : 'left'}`;

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: PointerEvent) => {
      // Check if click is outside the menu ref
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('pointerdown', handleClickOutside);
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside);
    };
  }, [onClose]);

  const updateOption = (key: keyof ViewOptions, value: any) => {
    setViewOptions((prev) => ({ ...prev, [key]: value }));
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl py-1.5 w-56 animate-in fade-in zoom-in-95 duration-100 select-none"
      style={{
        ...positionStyle,
        transformOrigin,
      }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* VIEW MODE (Logical/Physical) */}
      {setViewMode && (
        <>
          <SubMenu label="View Mode" icon={<Eye size={16} />} invertX={invertX} invertY={invertY}>
            <MenuItem
              label="Physical"
              checked={viewMode === 'physical'}
              onClick={() => {
                setViewMode('physical');
                onClose();
              }}
            />
            <MenuItem
              label="Logical"
              checked={viewMode === 'logical'}
              onClick={() => {
                setViewMode('logical');
                onClose();
              }}
            />
          </SubMenu>
          <div className="h-px bg-slate-200 dark:bg-slate-700 my-1 mx-2" />
        </>
      )}

      {/* DB ENGINE */}
      {setDbEngine && (
        <>
          <SubMenu
            label="DB Engine"
            icon={<Database size={16} />}
            invertX={invertX}
            invertY={invertY}
          >
            {DB_ENGINES.map((engine) => (
              <MenuItem
                key={engine.value}
                label={engine.label}
                checked={dbEngine === engine.value}
                onClick={() => {
                  setDbEngine(engine.value);
                  onClose();
                }}
              />
            ))}
          </SubMenu>
          <div className="h-px bg-slate-200 dark:bg-slate-700 my-1 mx-2" />
        </>
      )}

      {/* CURSOR MODE */}
      <SubMenu
        label="Cursor Mode"
        icon={<MousePointer2 size={16} />}
        invertX={invertX}
        invertY={invertY}
      >
        <MenuItem
          label="Move (Pan)"
          icon={<Hand size={14} />}
          checked={viewOptions.interactionMode === 'pan'}
          onClick={() => updateOption('interactionMode', 'pan')}
        />
        <MenuItem
          label="Select Box"
          icon={<BoxSelect size={14} />}
          checked={viewOptions.interactionMode === 'select'}
          onClick={() => updateOption('interactionMode', 'select')}
        />
      </SubMenu>

      <div className="h-px bg-slate-200 dark:bg-slate-700 my-1 mx-2" />

      {/* LINE STYLE */}
      <SubMenu label="Line Style" icon={<GitMerge size={16} />} invertX={invertX} invertY={invertY}>
        <MenuItem
          label="Curved"
          checked={viewOptions.lineStyle === 'curved'}
          onClick={() => updateOption('lineStyle', 'curved')}
        />
        <MenuItem
          label="Orthogonal"
          checked={viewOptions.lineStyle === 'orthogonal'}
          onClick={() => updateOption('lineStyle', 'orthogonal')}
        />
      </SubMenu>

      {/* GRID STYLE */}
      <SubMenu label="Grid Style" icon={<Grid size={16} />} invertX={invertX} invertY={invertY}>
        <MenuItem
          label="None"
          checked={viewOptions.gridStyle === 'none'}
          onClick={() => updateOption('gridStyle', 'none')}
        />
        <MenuItem
          label="Dots"
          checked={viewOptions.gridStyle === 'dots'}
          onClick={() => updateOption('gridStyle', 'dots')}
        />
        <MenuItem
          label="Squares"
          checked={viewOptions.gridStyle === 'squares'}
          onClick={() => updateOption('gridStyle', 'squares')}
        />
      </SubMenu>

      <div className="h-px bg-slate-200 dark:bg-slate-700 my-1 mx-2" />

      {/* CONNECTION MODE */}
      <SubMenu
        label="Connect Mode"
        icon={<MoreHorizontal size={16} />}
        invertX={invertX}
        invertY={invertY}
      >
        <MenuItem
          label="Column to Column"
          checked={viewOptions.connectionMode === 'column'}
          onClick={() => updateOption('connectionMode', 'column')}
        />
        <MenuItem
          label="Table to Table"
          checked={viewOptions.connectionMode === 'table'}
          onClick={() => updateOption('connectionMode', 'table')}
        />
      </SubMenu>
    </div>
  );
};

export default CanvasContextMenu;
