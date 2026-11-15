// Student detective mode: guided cases with predict → examine → analyze → interpret flow.
import { useEffect, useState } from "react";
import type { Atlas, ParkTrends, TrendRow } from "./model";
import { PERIOD_LABEL } from "./model";
import TrendChart from "./TrendChart";
import ExplainerCard from "./ExplainerCard";
import type { Case, Step } from "./cases";
import { CASES } from "./cases";
import { GameStep, GAME_KINDS, loadProgress, saveResult, rankTitle } from "./games";
import type { CaseResult } from "./games";

// ── Case list ──────────────────────────────────────────────────────────────

function DifficultyBadge({ d }: { d: Case["difficulty"] }) {
  const map = {
    easy: { label: "Easy", bg: "#d4edda", color: "#155724" },
    medium: { label: "Medium", bg: "#fff3cd", color: "#856404" },
    hard: { label: "Hard", bg: "#f8d7da", color: "#721c24" },
  };
  const s = map[d];
  return (
    <span style={{ fontSize: 11, fontWeight: 600, background: s.bg, color: s.color, borderRadius: 20, padding: "2px 10px" }}>
      {s.label}
    </span>
  );
}

export function CaseList({ onSelect }: { onSelect: (c: Case) => void }) {
  const progress = loadProgress();
  const totalStars = CASES.reduce((n, c) => n + (progress[c.id]?.stars ?? 0), 0);
  const solved = CASES.filter((c) => progress[c.id]).length;
  const rank = rankTitle(totalStars);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 700, fontFamily: "var(--font-display, 'Playfair Display', Georgia, serif)", color: "var(--pine)" }}>Detective Cases</h2>
        <p style={{ margin: 0, fontSize: 14, color: "var(--text-muted)" }}>
          Each case walks you through real NASA data: predict first, then see what the numbers say.
        </p>
      </div>
      <div
        style={{
          display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
          background: "var(--accent-tint)", border: "1px solid var(--border)", borderRadius: 14, padding: "12px 16px",
        }}
      >
        <div style={{ fontSize: 34 }}>{rank.emoji}</div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>{rank.title}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {solved} of {CASES.length} cases solved
            {rank.next != null && ` · ${rank.next - totalStars} more ⭐ to level up`}
          </div>
        </div>
        <div style={{ fontWeight: 800, fontSize: 18 }}>⭐ {totalStars}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
        {CASES.map((c) => (
          <button
            key={c.id}
            onClick={() => onSelect(c)}
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 14,
              padding: "20px 18px",
              cursor: "pointer",
              textAlign: "left",
              display: "flex",
              flexDirection: "column",
              gap: 12,
              transition: "border-color 0.15s, box-shadow 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--accent)";
              e.currentTarget.style.boxShadow = "0 0 0 3px var(--accent-tint)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--border)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <div style={{ fontSize: 32 }}>{c.emoji}</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{c.title}</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>{c.subtitle}</div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <DifficultyBadge d={c.difficulty} />
              {progress[c.id] && (
                <span title="Best result" style={{ fontSize: 13 }}>
                  {"⭐".repeat(progress[c.id].stars)}
                </span>
              )}
              <span style={{ fontSize: 13, color: "var(--accent)", fontWeight: 600 }}>
                Play →
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Live data fetch for examine/analyze steps ──────────────────────────────

function useParkTrends(parkId: string | undefined): ParkTrends | null {
  const [cache, setCache] = useState<Record<string, ParkTrends>>({});
  const [loading, setLoading] = useState(false);

  if (!parkId) return null;
  if (cache[parkId]) return cache[parkId];
  if (!loading) {
    setLoading(true);
    fetch(`/api/trends/parks/${parkId}`)
      .then((r) => r.json() as Promise<ParkTrends>)
      .then((d) => setCache((c) => ({ ...c, [parkId]: d })))
      .finally(() => setLoading(false));
  }
  return null;
}

// ── Predict step ──────────────────────────────────────────────────────────

function PredictStep({
  step,
  onNext,
}: {
  step: Step;
  onNext: () => void;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);

  const choices = step.choices ?? [];
  const correct = picked != null ? choices[picked].correct : false;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6 }}>{step.body}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {choices.map((ch, i) => {
          const isSelected = picked === i;
          const isRevealed = revealed;
          let bg = "var(--surface)";
          let border = "var(--border)";
          if (isRevealed && isSelected) {
            bg = ch.correct ? "#d4edda" : "#f8d7da";
            border = ch.correct ? "#2a7d4f" : "#c0392b";
          } else if (isRevealed && ch.correct) {
            bg = "#d4edda";
            border = "#2a7d4f";
          } else if (isSelected) {
            border = "var(--accent)";
            bg = "var(--accent-tint)";
          }
          return (
            <button
              key={i}
              disabled={revealed}
              onClick={() => setPicked(i)}
              style={{
                background: bg,
                border: `2px solid ${border}`,
                borderRadius: 10,
                padding: "12px 16px",
                cursor: revealed ? "default" : "pointer",
                textAlign: "left",
                fontSize: 14,
                fontWeight: isSelected ? 600 : 400,
                transition: "all 0.15s",
              }}
            >
              {ch.label}
            </button>
          );
        })}
      </div>

      {!revealed && picked != null && (
        <button
          onClick={() => setRevealed(true)}
          style={{
            background: "var(--accent)",
            color: "var(--on-accent)",
            border: "none",
            borderRadius: 8,
            padding: "10px 20px",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: 14,
            alignSelf: "flex-start",
          }}
        >
          Reveal the answer
        </button>
      )}

      {revealed && picked != null && (
        <div
          style={{
            background: correct ? "#d4edda" : "#fff3cd",
            border: `1px solid ${correct ? "#2a7d4f" : "#b8860b"}`,
            borderRadius: 10,
            padding: "14px 16px",
            fontSize: 14,
            lineHeight: 1.6,
          }}
        >
          <strong>{correct ? "✓ You got it." : "✗ Not quite."}</strong>{" "}
          {choices[picked].explanation}
        </div>
      )}

      {revealed && (
        <button
          onClick={onNext}
          style={{
            background: "var(--accent)",
            color: "var(--on-accent)",
            border: "none",
            borderRadius: 8,
            padding: "10px 20px",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: 14,
            alignSelf: "flex-start",
          }}
        >
          Next step →
        </button>
      )}
    </div>
  );
}

