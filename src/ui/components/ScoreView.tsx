import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from 'react';
import { clickAt, updateComposer, updateTitle } from '../../editor/commands';
import { setStatus, useEditor } from '../../editor/store';
import { hitTest, locate, type Hit } from '../../render/hitTest';
import { LINE_SPACING, renderScore, type RenderResult } from '../../render/renderer';

/** Notation is drawn smaller on narrow screens so more measures fit per line. */
function displayScale(width: number): number {
  if (width < 420) return 0.66;
  if (width < 640) return 0.78;
  return 1;
}

export function ScoreView() {
  const score = useEditor((s) => s.score);
  const selection = useEditor((s) => s.selection);
  const inputMode = useEditor((s) => s.inputMode);
  const playingIds = useEditor((s) => s.playingIds);
  const duration = useEditor((s) => s.duration);

  const wrapRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const marked = useRef<Element[]>([]);
  const [width, setWidth] = useState(0);
  const [layout, setLayout] = useState<RenderResult | null>(null);
  const [hover, setHover] = useState<Hit | null>(null);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    if (!hostRef.current || width === 0) return;
    try {
      setLayout(renderScore(hostRef.current, score, { width, scale: displayScale(width) }));
    } catch (err) {
      console.error(err);
      setStatus(`Rendering failed: ${(err as Error).message}`, 'error');
    }
  }, [score, width]);

  // Selection and playback highlighting by toggling classes on the drawn notes.
  useEffect(() => {
    if (!layout) return;
    for (const el of marked.current) el.classList.remove('is-selected', 'is-cursor', 'is-playing');
    const next: Element[] = [];
    const sel = selection && score.parts[selection.part]?.staves[selection.staff]?.measures[selection.measure]?.events[selection.event];
    const selEl = sel ? layout.elements.get(sel.id) : undefined;
    if (selEl && playingIds.length === 0) {
      selEl.classList.add(inputMode ? 'is-cursor' : 'is-selected');
      next.push(selEl);
    }
    for (const id of playingIds) {
      const el = layout.elements.get(id);
      if (el) {
        el.classList.add('is-playing');
        next.push(el);
      }
    }
    marked.current = next;
  }, [layout, selection, playingIds, inputMode, score]);

  // Keep the cursor (or the playing notes) on screen.
  const focusId =
    playingIds[0] ??
    (selection ? score.parts[selection.part]?.staves[selection.staff]?.measures[selection.measure]?.events[selection.event]?.id : undefined);
  useEffect(() => {
    const el = focusId ? layout?.elements.get(focusId) : undefined;
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: playingIds.length ? 'smooth' : 'auto' });
  }, [focusId, layout, playingIds.length]);

  const toLogical = (e: MouseEvent) => {
    const rect = hostRef.current!.getBoundingClientRect();
    const scale = layout?.scale ?? 1;
    return { x: (e.clientX - rect.left) / scale, y: (e.clientY - rect.top) / scale };
  };

  const onClick = (e: MouseEvent) => {
    if (!layout) return;
    const { x, y } = toLogical(e);
    const hit = hitTest(layout, x, y, score.keySignature.fifths);
    if (hit) clickAt(hit.loc, hit.pitch, e.shiftKey);
  };

  const onMove = (e: MouseEvent) => {
    if (!layout || !inputMode) return;
    const { x, y } = toLogical(e);
    setHover(hitTest(layout, x, y, score.keySignature.fifths));
  };

  const cursor = layout && selection && inputMode && playingIds.length === 0 ? locate(layout, selection) : null;

  return (
    <div className="paper">
      <header className="paper-header">
        <input
          className="score-title"
          value={score.title}
          onChange={(e) => updateTitle(e.target.value)}
          placeholder="Title"
          aria-label="Score title"
          spellCheck={false}
        />
        <input
          className="score-composer"
          value={score.composer}
          onChange={(e) => updateComposer(e.target.value)}
          placeholder="Composer"
          aria-label="Composer"
          spellCheck={false}
        />
      </header>
      <div
        ref={wrapRef}
        className={`score-canvas${inputMode ? ' is-input' : ''}`}
        onClick={onClick}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        role="application"
        aria-label="Score. Click a staff to place notes, or use the keyboard shortcuts."
      >
        <div ref={hostRef} className="score-svg" />
        {layout && (
          <svg
            className="score-overlay"
            viewBox={`0 0 ${layout.width} ${layout.height}`}
            width={layout.width * layout.scale}
            height={layout.height * layout.scale}
            aria-hidden="true"
          >
            {cursor && (
              <rect
                className="input-caret"
                x={cursor.x - 9}
                y={cursor.staff.topLineY - 16}
                width={18}
                height={LINE_SPACING * 4 + 32}
                rx={4}
              />
            )}
            {hover && <GhostNote hit={hover} duration={duration} />}
          </svg>
        )}
      </div>
    </div>
  );
}

function GhostNote({ hit, duration }: { hit: Hit; duration: string }) {
  const half = LINE_SPACING / 2;
  const y = hit.staff.topLineY + hit.position * half;
  const ledgers: number[] = [];
  for (let p = -2; p >= hit.position; p -= 2) ledgers.push(p);
  for (let p = 10; p <= hit.position; p += 2) ledgers.push(p);
  const hollow = duration === 'w' || duration === 'h';
  return (
    <g className="ghost-note">
      {ledgers.map((p) => (
        <line key={p} x1={hit.x - 10} x2={hit.x + 10} y1={hit.staff.topLineY + p * half} y2={hit.staff.topLineY + p * half} />
      ))}
      <ellipse
        cx={hit.x}
        cy={y}
        rx={6.2}
        ry={4.4}
        transform={`rotate(-20 ${hit.x} ${y})`}
        className={hollow ? 'hollow' : undefined}
      />
    </g>
  );
}
