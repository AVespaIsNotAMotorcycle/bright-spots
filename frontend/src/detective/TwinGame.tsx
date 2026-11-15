// Student Home game: "Guess the twin". Which park changes most like today's park?
// The answer comes from the same trend fingerprints the researcher tools use.
import { useMemo, useState } from "react";
import { findTwins, fingerprints, similarity } from "../research/insights";
import type { Atlas } from "./model";
import { PERIOD_LABEL } from "./model";
import { parkName } from "./games";
import { PhotoCredit, photoOf } from "./photos";
import { play } from "./sound";
import { E, Leaves, RIDGE, WIDGET_CSS } from "./StudentWidgets";

function dayIndex(now = new Date()) {
  return Math.floor(new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 86400000);
}

/** Small seeded shuffle, so everyone sees the same order on the same day. */
function seeded<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = seed % 2147483647 || 1;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 16807) % 2147483647;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export interface TwinRound {
  park: string;
  answer: string;
  options: string[];
  score: number;
  shared: { variable: string; period: string }[];
}

/** Today's round: a park with a clear twin (score ≥ 0.7) and two decoys that change very differently (score < 0.2). */
export function twinRound(atlas: Atlas, day = dayIndex()): TwinRound | null {
  const { parks } = fingerprints(atlas);
  const ids = [...parks.keys()].sort();
  const candidates = ids
    .map((id) => ({ id, t: findTwins(atlas, id, 1).twins[0] }))
    .filter((x) => x.t && x.t.score >= 0.7);
  if (!candidates.length) return null;
  const pick = candidates[((day % candidates.length) + candidates.length) % candidates.length];
  const me = parks.get(pick.id)!;
  const decoys = seeded(
    ids.filter((id) => id !== pick.id && id !== pick.t.park && (similarity(me, parks.get(id)!) ?? 1) < 0.2),
    day + 7,
  ).slice(0, 2);
  if (decoys.length < 2) return null;
  return {
    park: pick.id,
    answer: pick.t.park,
    options: seeded([pick.t.park, ...decoys], day),
    score: pick.t.score,
    shared: pick.t.shared,
  };
}

export function GuessTheTwin({ atlas, onExplore }: { atlas: Atlas; onExplore: (parkId: string) => void }) {
  const round = useMemo(() => twinRound(atlas), [atlas]);
  const [guess, setGuess] = useState<string | null>(null);
  if (!round) return null;
  const name = parkName(round.park);
  const twin = parkName(round.answer);
  const photo = photoOf(round.park);
  const right = guess === round.answer;
  const pickOne = (id: string) => {
    setGuess(id);
    play(id === round.answer ? "right" : "wrong");
  };
  const things = round.shared.map((f) => {
    const what = (atlas.variables[f.variable]?.label ?? f.variable).toLowerCase();
    return `${what} (${(PERIOD_LABEL[f.period] ?? f.period).toLowerCase()})`;
  });
  const pct = Math.round(((round.score + 1) / 2) * 100);

  return (
    <section style={{ borderRadius: "var(--radius)", overflow: "hidden", border: "1px solid var(--stone)", background: "var(--paper)",
      position: "relative", height: "100%", display: "flex", flexDirection: "column" }}>
      <style>{WIDGET_CSS}</style>
      <div style={{
        background: photo
          ? `linear-gradient(180deg, rgba(31,42,36,.15) 0%, rgba(31,42,36,.72) 100%), url("${photo.file}") center / cover no-repeat`
          : `${RIDGE} bottom / 100% 60px no-repeat, linear-gradient(180deg, #cfdcb4 0%, #9db07a 55%, #6b7f3a 100%)`,
        padding: "20px 22px 16px", minHeight: 170, display: "flex", flexDirection: "column", justifyContent: "flex-end", position: "relative" }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".14em", textTransform: "uppercase", color: photo ? E.cream : E.bark }}>
          Guess the twin
        </div>
        <h3 style={{ margin: "4px 0 0", fontFamily: "var(--font-display)", fontWeight: 400, fontSize: 26, lineHeight: 1.15, color: photo ? "#fff" : E.bark,
          textShadow: photo ? "0 2px 8px rgba(0,0,0,.55)" : undefined }}>
          Whose climate moves like {name}?
        </h3>
        {photo && <PhotoCredit photo={photo} style={{ position: "absolute", right: 12, top: 10, color: "rgba(255,255,255,.85)", textShadow: "0 1px 3px rgba(0,0,0,.7)" }} />}
      </div>

      {!guess ? (
        <div style={{ padding: "18px 22px 20px", display: "flex", flexDirection: "column", gap: 14, flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 16, color: E.bark }}>
            Pick the park whose weather has changed the same way.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {round.options.map((id) => {
              const ph = photoOf(id);
              return (
                <button key={id} className="sw-pick" onClick={() => pickOne(id)}
                  title={ph ? `Photo: ${ph.credit} (${ph.license}), Wikimedia Commons` : undefined}
                  style={{ background: "var(--sand)", border: "1px solid var(--stone)", borderRadius: 12, font: "inherit",
                    padding: ph ? "0 0 12px" : "16px 10px", overflow: "hidden", cursor: "pointer", color: E.bark, fontWeight: 600, fontSize: 13.5, lineHeight: 1.25 }}>
                  {ph
                    ? <div aria-hidden style={{ height: 64, marginBottom: 10, background: `url("${ph.file}") center / cover no-repeat` }} />
                    : <div style={{ fontSize: 30 }}>🏞️</div>}
                  {parkName(id)}
                </button>
              );
            })}
          </div>
          <div style={{ fontSize: 13, color: "var(--bark-2)", marginTop: "auto" }}>New park every day. Answers come from NASA data since 1981.</div>
        </div>
      ) : (
        <div className="sw-reveal" style={{ padding: "18px 24px 22px", display: "flex", flexDirection: "column", gap: 12, position: "relative" }}>
          {right && <Leaves />}
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <div style={{ fontSize: 44 }}>{right ? "🦌" : "🦉"}</div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 400, fontSize: 22, color: right ? E.pine : E.rust }}>
                {right ? "You found the twin!" : "Whoo-ops, not that one!"}
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.5, color: E.bark }}>
                {name}'s twin is <b>{twin}</b>.
                {things.length > 0 && <> Both stand out for {things.join(", ")}.</>}
              </div>
            </div>
            <div style={{ textAlign: "center", minWidth: 110 }}>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 400, fontSize: 34, color: E.pine, lineHeight: 1 }}>{pct}%</div>
              <div style={{ fontSize: 11, color: E.moss, fontWeight: 700 }}>match score</div>
            </div>
          </div>
          <div style={{ height: 10, borderRadius: 5, background: E.sand, overflow: "hidden" }}>
            <div style={{ width: `${pct}%`, height: "100%", background: E.moss }} />
          </div>
          <div style={{ fontSize: 12.5, color: E.moss }}>
            Twins change alike. They can still look very different: a desert and a forest can be twins.
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn" onClick={() => onExplore(round.park)}>Explore {name}</button>
            <button className="btn-ghost" onClick={() => onExplore(round.answer)}>Explore {twin}</button>
          </div>
        </div>
      )}
    </section>
  );
}
