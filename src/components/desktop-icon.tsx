import { memo, useRef } from "react";

import ApplicationSelectedIcon from "#/assets/images/application-selected.svg?react";
import ApplicationIcon from "#/assets/images/application.svg?react";
import DocumentSelectedIcon from "#/assets/images/document-selected.svg?react";
import DocumentIcon from "#/assets/images/document.svg?react";
import DownloadIcon from "#/assets/images/download.svg?react";
import FolderOpenSelectedIcon from "#/assets/images/folder-open-selected.svg?react";
import FolderOpenIcon from "#/assets/images/folder-open.svg?react";
import FolderSelectedIcon from "#/assets/images/folder-selected.svg?react";
import FolderIcon from "#/assets/images/folder.svg?react";
import { playClick } from "#/lib/audio/sounds";
import { cx } from "#/lib/class-names";
import { useDoublePress } from "#/lib/hooks/use-double-press";
import { DRAG_THRESHOLD_PX, usePointerDrag } from "#/lib/hooks/use-pointer-drag";
import { iconHref } from "#/lib/icons/icon";
import type { Icon as IconDefinition, IconKind } from "#/lib/icons/icon";
import { isBrowserHandledClick, isFollowingLink, isRepeatClick } from "#/lib/link";
import { mergeHandlers } from "#/lib/merge-handlers";
import { isPrimaryPress } from "#/lib/press";

import styles from "./desktop-icon.module.css";

import type { ComponentType, KeyboardEvent, MouseEvent } from "react";

type GlyphIcon = ComponentType<{ className?: string }>;

const GLYPHS: Record<IconKind, { closed: [GlyphIcon, GlyphIcon]; open?: [GlyphIcon, GlyphIcon] }> = {
  entry: { closed: [DocumentIcon, DocumentSelectedIcon] },
  collection: { closed: [FolderIcon, FolderSelectedIcon], open: [FolderOpenIcon, FolderOpenSelectedIcon] },
  contact: { closed: [ApplicationIcon, ApplicationSelectedIcon] },
  download: { closed: [DocumentIcon, DocumentSelectedIcon] },
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
  const variants = GLYPHS[kind];
  const [idle, active] = (open && variants.open) || variants.closed;
  const GlyphComponent = selected ? active : idle;

  return <GlyphComponent className={className} />;
}

/**
 * Memoized because the desktop rebuilds every icon on every frame of a drag: the icon
 * elements are built inside a `map`, which the React Compiler caches as one array rather
 * than per item. Every handler takes the icon it belongs to rather than closing over it,
 * so the desktop can hold one copy of each and only the icon being dragged re-renders.
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
  const pressHandlers = useDoublePress({
    onDoublePress: (event) => {
      if (!hasMovedRef.current && !isBrowserHandledClick(event)) {
        onOpen(iconDefinition);
      }
    },
  });
  const dragHandlers = usePointerDrag({
    threshold: DRAG_THRESHOLD_PX,
    start: () => {
      playClick();
      onSelect(iconDefinition);
      hasMovedRef.current = false;

      return { x, y };
    },
    onDragMove: (delta, from) => onMoveStart(iconDefinition, from.x + delta.dx, from.y + delta.dy),
    onEnd: (moved) => {
      hasMovedRef.current = moved;

      if (moved) {
        playClick();
        onMoveEnd();
      }
    },
  });

  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    if (isFollowingLink(event.currentTarget)) {
      return;
    }

    if (hasMovedRef.current || isRepeatClick(event) || !isBrowserHandledClick(event)) {
      event.preventDefault();
    }
  }

  return (
    <a
      aria-label={iconDefinition.label}
      className={styles.icon}
      data-icon={iconDefinition.id}
      download={iconDefinition.kind === "download" || undefined}
      draggable={false}
      href={iconHref(iconDefinition)}
      style={{ left: x, top: y, width: cellSize }}
      tabIndex={tabIndex}
      onClick={onClick}
      onDragStart={(event) => event.preventDefault()}
      onMouseDown={(event) => {
        if (!isPrimaryPress(event)) {
          event.preventDefault();
        }
      }}
      {...mergeHandlers(dragHandlers, pressHandlers)}
      onFocus={() => onSelect(iconDefinition)}
      onKeyDown={(event) => onKeyDown(event, iconDefinition)}
    >
      <Glyph kind={iconDefinition.kind} selected={selected} open={open} className={styles.glyph} />
      <span className={cx(styles.label, selected && styles.selected)}>
        {iconDefinition.label}
        {iconDefinition.kind === "download" && <DownloadIcon className={styles.downloadIcon} />}
      </span>
    </a>
  );
});
