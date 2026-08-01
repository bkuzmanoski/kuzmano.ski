import clsx from "clsx";
import { useRef } from "react";

import AppSelectedIcon from "#/assets/images/application-selected.svg?react";
import AppIcon from "#/assets/images/application.svg?react";
import DocumentSelectedIcon from "#/assets/images/document-selected.svg?react";
import DocumentIcon from "#/assets/images/document.svg?react";
import DownloadIcon from "#/assets/images/download.svg?react";
import FolderOpenSelectedIcon from "#/assets/images/folder-open-selected.svg?react";
import FolderOpenIcon from "#/assets/images/folder-open.svg?react";
import FolderSelectedIcon from "#/assets/images/folder-selected.svg?react";
import FolderIcon from "#/assets/images/folder.svg?react";
import type { Icon, IconKind } from "#/lib/icon";
import { playClick } from "#/lib/sound";
import { usePointerDrag } from "#/lib/use-pointer-drag";

import styles from "./desktop-icon.module.css";

import type { ComponentType, KeyboardEvent } from "react";

const DRAG_THRESHOLD = 4;

function glyphFor(kind: IconKind, selected: boolean, open: boolean): ComponentType<{ className?: string }> {
  switch (kind) {
    case "folder":
      if (open) {
        return selected ? FolderOpenSelectedIcon : FolderOpenIcon;
      }

      return selected ? FolderSelectedIcon : FolderIcon;
    case "app":
      return selected ? AppSelectedIcon : AppIcon;
    default:
      return selected ? DocumentSelectedIcon : DocumentIcon;
  }
}

export function DesktopIcon({
  iconDefinition,
  innerRef,
  x,
  y,
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
  innerRef: (element: HTMLDivElement | null) => void;
  x: number;
  y: number;
  tabIndex: number;
  selected: boolean;
  open: boolean;
  onSelect: () => void;
  onOpen: () => void;
  onMoveStart: (x: number, y: number) => void;
  onMoveEnd: () => void;
  onKeyDown: (event: KeyboardEvent) => void;
}) {
  const Glyph = glyphFor(iconDefinition.kind, selected, open);
  const hasMovedRef = useRef(false);
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

  return (
    <div
      ref={innerRef}
      aria-label={iconDefinition.label}
      className={styles.icon}
      data-icon={iconDefinition.id}
      role="button"
      style={{ left: x, top: y }}
      tabIndex={tabIndex}
      onDoubleClick={() => {
        if (!hasMovedRef.current) {
          onOpen();
        }
      }}
      onFocus={onSelect}
      onKeyDown={onKeyDown}
      {...dragHandlers}
    >
      <Glyph className={styles.glyph} />
      <span className={clsx(styles.label, selected && styles.selected)}>
        {iconDefinition.label}
        {iconDefinition.kind === "document" && <DownloadIcon className={styles.downloadIcon} />}
      </span>
    </div>
  );
}
