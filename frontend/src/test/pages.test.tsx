// @vitest-environment jsdom
// Render tests: the real pages, fed by the real bundled NASA data through a fake fetch.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import App from "../App";
import ErrorBoundary from "../ErrorBoundary";
import GraceCard from "../research/GraceCard";
import { installFakeApi, installStorage } from "./fakeApi";

installStorage();
const researcher = () => localStorage.setItem("profile", JSON.stringify({ name: "Purva", persona: "researcher" }));

beforeEach(() => {
  localStorage.clear();
  history.replaceState(null, "", "/");
  installFakeApi();
});
afterEach(cleanup);

describe("App", () => {
  it("shows the sign-up page when there is no profile", async () => {
    render(<App />);
    expect(await screen.findByText(/Researcher/)).toBeTruthy();
  });

  it("opens the researcher field station with grouped nav and real data", async () => {
    researcher();
    render(<App />);
    expect(await screen.findByText("Welcome back, Purva")).toBeTruthy();
    expect(screen.getByText(/🧭 Explore/)).toBeTruthy();
    expect(screen.getByText(/🥊 Compare/)).toBeTruthy();
    expect(await screen.findByText(/Anomaly of the week/)).toBeTruthy();
    expect(screen.getAllByText(/NASA data up to Oct 2026/).length).toBeGreaterThan(0);
  });

  it("arrow keys move between researcher tools", async () => {
    researcher();
    render(<App />);
    await screen.findByText("Welcome back, Purva");
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(location.hash).toContain("tab=atlas");
  });

  it("the Campfire has no Cite this, and shows example notes when empty", async () => {
    researcher();
    history.replaceState(null, "", "#tab=community");
    render(<App />);
    expect((await screen.findAllByText(/Not a real post/i, undefined, { timeout: 3000 })).length).toBe(3);
    expect(screen.queryByText(/Cite this/)).toBeNull();
  });

  it("park explorer starts from questions, with a podium and a plot twist", async () => {
    localStorage.setItem("profile", JSON.stringify({ name: "", persona: "student" }));
    history.replaceState(null, "", "#tab=explore");
    render(<App />);
    expect(await screen.findByText("Pick a question", undefined, { timeout: 3000 })).toBeTruthy();
    expect(screen.getByText("🥇")).toBeTruthy();
    fireEvent.click(screen.getByText("Where is rain changing most?"));
    expect(await screen.findByText(/Plot twist/)).toBeTruthy();
    expect(screen.getByText(/Show all 63 parks/)).toBeTruthy();
  });

  it("an old student profile opens Explorer home with the twin game", async () => {
    localStorage.setItem("profile", JSON.stringify({ name: "", persona: "student" }));
    render(<App />);
    expect(await screen.findByText(/Who changes most like/, undefined, { timeout: 3000 })).toBeTruthy();
    expect(screen.getByText(/Explorer mode/)).toBeTruthy();
  });

  it("an old visitor profile gets the merged Explorer tabs and passport", async () => {
    localStorage.setItem("profile", JSON.stringify({ name: "Sam", persona: "visitor" }));
    render(<App />);
    expect(await screen.findByText(/0 of \d+ parks stamped/, undefined, { timeout: 3000 })).toBeTruthy();
    for (const t of ["🗓 Trip Planner", "🔍 Cases", "🧭 Park Explorer", "🎫 Passport"]) expect(screen.getByText(t)).toBeTruthy();
    const sw = screen.getByRole("switch");
    expect(sw.textContent).toContain("Science off");
    fireEvent.click(sw);
    expect(sw.textContent).toContain("Science on");
    expect(localStorage.getItem("explorer.science")).toBe("true");
  });

  it("the trip planner shows only the best matches, with why #1, chips and the drawer", async () => {
    localStorage.setItem("profile", JSON.stringify({ name: "", persona: "explorer" }));
    history.replaceState(null, "", "#tab=planner&month=10");
    render(<App />);
    expect(await screen.findByText(/Why #1\?/, undefined, { timeout: 3000 })).toBeTruthy();
    expect(screen.getByText(/parks? fit your trip/)).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /score \d+\. Open details/ })).toHaveLength(3);
    // Seasons pick 3 months; a chip goes nice -> must.
    fireEvent.click(screen.getByRole("button", { name: /Autumn/ }));
    const stars = screen.getByRole("button", { name: /^Stargazing:/ });
    fireEvent.click(stars);
    expect(stars.getAttribute("aria-label")).toContain("nice to have");
    fireEvent.click(stars);
    expect(stars.getAttribute("aria-label")).toContain("must have");
    expect(location.hash).toContain("trip=");
    // Open the top park, save it, and close.
    fireEvent.click(screen.getAllByRole("button", { name: /Open details/ })[0]);
    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(screen.getByText(/Then, now and 2050/)).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: /Want to go/ })[0]);
    expect(JSON.parse(localStorage.getItem("wishlist")!)).toHaveLength(1);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("the science switch adds factor scores in the planner and the full atlas in Park Explorer", async () => {
    localStorage.setItem("profile", JSON.stringify({ name: "", persona: "explorer" }));
    history.replaceState(null, "", "#tab=planner&month=10");
    render(<App />);
    await screen.findByText(/Why #1\?/, undefined, { timeout: 3000 });
    expect(screen.queryAllByText(/\/100 ×/)).toHaveLength(0);
    fireEvent.click(screen.getByRole("switch"));
    expect(screen.getAllByText(/\/100 ×/).length).toBeGreaterThan(0);
    expect(screen.getByRole("status").textContent).toContain("Science on");
    fireEvent.click(screen.getByText("🧭 Park Explorer"));
    expect(await screen.findByText("National Trend Atlas", undefined, { timeout: 3000 })).toBeTruthy();
    fireEvent.click(screen.getByRole("switch"));
    expect(await screen.findByText("Pick a question", undefined, { timeout: 3000 })).toBeTruthy();
  });

  it("a mood sets the chips", async () => {
    localStorage.setItem("profile", JSON.stringify({ name: "", persona: "explorer" }));
    history.replaceState(null, "", "#tab=planner");
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: /Leaf peeping/ }, { timeout: 3000 }));
    expect(screen.getByRole("button", { name: /^Fall colours:/ }).getAttribute("aria-label")).toContain("must have");
  });

  it("a solved case stamps its parks in the passport", async () => {
    localStorage.setItem("profile", JSON.stringify({ name: "", persona: "explorer" }));
    localStorage.setItem("detective.progress", JSON.stringify({ "crater-lake-warming": { pts: 5, max: 5, stars: 3 } }));
    history.replaceState(null, "", "#tab=passport");
    render(<App />);
    expect(await screen.findByText(/stamps$/, undefined, { timeout: 3000 })).toBeTruthy();
    expect(screen.getAllByTitle(/case\(s\) solved here/).length).toBeGreaterThan(0);
    expect(screen.getByText("No case yet")).toBeTruthy();
  });
});

describe("GraceCard", () => {
  it("shows a trend for a land park and a note for an ocean cell", async () => {
    render(<GraceCard parkId="zion" parkName="Zion" />);
    expect(await screen.findByText(/cm of water per decade/)).toBeTruthy();
    cleanup();
    render(<GraceCard parkId="npsa" parkName="American Samoa" />);
    expect(await screen.findByText(/mostly ocean GRACE cell/)).toBeTruthy();
  });
});

describe("ErrorBoundary", () => {
  it("keeps the rest of the page when one card crashes", () => {
    const Boom = () => {
      throw new Error("kaboom");
    };
    const err = console.error;
    console.error = () => {};
    render(
      <div>
        <p>still here</p>
        <ErrorBoundary what="This card"><Boom /></ErrorBoundary>
      </div>,
    );
    console.error = err;
    expect(screen.getByText("still here")).toBeTruthy();
    expect(screen.getByText(/This card hit a problem/)).toBeTruthy();
  });
});
