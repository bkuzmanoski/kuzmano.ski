import { memo, useRef } from "react";

import ApplicationSelectedDesktopIcon from "#/assets/images/desktop-icon-application-selected.svg?react";
import ApplicationDesktopIcon from "#/assets/images/desktop-icon-application.svg?react";
import DocumentSelectedDesktopIcon from "#/assets/images/desktop-icon-document-selected.svg?react";
import DocumentDesktopIcon from "#/assets/images/desktop-icon-document.svg?react";
import FolderOpenSelectedDesktopIcon from "#/assets/images/desktop-icon-folder-open-selected.svg?react";
import FolderOpenDesktopIcon from "#/assets/images/desktop-icon-folder-open.svg?react";
import FolderSelectedDesktopIcon from "#/assets/images/desktop-icon-folder-selected.svg?react";
import FolderDesktopIcon from "#/assets/images/desktop-icon-folder.svg?react";
import DownloadDesktopIconIndicator from "#/assets/images/desktop-icon-indicator-download.svg?react";
import { playClickSound } from "#/lib/audio/sounds.ts";
import { cx } from "#/lib/class-names.ts";
import { iconHref } from "#/lib/desktop-icons/icon.ts";
import type { Icon as IconDefinition, IconKind } from "#/lib/desktop-icons/icon.ts";
import { isBrowserHandledClick } from "#/lib/link.ts";
import { mergeHandlers } from "#/lib/merge-handlers.ts";
import { isPrimaryPress } from "#/lib/press/press.ts";
import { useDoublePressLink } from "#/lib/press/use-double-press-link.ts";
import { DRAG_THRESHOLD_PX, usePointerDrag } from "#/lib/press/use-pointer-drag.ts";
import { usePressSound } from "#/lib/press/use-press-sound.ts";

import styles from "./desktop-icon.module.css";

import type { ComponentType, KeyboardEvent } from "react";

type GlyphIcon = ComponentType<{ className?: string }>;

const GLYPHS: Record<IconKind, { closed: [GlyphIcon, GlyphIcon]; open?: [GlyphIcon, GlyphIcon] }> = {
  entry: { closed: [DocumentDesktopIcon, DocumentSelectedDesktopIcon] },
  collection: {
    closed: [FolderDesktopIcon, FolderSelectedDesktopIcon],
    open: [FolderOpenDesktopIcon, FolderOpenSelectedDesktopIcon],
  },
  contact: { closed: [ApplicationDesktopIcon, ApplicationSelectedDesktopIcon] },
  controlPanel: { closed: [ApplicationDesktopIcon, ApplicationSelectedDesktopIcon] },
  download: { closed: [DocumentDesktopIcon, DocumentSelectedDesktopIcon] },
};

function Glyph({
  kind,
  selected,
  open,
  className,
}: {
  kind: IconKind;
  selected: boolean;
  open: boolean;
  className?: string;
}) {
  const glyphVariants = GLYPHS[kind];
  const [idle, active] = (open && glyphVariants.open) || glyphVariants.closed;
  const GlyphComponent = selected ? active : idle;

  return <GlyphComponent className={className} />;
}

/**
 * Memoized because the desktop rebuilds every icon on every frame of a drag (the icon elements are built inside a
 * `map`, which the React Compiler caches as one array rather than per item). Handlers take the icon they belong to as
 * an argument rather than closing over it, so the desktop holds one copy of each and only the icon being dragged
 * re-renders.
 */
export const DesktopIcon = memo(function Icon({
  iconDefinition,
  x,
  y,
  cellSize,
  tabIndex,
  selected,
  open,
  onSelect,
  onOpen,
  onMoveStart,
  onMoveEnd,
  onKeyDown,
}: {
  iconDefinition: IconDefinition;
  x: number;
  y: number;
  cellSize: number;
  tabIndex: number;
  selected: boolean;
  open: boolean;
  onSelect: (iconDefinition: IconDefinition) => void;
  onOpen: (iconDefinition: IconDefinition) => void;
  onMoveStart: (iconDefinition: IconDefinition, x: number, y: number) => void;
  onMoveEnd: () => void;
  onKeyDown: (event: KeyboardEvent, iconDefinition: IconDefinition) => void;
}) {
  const hasMovedRef = useRef(false);

  const pressSoundHandlers = usePressSound();
  const doublePressLinkHandlers = useDoublePressLink({
    isPressOpenable: () => !hasMovedRef.current,
    onOpen: () => onOpen(iconDefinition),
  });
  const dragHandlers = usePointerDrag({
    threshold: DRAG_THRESHOLD_PX,
    canStart: (event) => !isBrowserHandledClick(event), // A modified press follows the link without selecting or moving the icon.
    start: () => {
      onSelect(iconDefinition);
      return { x, y };
    },
    onDragMove: (delta, from) => onMoveStart(iconDefinition, from.x + delta.dx, from.y + delta.dy),
    onEnd: (moved) => {
      hasMovedRef.current = moved;

      if (moved) {
        playClickSound();
        onMoveEnd();
      }
    },
  });

  return (
    <a
      href={iconHref(iconDefinition)}
      download={iconDefinition.kind === "download" || undefined}
      draggable={false}
      tabIndex={tabIndex}
      style={{ left: x, top: y, width: cellSize }}
      className={styles.icon}
      aria-label={iconDefinition.label}
      aria-keyshortcuts="Alt+O"
      data-icon={iconDefinition.id}
      onDragStart={(event) => event.preventDefault()}
      // Runs ahead of the drag and double-press handlers, so every primary press starts out unmoved.
      onPointerDownCapture={(event) => {
        if (isPrimaryPress(event)) {
          hasMovedRef.current = false;
        }
      }}
      {...mergeHandlers(pressSoundHandlers, dragHandlers, doublePressLinkHandlers)}
      onFocus={() => onSelect(iconDefinition)}
      onKeyDown={(event) => onKeyDown(event, iconDefinition)}
    >
      <Glyph kind={iconDefinition.kind} selected={selected} open={open} className={styles.glyph} />
      <span
        className={cx(styles.label, selected && styles.selected)}
        aria-hidden="true" // The `aria-label` provides the label to a screen reader.
      >
        <span className={styles.labelText}>{iconDefinition.label}</span>
        {iconDefinition.kind === "download" && <DownloadDesktopIconIndicator className={styles.downloadIndicator} />}
      </span>
    </a>
  );
});
