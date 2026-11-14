import { api, type KoppenClass, type Place } from "../../api";
import { Status } from "../../components/Status";
import { useAsync } from "../../hooks";

function ClassCard({ label, cls, tag }: { label: string; cls: KoppenClass | null; tag: "Measured" | "Projection" }) {
  return (
    <section className="card">
      <header className="card-head">
        <h3 className="section-title">{label}</h3>
        <span className={`tag ${tag === "Measured" ? "tag-measured" : "tag-illustration"}`}>{tag}</span>
      </header>
      {cls ? (
        <div className="row gap-12">
          {/* Swatch uses Beck et al.'s published legend colour for this class. */}
          <span className="swatch" style={{ background: `rgb(${cls.rgb.join(",")})` }} aria-hidden />
          <div>
            <div className="headline">{cls.code}</div>
            <div className="muted">{cls.name}</div>
          </div>
        </div>
      ) : (
        <p className="muted">No data (ocean)</p>
      )}
    </section>
  );
}

export default function KoppenPanel({ place }: { place: Place }) {
  const state = useAsync(() => api.koppen(place.lat, place.lon), `${place.lat},${place.lon}`);
  return (
    <div className="panel-stack">
      <Status state={state} loading="Reading bundled climate maps…">
        {(d) => (
          <>
            <div className="chart-grid">
              <ClassCard label="Now · 1991–2020" cls={d.now} tag="Measured" />
              <ClassCard label="2041–2070 · SSP2-4.5" cls={d.future} tag="Projection" />
            </div>
            {d.changed != null && (
              <p className="small">
                {d.changed
                  ? `Projected to shift from ${d.now?.code} to ${d.future?.code} by mid-century.`
                  : "Climate class projected to stay the same by mid-century."}
              </p>
            )}
            <p className="micro muted">0.5° grid. Beck et al. (2023), Scientific Data 10, 724.</p>
          </>
        )}
      </Status>
    </div>
  );
}
