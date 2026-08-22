import { useRef } from "react";

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
import { DRAG_THRESHOLD, usePointerDrag } from "#/lib/hooks/use-pointer-drag";
import { iconHref } from "#/lib/icons/icon";
import type { Icon, IconKind } from "#/lib/icons/icon";
import { isBrowserHandledClick, isFollowingLink, isRepeatClick } from "#/lib/link";
import { mergeHandlers } from "#/lib/merge-handlers";

import styles from "./desktop-icon.module.css";

import type { ComponentType, KeyboardEvent, MouseEvent, Ref } from "react";

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

export function DesktopIcon({
  iconDefinition,
  ref,
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
  iconDefinition: Icon;
  ref: Ref<HTMLAnchorElement>;
  x: number;
  y: number;
  cellSize: number;
  tabIndex: number;
  selected: boolean;
  open: boolean;
  onSelect: () => void;
  onOpen: () => void;
  onMoveStart: (x: number, y: number) => void;
  onMoveEnd: () => void;
  onKeyDown: (event: KeyboardEvent) => void;
}) {
  const hasMovedRef = useRef(false);
  const pressHandlers = useDoublePress({
    onDoublePress: (event) => {
      if (!hasMovedRef.current && !isBrowserHandledClick(event)) {
        onOpen();
      }
    },
  });
  const dragHandlers = usePointerDrag({
    threshold: DRAG_THRESHOLD,
    canStart: (event) => event.button === 0,
    start: () => {
      playClick();
      onSelect();
      hasMovedRef.current = false;

      return { x, y };
    },
    onStart: (delta, from) => onMoveStart(from.x + delta.dx, from.y + delta.dy),
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
      ref={ref}
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
      onFocus={onSelect}
      onKeyDown={onKeyDown}
      {...mergeHandlers(dragHandlers, pressHandlers)}
    >
      <Glyph kind={iconDefinition.kind} selected={selected} open={open} className={styles.glyph} />
      <span className={cx(styles.label, selected && styles.selected)}>
        {iconDefinition.label}
        {iconDefinition.kind === "download" && <DownloadIcon className={styles.downloadIcon} />}
      </span>
    </a>
  );
}
