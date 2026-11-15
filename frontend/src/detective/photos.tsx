// One free-licence photo per park (Wikimedia Commons), from backend/scripts/step9_park_photos.py.
import raw from "./parkPhotos.json";

export interface ParkPhoto {
  file: string;
  credit: string;
  license: string;
  source: string;
}

export const PHOTOS = raw as Record<string, ParkPhoto>;

export const photoOf = (code: string | null | undefined): ParkPhoto | undefined => (code ? PHOTOS[code] : undefined);

/** "📷 Name · CC BY-SA 3.0", linking to the Commons page. */
export function PhotoCredit({ photo, style }: { photo: ParkPhoto; style?: React.CSSProperties }) {
  return (
    <a
      href={photo.source}
      target="_blank"
      rel="noreferrer"
      title={`Photo: ${photo.credit} (${photo.license}), Wikimedia Commons`}
      style={{ fontSize: 10, textDecoration: "none", maxWidth: "70%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", ...style }}
    >
      📷 {photo.credit} · {photo.license}
    </a>
  );
}
