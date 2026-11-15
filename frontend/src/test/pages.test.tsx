// @vitest-environment jsdom
// Render tests: the real pages, fed by the real bundled NASA data through a fake fetch.
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import App from "../App";
import ErrorBoundary from "../ErrorBoundary";
import GraceCard from "../research/GraceCard";
import { installFakeApi, installStorage } from "./fakeApi";

installStorage();
const researcher = () => localStorage.setItem("profile", JSON.stringify({ name: "Purva", research: true }));

beforeEach(() => {
  localStorage.clear();
  history.replaceState(null, "", "/");
  installFakeApi();
});
afterEach(cleanup);

const researchMenu = () =>
  screen.getAllByRole("button", { name: /^Research/ }).find((b) => b.getAttribute("aria-haspopup") === "menu")!;

describe("App", () => {
  it("shows the Canopy sign-up with a research switch that is off by default", async () => {
    render(<App />);
    expect(await screen.findByText("Go when the park is at its best.")).toBeTruthy();
    const sw = screen.getByRole("switch", { name: /research tools too/i });
    expect(sw.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(sw);
    fireEvent.click(screen.getByRole("button", { name: "Continue as a guest" }));
    expect(JSON.parse(localStorage.getItem("profile")!)).toEqual({ name: "", research: true });
  });

  it("signs up, logs out, and logs back in with the same password", async () => {
    render(<App />);
    fireEvent.change(await screen.findByLabelText("Name"), { target: { value: "Ana" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "Ana@Example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "short" } });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/8 characters/);
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "parks-2026" } });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    await screen.findByRole("navigation", { name: "Main" }, { timeout: 3000 });
    expect(JSON.parse(localStorage.getItem("profile")!)).toEqual({ name: "Ana", research: false, email: "ana@example.com" });
    expect(localStorage.getItem("accounts")).not.toContain("parks-2026");

    localStorage.setItem("wishlist", JSON.stringify(["zion"]));
    fireEvent.click(screen.getByRole("button", { name: "A" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Log out" }));
    // Logged out: back on the sign-in page, and Ana's saved parks are put away.
    expect(await screen.findByRole("button", { name: "Continue as a guest" })).toBeTruthy();
    expect(localStorage.getItem("profile")).toBeNull();
    expect(localStorage.getItem("wishlist")).toBeNull();
    fireEvent.click(await screen.findByRole("tab", { name: "Log in" }));
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ana@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrong-pass" } });
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/wrong/);
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "parks-2026" } });
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));
    await screen.findByRole("navigation", { name: "Main" }, { timeout: 3000 });
    expect(await screen.findByText("Welcome, Ana", undefined, { timeout: 3000 })).toBeTruthy();
    expect(JSON.parse(localStorage.getItem("wishlist")!)).toEqual(["zion"]);
  });

  it("a guest can open the sign-in page from the profile menu and keeps their data", async () => {
    localStorage.setItem("profile", JSON.stringify({ name: "", research: false }));
    localStorage.setItem("wishlist", JSON.stringify(["acadia"]));
    render(<App />);
    await screen.findByRole("navigation", { name: "Main" });
    fireEvent.click(screen.getByRole("button", { name: "?" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Sign up or log in" }));
    expect(await screen.findByRole("tab", { name: "Sign up" })).toBeTruthy();
    // Logged out: nobody's data is on screen.
    expect(localStorage.getItem("wishlist")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Continue as a guest" }));
    expect(JSON.parse(localStorage.getItem("wishlist")!)).toEqual(["acadia"]);
  });

  it("a new account starts empty, even after another user on this device", async () => {
    localStorage.setItem("detective.progress", JSON.stringify({ "crater-lake-warming": { pts: 5, max: 5, stars: 3 } }));
    render(<App />);
    fireEvent.change(await screen.findByLabelText("Name"), { target: { value: "Bo" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "bo@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "parks-2026" } });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    await screen.findByRole("navigation", { name: "Main" }, { timeout: 3000 });
    expect(localStorage.getItem("detective.progress")).toBeNull();
  });

  it("with research on, the nav has the five tabs and a Research menu with every research tool", async () => {
    researcher();
    render(<App />);
    const nav = await screen.findByRole("navigation", { name: "Main" });
    expect([...nav.querySelectorAll("button")].map((b) => b.textContent)).toEqual(["Home", "Plan", "Mysteries", "Saved", "Passport"]);
    fireEvent.click(researchMenu());
    const items = screen.getAllByRole("menuitem").map((b) => b.textContent);
    expect(items).toEqual(["Trend Atlas", "Topo Map", "Analog Sites", "Park Families", "Odd One Out", "Season Shifts", "Head-to-Head", "Robustness", "Campfire"]);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    fireEvent.click(researchMenu());
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("menu")).toBeNull();
    fireEvent.click(researchMenu());
    fireEvent.click(screen.getByRole("menuitem", { name: "Topo Map" }));
    expect(location.hash).toContain("tab=map");
  });

  it("with research off, there is no Research menu and a research URL falls back to Home with a hint", async () => {
    localStorage.setItem("profile", JSON.stringify({ name: "Sam", research: false }));
    history.replaceState(null, "", "#tab=atlas");
    render(<App />);
    expect(await screen.findByText(/part of the research tools/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Research/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Turn them on" }));
    expect(JSON.parse(localStorage.getItem("profile")!).research).toBe(true);
    expect(await screen.findByRole("button", { name: /^Research/ })).toBeTruthy();
  });

  it("the profile menu switches research tools on and off", async () => {
    localStorage.setItem("profile", JSON.stringify({ name: "Sam", research: false }));
    render(<App />);
    await screen.findByRole("navigation", { name: "Main" });
    fireEvent.click(screen.getByRole("button", { name: "S" }));
    fireEvent.click(screen.getByRole("menuitemcheckbox"));
    expect(JSON.parse(localStorage.getItem("profile")!)).toEqual({ name: "Sam", research: true });
    const research = screen.getAllByRole("button", { name: /^Research/ });
    expect(research.some((b) => b.getAttribute("aria-haspopup") === "menu")).toBe(true);
  });

  it("opens the researcher field station with real data", async () => {
    researcher();
    render(<App />);
    expect(await screen.findByText("Welcome, Purva")).toBeTruthy();
    expect(screen.getByText("Go when the park is at its best.")).toBeTruthy();
    expect(screen.getByText("Trend atlas, maps, comparisons and methods.")).toBeTruthy();
  });

  it("arrow keys move between research tools", async () => {
    researcher();
    history.replaceState(null, "", "#tab=atlas");
    render(<App />);
    await screen.findByRole("navigation", { name: "Main" });
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(location.hash).toContain("tab=map");
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
    expect(await screen.findByText("Play today", undefined, { timeout: 3000 })).toBeTruthy();
    expect(screen.queryByText("Trend atlas, maps, comparisons and methods.")).toBeNull();
  });

  it("an old visitor profile gets the merged Explorer tabs and passport", async () => {
    localStorage.setItem("profile", JSON.stringify({ name: "Sam", persona: "visitor" }));
    render(<App />);
    const nav = await screen.findByRole("navigation", { name: "Main" }, { timeout: 3000 });
    for (const t of ["Plan", "Saved", "Mysteries", "Passport"]) expect(within(nav).getAllByText(t).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /^Research/ })).toBeNull();
  });

  it("a mystery's planner link opens that park", async () => {
    localStorage.setItem("profile", JSON.stringify({ name: "", research: false }));
    history.replaceState(null, "", "#tab=planner&month=10&park=zion");
    render(<App />);
    const d = await screen.findByRole("dialog", undefined, { timeout: 3000 });
    expect(d.textContent).toMatch(/Zion/);
    // The year view fills the drawer even with nothing picked.
    expect(await within(d).findByText("Things to do")).toBeTruthy();
    expect(within(d).getByText("Watch out for")).toBeTruthy();
    expect(within(d).getByText("Jun–Aug")).toBeTruthy();
  });

  it("the trip planner shows only the best matches, with why #1, chips and the drawer", async () => {
    localStorage.setItem("profile", JSON.stringify({ name: "", research: false }));
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

  it("Explorer always sees plain words: no factor scores, simple Park Explorer", async () => {
    localStorage.setItem("profile", JSON.stringify({ name: "", research: false }));
    history.replaceState(null, "", "#tab=planner&month=10");
    render(<App />);
    await screen.findByText(/Why #1\?/, undefined, { timeout: 3000 });
    expect(screen.queryAllByText(/\/100 ×/)).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Home" }));
    history.pushState(null, "", "#tab=explore");
    fireEvent(window, new HashChangeEvent("hashchange"));
    expect(await screen.findByText("Pick a question", undefined, { timeout: 3000 })).toBeTruthy();
  });

  it("Clear all lists every park A to Z with no ranks or scores", async () => {
    localStorage.setItem("profile", JSON.stringify({ name: "", research: false }));
    history.replaceState(null, "", "#tab=planner&month=10");
    render(<App />);
    await screen.findByText(/Why #1\?/, undefined, { timeout: 3000 });
    fireEvent.click(screen.getByRole("button", { name: /Clear all filters/ }));
    expect(await screen.findByText(/^All \d+ parks$/, undefined, { timeout: 3000 })).toBeTruthy();
    expect(screen.queryByText(/Why #1\?/)).toBeNull();
    expect(screen.queryByRole("button", { name: /Clear all filters/ })).toBeNull();
    const names = screen.getAllByRole("button", { name: /\. Open details$/ }).map((b) => b.getAttribute("aria-label")!);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    expect(names.some((n) => /score/.test(n))).toBe(false);
  });

  it("a mood sets the chips", async () => {
    localStorage.setItem("profile", JSON.stringify({ name: "", research: false }));
    history.replaceState(null, "", "#tab=planner");
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: /Leaf peeping/ }, { timeout: 3000 }));
    expect(screen.getByRole("button", { name: /^Fall colours:/ }).getAttribute("aria-label")).toContain("must have");
  });

  it("a solved case stamps its parks in the passport", async () => {
    localStorage.setItem("profile", JSON.stringify({ name: "", research: false }));
    localStorage.setItem("detective.progress", JSON.stringify({ "crater-lake-warming": { pts: 5, max: 5, stars: 3 } }));
    history.replaceState(null, "", "#tab=passport");
    render(<App />);
    expect(await screen.findByText(/stamps$/, undefined, { timeout: 3000 })).toBeTruthy();
    expect(screen.getAllByTitle(/myster(y|ies) solved here/).length).toBeGreaterThan(0);
    expect(screen.getByText("No mystery yet")).toBeTruthy();
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
