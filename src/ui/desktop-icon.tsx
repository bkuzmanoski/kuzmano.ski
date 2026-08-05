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
import { playClick } from "#/lib/audio/ui";
import { usePointerDrag } from "#/lib/hooks/use-pointer-drag";
import type { Icon, IconKind } from "#/lib/icon";

import styles from "./desktop-icon.module.css";

import type { KeyboardEvent, Ref } from "react";

const DRAG_THRESHOLD = 4;

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
  switch (kind) {
    case "page":
      return selected ? <AppSelectedIcon className={className} /> : <AppIcon className={className} />;
    case "collection":
      if (open) {
        return selected ? <FolderOpenSelectedIcon className={className} /> : <FolderOpenIcon className={className} />;
      }

      return selected ? <FolderSelectedIcon className={className} /> : <FolderIcon className={className} />;
    default:
      return selected ? <DocumentSelectedIcon className={className} /> : <DocumentIcon className={className} />;
  }
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
  ref: Ref<HTMLDivElement>;
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
  const hasMovedRef = useRef(false);

  return (
    <div
      ref={ref}
      aria-label={iconDefinition.label}
      className={styles.icon}
      data-icon={iconDefinition.id}
      role="button"
      style={{ left: x, top: y, width: cellSize }}
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
      <Glyph kind={iconDefinition.kind} selected={selected} open={open} className={styles.glyph} />
      <span className={clsx(styles.label, selected && styles.selected)}>
        {iconDefinition.label}
        {iconDefinition.kind === "download" && <DownloadIcon className={styles.downloadIcon} />}
      </span>
    </div>
  );
}
