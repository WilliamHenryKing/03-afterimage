import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { compose } from "../game/composition";
import { type PassId, passCovers, recommendPass } from "../game/passes";
import type { DayFilter, VenueFilter } from "../game/schedule";
import { keepOnly, toggleSaved } from "../game/schedule";
import { decodeState, encodeState } from "../game/share";
import { worldReady } from "../loader";
import { createStage, type Stage } from "../scene/stage";
import { Hint } from "./Hint";
import {
  hintSeen,
  markHintSeen,
  useMediaQuery,
  useReducedMotion,
  useViewportHeight,
} from "./hooks";
import { Panel, type Tab } from "./Panel";
import { PuzzleDialog } from "./PuzzleDialog";
import { createPosterCanvas, drawPoster } from "./poster";
import { TicketDialog } from "./TicketDialog";
import { VenueSweep } from "./VenueSweep";

export const PANEL_W = 440;

export function App() {
  const initial = useMemo(() => decodeState(window.location.hash), []);
  const [saved, setSaved] = useState<string[]>(initial.saved);
  const [openEvent, setOpenEvent] = useState<string | null>(initial.event);
  const [day, setDay] = useState<DayFilter>("all");
  const [venue, setVenue] = useState<VenueFilter>("all");
  const [tab, setTab] = useState<Tab>(
    initial.saved.length && !initial.event ? "night" : "programme",
  );
  const [panelOpen, setPanelOpen] = useState(initial.saved.length > 0 || initial.event !== null);
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [pass, setPass] = useState<PassId>(recommendPass(initial.saved));
  const [passChosen, setPassChosen] = useState(false);
  const [ticketOpen, setTicketOpen] = useState(false);
  const [puzzleOpen, setPuzzleOpen] = useState(false);
  const [stamp, setStamp] = useState(false);
  const [firstVisit] = useState(() => !hintSeen());
  const reduced = useReducedMotion();
  const wide = useMediaQuery("(min-width: 900px)");
  const viewportH = useViewportHeight();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const posterRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<Stage | null>(null);
  const composition = useMemo(() => compose(saved, stamp), [saved, stamp]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const poster = createPosterCanvas();
    posterRef.current = poster;
    let stage: Stage;
    try {
      stage = createStage(canvas, poster, {
        onFirstFrame: () => requestAnimationFrame(() => worldReady()),
        onFocusChange: setFocused,
      });
    } catch {
      // No WebGL: the programme, pass and ticket still work without the projection.
      worldReady();
      return;
    }
    stageRef.current = stage;
    return () => {
      stage.dispose();
      stageRef.current = null;
    };
  }, []);

  useEffect(() => {
    const poster = posterRef.current;
    if (!poster) return;
    drawPoster(poster, composition);
    stageRef.current?.posterChanged();
  }, [composition]);

  useEffect(() => stageRef.current?.setSaved(saved), [saved]);
  useEffect(() => stageRef.current?.setVenue(venue), [venue]);
  useEffect(() => stageRef.current?.setReducedMotion(reduced), [reduced]);

  useEffect(() => {
    const bottom = wide ? 0 : Math.round(panelOpen ? viewportH * 0.58 : 124);
    const right = wide && panelOpen ? PANEL_W + 24 : 0;
    stageRef.current?.setInsets(right, bottom);
  }, [wide, panelOpen, viewportH]);

  useEffect(() => {
    if (!focused || revealed) return;
    setRevealed(true);
    markHintSeen();
    setPanelOpen(true);
  }, [focused, revealed]);

  useEffect(() => {
    const hash = encodeState({ saved, event: openEvent });
    window.history.replaceState(null, "", hash || window.location.pathname);
  }, [saved, openEvent]);

  // Follow the night with the best-fitting pass until the visitor picks one; never leave it invalid.
  useEffect(() => {
    setPass((current) =>
      passChosen && passCovers(current, saved) ? current : recommendPass(saved),
    );
  }, [saved, passChosen]);

  const choosePass = useCallback((p: PassId) => {
    setPass(p);
    setPassChosen(true);
  }, []);

  const toggle = useCallback((id: string) => setSaved((s) => toggleSaved(s, id)), []);
  const keep = useCallback((id: string) => setSaved((s) => keepOnly(s, id)), []);

  const replay = () => {
    setTicketOpen(false);
    setSaved([]);
    setOpenEvent(null);
    setDay("all");
    setVenue("all");
    setTab("programme");
    setPanelOpen(false);
    setRevealed(false);
    setPassChosen(false);
    stageRef.current?.resetLens();
  };

  return (
    <>
      <canvas
        ref={canvasRef}
        className="stage"
        tabIndex={0}
        aria-label="Projection lens. Drag, or use the arrow keys, to bring the light into focus. Enter focuses it for you."
      />
      <header className="pointer-events-none fixed top-0 left-0 z-10 p-4 sm:p-6">
        <p className="text-[1.35rem] font-black tracking-[-0.02em] sm:text-3xl">AFTERIMAGE</p>
        <p className="eyebrow mt-1">The Observatory · 16–17 Oct · a fictional festival</p>
      </header>
      <p className="sr-only" aria-live="polite">
        {focused ? "Lens in focus. The festival identity has resolved." : ""}
      </p>
      <VenueSweep venue={venue} reduced={reduced} right={wide && panelOpen ? PANEL_W : 0} />
      <Hint
        focused={focused}
        firstVisit={firstVisit && !revealed}
        wide={wide}
        right={wide && panelOpen ? PANEL_W + 24 : 0}
        bottom={wide ? 0 : panelOpen ? viewportH * 0.58 : 124}
        onFocus={() => stageRef.current?.focusLens()}
        onSkip={() => setPanelOpen(true)}
      />
      <Panel
        wide={wide}
        open={panelOpen}
        onOpenChange={setPanelOpen}
        tab={tab}
        onTab={setTab}
        saved={saved}
        onToggle={toggle}
        onKeep={keep}
        day={day}
        onDay={setDay}
        venue={venue}
        onVenue={setVenue}
        openEvent={openEvent}
        onOpenEvent={setOpenEvent}
        pass={pass}
        onPass={choosePass}
        composition={composition}
        onIssue={() => setTicketOpen(true)}
        onPuzzle={() => setPuzzleOpen(true)}
        stamp={stamp}
      />
      <TicketDialog
        open={ticketOpen}
        onClose={() => setTicketOpen(false)}
        saved={saved}
        pass={pass}
        composition={composition}
        onReplay={replay}
      />
      <PuzzleDialog
        open={puzzleOpen}
        onClose={() => setPuzzleOpen(false)}
        onSolvedAll={() => setStamp(true)}
      />
    </>
  );
}