// ── Examine / Analyze step (shows the actual chart + card) ────────────────

function DataStep({
  step,
  atlas,
  onNext,
  onGoPlanner,
  isLast,
}: {
  step: Step;
  atlas: Atlas;
  onNext: () => void;
  onGoPlanner?: (month: number) => void;
  isLast: boolean;
}) {
  const data = useParkTrends(step.parkId);

  let trend: TrendRow | null = null;
  if (data && step.variable && step.period) {
    trend = data.trends.find(
      (t) => t.variable === step.variable && t.period === step.period,
    ) ?? null;
  }

  const series =
    data && step.variable && step.period
      ? data.series[step.variable]?.[step.period] ?? null
      : null;

  const meta = step.variable ? atlas.variables[step.variable] : null;
  const isTemp = meta?.unit.includes("°");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6 }}>{step.body}</p>

      {step.parkId && !data && (
        <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading data…</div>
      )}

      {series && trend && meta && (
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: 20,
          }}
        >
          <TrendChart
            series={series}
            trend={trend}
            unit={isTemp ? "°F" : meta.unit}
            label={`${meta.label} · ${PERIOD_LABEL[step.period!] ?? step.period}`}
          />
        </div>
      )}

      {step.kind === "analyze" && trend && meta && (
        <ExplainerCard
          parkName={data?.park?.name ?? step.parkId ?? ""}
          trend={trend}
          meta={meta}
          period={step.period ?? ""}
          periodLabel={PERIOD_LABEL[step.period!] ?? step.period ?? ""}
          useFahrenheit={isTemp ?? false}
        />
      )}

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {!isLast && (
          <button
            onClick={onNext}
            style={{
              background: "var(--accent)",
              color: "var(--on-accent)",
              border: "none",
              borderRadius: 8,
              padding: "10px 20px",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            Next step →
          </button>
        )}
        {isLast && step.plannerLink && onGoPlanner && (
          <button
            onClick={() => onGoPlanner(step.plannerLink!.month)}
            style={{
              background: "var(--accent)",
              color: "var(--on-accent)",
              border: "none",
              borderRadius: 8,
              padding: "10px 20px",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            🗓 {step.plannerLink.label}
          </button>
        )}
        {isLast && (
          <button
            onClick={onNext}
            style={{
              background: "none",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "10px 20px",
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            ← Back to cases
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────

export default function StudentDetective({
  atlas,
  onGoPlanner,
  navCaseId,
  navStep,
  onNavChange,
}: {
  atlas: Atlas;
  onGoPlanner: (month: number) => void;
  navCaseId?: string | null;
  navStep?: number | null;
  onNavChange?: (caseId: string | null, step: number | null) => void;
}) {
  const [activeCase, setActiveCase] = useState<Case | null>(() =>
    navCaseId ? (CASES.find((c) => c.id === navCaseId) ?? null) : null,
  );
  const [stepIndex, setStepIndex] = useState(navStep ?? 0);
  const [scores, setScores] = useState<Record<number, { pts: number; max: number }>>({});
  const [result, setResult] = useState<CaseResult | null>(null);

  // Sync from URL (back/forward landed on student tab with a case in URL).
  useEffect(() => {
    const c = navCaseId ? (CASES.find((x) => x.id === navCaseId) ?? null) : null;
    setActiveCase(c);
    setStepIndex(navStep ?? 0);
    if ((navStep ?? 0) === 0) { setScores({}); setResult(null); }
  }, [navCaseId, navStep]);

  function startCase(c: Case) {
    setActiveCase(c);
    setStepIndex(0);
    setScores({});
    setResult(null);
    onNavChange?.(c.id, 0);
  }

  function nextStep() {
    if (!activeCase) return;
    if (stepIndex + 1 >= activeCase.steps.length) {
      const vals = Object.values(scores);
      const max = vals.reduce((n, v) => n + v.max, 0);
      if (max > 0) {
        setResult(saveResult(activeCase.id, vals.reduce((n, v) => n + v.pts, 0), max));
      } else {
        backToCases();
      }
    } else {
      const next = stepIndex + 1;
      setStepIndex(next);
      onNavChange?.(activeCase.id, next);
    }
  }

  function backToCases() {
    setResult(null);
    setActiveCase(null);
    setStepIndex(0);
    onNavChange?.(null, null);
  }

  if (!activeCase) {
    return <CaseList onSelect={startCase} />;
  }

  if (result) {
    return (
      <CaseClosed
        c={activeCase}
        result={result}
        onAgain={() => startCase(activeCase)}
        onBack={backToCases}
        onPlanner={(() => {
          const link = activeCase.steps.find((s) => s.plannerLink)?.plannerLink;
          return link ? { label: link.label, go: () => onGoPlanner(link.month) } : undefined;
        })()}
      />
    );
  }

  const step = activeCase.steps[stepIndex];
  const isLast = stepIndex === activeCase.steps.length - 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Case header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <button
          onClick={backToCases}
          style={{
            background: "none",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "6px 14px",
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          ← All cases
        </button>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>
            {activeCase.emoji} {activeCase.title}
          </div>
        </div>
      </div>

      {/* Step */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          padding: "24px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--accent-2)",
              marginBottom: 6,
            }}
          >
            {step.kind === "intro" && "Scene"}
            {step.kind === "predict" && "🔮 Your prediction"}
            {step.kind === "examine" && "🔍 Examine the data"}
            {step.kind === "analyze" && "📊 Statistical analysis"}
            {step.kind === "interpret" && "💡 What it means"}
            {(GAME_KINDS as readonly string[]).includes(step.kind) && "🎮 Your move"}
          </div>
          <h3 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700 }}>
            {step.heading}
          </h3>
        </div>

        {(step.kind === "intro") && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.7 }}>{step.body}</p>
            <button
              onClick={nextStep}
              style={{
                background: "var(--accent)",
                color: "var(--on-accent)",
                border: "none",
                borderRadius: 8,
                padding: "10px 20px",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: 14,
                alignSelf: "flex-start",
              }}
            >
              Let's start →
            </button>
          </div>
        )}

        {step.kind === "predict" && (
          <PredictStep step={step} onNext={nextStep} />
        )}

        {(GAME_KINDS as readonly string[]).includes(step.kind) && (
          <GameStep
            key={`${activeCase.id}-${stepIndex}`}
            step={step}
            atlas={atlas}
            onScore={(pts, max) => setScores((s) => ({ ...s, [stepIndex]: { pts, max } }))}
            onNext={nextStep}
            nextLabel={isLast ? "Finish case 🏁" : "Next →"}
          />
        )}

        {(step.kind === "examine" || step.kind === "analyze" || step.kind === "interpret") && (
          <DataStep
            step={step}
            atlas={atlas}
            onNext={nextStep}
            onGoPlanner={onGoPlanner}
            isLast={isLast}
          />
        )}
      </div>
    </div>
  );
}

// ── End-of-case screen ────────────────────────────────────────────────────

function CaseClosed({
  c, result, onAgain, onBack, onPlanner,
}: {
  c: Case;
  result: CaseResult;
  onAgain: () => void;
  onBack: () => void;
  onPlanner?: { label: string; go: () => void };
}) {
  const verdict =
    result.stars === 3 ? "Case closed. Flawless." : result.stars === 2 ? "Case closed. Solid work." : "Case closed. Try again for more stars.";
  const btn = { borderRadius: 8, padding: "10px 20px", cursor: "pointer", fontWeight: 600, fontSize: 14 } as const;
  return (
    <div
      style={{
        background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14,
        padding: "32px 20px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
      }}
    >
      <div style={{ fontSize: 56 }}>{c.emoji}</div>
      <div style={{ fontSize: 26, letterSpacing: 4 }}>
        {[1, 2, 3].map((n) => (
          <span key={n} style={{ opacity: n <= result.stars ? 1 : 0.2 }}>⭐</span>
        ))}
      </div>
      <h3 style={{ margin: 0, fontSize: 20 }}>{verdict}</h3>
      <div style={{ fontSize: 14, color: "var(--text-muted)" }}>
        {result.pts} of {result.max} points
      </div>
      {c.badge && (
        <div
          style={{
            border: "2px dashed var(--accent)", background: "var(--accent-tint)", borderRadius: 999,
            padding: "8px 18px", fontWeight: 700,
          }}
        >
          Badge: {c.badge}
        </div>
      )}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", marginTop: 6 }}>
        <button onClick={onAgain} style={{ ...btn, background: "var(--accent)", color: "var(--on-accent)", border: "none" }}>
          Play again
        </button>
        {onPlanner && (
          <button onClick={onPlanner.go} style={{ ...btn, background: "none", border: "1px solid var(--border)" }}>
            🗓 {onPlanner.label}
          </button>
        )}
        <button onClick={onBack} style={{ ...btn, background: "none", border: "1px solid var(--border)" }}>
          ← All cases
        </button>
      </div>
    </div>
  );
}
