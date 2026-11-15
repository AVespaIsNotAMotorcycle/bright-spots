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

/** Guest → profile menu → the sign-in form. */
async function openSignIn() {
  fireEvent.click(await screen.findByRole("button", { name: "?" }, { timeout: 3000 }));
  fireEvent.click(screen.getByRole("menuitem", { name: "Sign up or log in" }));
  await screen.findByRole("tab", { name: "Sign up" });
}

const researchMenu = () =>
  screen.getAllByRole("button", { name: /^Research/ }).find((b) => b.getAttribute("aria-haspopup") === "menu")!;

describe("App", () => {
  it("a first visit is a guest on Plan's preferences, with no sign-in screen", async () => {
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Your preferences" }, { timeout: 3000 })).toBeTruthy();
    expect(screen.queryByRole("tab", { name: "Sign up" })).toBeNull();
    expect(JSON.parse(localStorage.getItem("profile")!)).toEqual({ name: "", research: false });
    expect(location.pathname).toBe("/plan");
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(within(nav).getByRole("button", { name: "Plan" }).getAttribute("aria-current")).toBe("page");
  });

  it("the sign-up form keeps a research switch that is off by default", async () => {
    render(<App />);
    await screen.findByRole("navigation", { name: "Main" });
    fireEvent.click(screen.getByRole("button", { name: "?" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Sign up or log in" }));
    const sw = await screen.findByRole("switch", { name: /research tools too/i });
    expect(sw.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(sw);
    fireEvent.click(screen.getByRole("button", { name: "Continue as a guest" }));
    expect(JSON.parse(localStorage.getItem("profile")!)).toEqual({ name: "", research: true });
  });

  it("signs up, logs out to the guest, and logs back in with the same password", async () => {
    render(<App />);
    await openSignIn();
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
    // Logged out: the site carries on as the guest, and Ana's saved parks are put away.
    await screen.findByRole("button", { name: "?" });
    expect(JSON.parse(localStorage.getItem("profile")!)).toEqual({ name: "", research: false });
    expect(localStorage.getItem("wishlist")).toBeNull();
    await openSignIn();
    fireEvent.click(await screen.findByRole("tab", { name: "Log in" }));
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ana@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrong-pass" } });
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/wrong/);
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "parks-2026" } });
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));
    await screen.findByRole("navigation", { name: "Main" }, { timeout: 3000 });
    expect(await screen.findByRole("button", { name: "A" })).toBeTruthy();
    expect(JSON.parse(localStorage.getItem("wishlist")!)).toEqual(["zion"]);
  });

  it("account pages have their own paths, and signing up returns to the page you were on", async () => {
    history.replaceState(null, "", "/saved");
    const { unmount } = render(<App />);
    // No wall: a guest stays on /saved until they ask to sign up.
    await screen.findByRole("navigation", { name: "Main" });
    expect(location.pathname).toBe("/saved");
    await openSignIn();
    expect(location.pathname + location.search).toBe("/signup?next=%2Fsaved");
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Cy" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "cy@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "parks-2026" } });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    await screen.findByRole("navigation", { name: "Main" }, { timeout: 3000 });
    expect(location.pathname).toBe("/saved");
    // Edit profile is /profile, and Cancel goes back.
    fireEvent.click(screen.getByRole("button", { name: "C" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit profile" }));
    expect(location.pathname).toBe("/profile");
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(location.pathname).toBe("/saved");
    unmount();
    // /logout logs the account out to the guest, on Plan.
    history.replaceState(null, "", "/logout");
    render(<App />);
    await screen.findByRole("button", { name: "?" }, { timeout: 3000 });
    expect(location.pathname).toBe("/plan");
    expect(JSON.parse(localStorage.getItem("profile")!)).toEqual({ name: "", research: false });
    // The form's tabs switch the path.
    await openSignIn();
    fireEvent.click(screen.getByRole("tab", { name: "Log in" }));
    expect(location.pathname).toBe("/login");
  });

  it("leaving the sign-in form with the back button brings the guest back with their data", async () => {
    localStorage.setItem("profile", JSON.stringify({ name: "", research: false }));
    localStorage.setItem("wishlist", JSON.stringify(["acadia"]));
    render(<App />);
    await openSignIn();
    expect(localStorage.getItem("wishlist")).toBeNull();
    history.back();
    await screen.findByRole("navigation", { name: "Main" }, { timeout: 3000 });
    expect(JSON.parse(localStorage.getItem("wishlist")!)).toEqual(["acadia"]);
    expect(JSON.parse(localStorage.getItem("profile")!)).toEqual({ name: "", research: false });
  });

  it("a login link cannot send you to another site", async () => {
    localStorage.setItem("profile", JSON.stringify({ name: "Di", research: false, email: "di@example.com" }));
    history.replaceState(null, "", "/login?next=//evil.example");
    render(<App />);
    await screen.findByRole("navigation", { name: "Main" });
    expect(location.href).not.toContain("evil");
    expect(location.pathname).toMatch(/^\/(plan)?$/);
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
    await openSignIn();
    fireEvent.change(await screen.findByLabelText("Name"), { target: { value: "Bo" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "bo@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "parks-2026" } });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    await screen.findByRole("navigation", { name: "Main" }, { timeout: 3000 });
    expect(localStorage.getItem("detective.progress")).toBeNull();
  });

  it("with research on, the nav has the four tabs and a Research menu with every research tool", async () => {
    researcher();
    render(<App />);
    const nav = await screen.findByRole("navigation", { name: "Main" });
    expect([...nav.querySelectorAll("button")].map((b) => b.textContent)).toEqual(["Plan", "Mysteries", "Saved", "Passport"]);
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
    expect(location.pathname).toBe("/research/topo-map");
  });

  it("with research off, there is no Research menu and a research URL falls back to Plan with a hint", async () => {
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

  it("there is no Home page: the old link and the logo both open Plan", async () => {
    researcher();
    history.replaceState(null, "", "#tab=home");
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Your preferences" }, { timeout: 3000 })).toBeTruthy();
    expect(location.pathname).toBe("/plan");
    fireEvent.click(within(screen.getByRole("navigation", { name: "Main" })).getByRole("button", { name: "Saved" }));
    expect(location.pathname).toBe("/saved");
    fireEvent.click(screen.getByRole("button", { name: /^Canopy/ }));
    expect(location.pathname).toBe("/plan");
  });

  it("arrow keys move between research tools", async () => {
    researcher();
    history.replaceState(null, "", "#tab=atlas");
    render(<App />);
    await screen.findByRole("navigation", { name: "Main" });
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(location.pathname).toBe("/research/topo-map");
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

  it("an old student profile opens Plan, without the research tools", async () => {
    localStorage.setItem("profile", JSON.stringify({ name: "", persona: "student" }));
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Your preferences" }, { timeout: 3000 })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Research/ })).toBeNull();
  });

  it("an old visitor profile gets the merged Explorer tabs and passport", async () => {
    localStorage.setItem("profile", JSON.stringify({ name: "Sam", persona: "visitor" }));
    render(<App />);
    const nav = await screen.findByRole("navigation", { name: "Main" }, { timeout: 3000 });
    for (const t of ["Plan", "Saved", "Mysteries", "Passport"]) expect(within(nav).getAllByText(t).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /^Research/ })).toBeNull();
  });

  it("a mystery's planner link goes straight to the parks, with that park ticked and first", async () => {
    history.replaceState(null, "", "#tab=planner&month=10&park=zion");
    render(<App />);
    const zion = await screen.findByRole("checkbox", { name: /^Zion/ }, { timeout: 3000 });
    expect((zion as HTMLInputElement).checked).toBe(true);
    expect(screen.getAllByRole("heading", { level: 3 })[0]).toBeTruthy();
    expect(screen.getByRole("heading", { level: 3, name: "Zion" })).toBeTruthy();
  });

  it("Plan is two steps: preferences, then a ranked list with a card per ticked park", async () => {
    history.replaceState(null, "", "#tab=planner&month=10");
    render(<App />);
    // Step 1: preferences only, no park cards yet.
    expect(await screen.findByRole("heading", { name: "Your preferences" }, { timeout: 3000 })).toBeTruthy();
    expect(screen.queryByRole("checkbox")).toBeNull();
    // Seasons pick 3 months; a chip goes nice -> must.
    fireEvent.click(screen.getByRole("button", { name: /Autumn/ }));
    const stars = screen.getByRole("button", { name: /^Stargazing:/ });
    fireEvent.click(stars);
    expect(stars.getAttribute("aria-label")).toContain("nice to have");
    fireEvent.click(stars);
    expect(stars.getAttribute("aria-label")).toContain("must have");
    fireEvent.click(stars);
    expect(location.search).toContain("trip=");
    await screen.findByText(/parks? fit your trip/, undefined, { timeout: 3000 });

    // Step 2: every park listed, the top 3 ticked, one card each.
    fireEvent.click(screen.getByRole("button", { name: "Show my parks" }));
    expect(location.search).toContain("step=1");
    expect(screen.queryByRole("heading", { name: "Your preferences" })).toBeNull();
    const boxes = (await screen.findAllByRole("checkbox")) as HTMLInputElement[];
    expect(boxes).toHaveLength(10); // the trip fixture's parks
    expect(boxes.filter((b) => b.checked)).toHaveLength(3);
    expect(boxes.slice(0, 3).every((b) => b.checked)).toBe(true);
    const cards = screen.getAllByRole("article");
    expect(cards).toHaveLength(3);

    // Each card shows this year and next year together, with no year toggle anywhere.
    const year = new Date().getFullYear();
    for (const c of cards) {
      expect(within(c).getByText(`${year} so far`)).toBeTruthy();
      expect(within(c).getByText(`${year + 1} trend`)).toBeTruthy();
      expect(within(c).queryByText("2050 model")).toBeNull();
    }
    expect(screen.queryByRole("group", { name: "Year" })).toBeNull();

    // Tick a fourth park, untick one from its card.
    fireEvent.click(boxes[5]);
    expect(screen.getAllByRole("article")).toHaveLength(4);
    const first = within(cards[0]).getByRole("heading", { level: 3 }).textContent!;
    fireEvent.click(screen.getByRole("button", { name: `Untick ${first}` }));
    expect(screen.getAllByRole("article")).toHaveLength(3);
    expect(boxes[0].checked).toBe(false);

    // Details opens the drawer; save from the card.
    fireEvent.click(screen.getAllByRole("button", { name: "Details" })[0]);
    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(screen.getByText(/Then, now and 2050/)).toBeTruthy();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getAllByRole("button", { name: /Want to go/ })[0]);
    expect(JSON.parse(localStorage.getItem("wishlist")!)).toHaveLength(1);

    // Back to preferences.
    fireEvent.click(screen.getByRole("button", { name: "Edit preferences" }));
    expect(await screen.findByRole("heading", { name: "Your preferences" })).toBeTruthy();
    expect(location.search).not.toContain("step=1");
  });

  it("Saved tab keeps Sequoia and Kings Canyon as two parks", async () => {
    localStorage.setItem("profile", JSON.stringify({ name: "", research: false }));
    localStorage.setItem("wishlist", JSON.stringify(["seki", "kica"]));
    history.replaceState(null, "", "#tab=saved");
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Sequoia" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Kings Canyon" })).toBeTruthy();
    expect(screen.getByText("2 parks you want to see")).toBeTruthy();
    // Each is a postcard: stamped columns, a match score row, and a link to nps.gov.
    expect(screen.getAllByText("2026 so far")).toHaveLength(2);
    expect(screen.getAllByText("2027 trend")).toHaveLength(2);
    expect(screen.getAllByText("2050 model")).toHaveLength(2);
    expect(screen.getAllByText("Match score")).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: /nps\.gov/ })[0].getAttribute("href")).toBe("https://www.nps.gov/seki/");
    fireEvent.click(screen.getByRole("button", { name: "Remove Kings Canyon" }));
    expect(JSON.parse(localStorage.getItem("wishlist")!)).toEqual(["seki"]);
  });

  it("Explorer always sees plain words: no factor scores, simple Park Explorer", async () => {
    history.replaceState(null, "", "#tab=planner&month=10&step=1");
    render(<App />);
    await screen.findAllByRole("article", undefined, { timeout: 3000 });
    expect(screen.queryAllByText(/\/100 ×/)).toHaveLength(0);
    history.pushState(null, "", "#tab=explore");
    fireEvent(window, new HashChangeEvent("hashchange"));
    expect(await screen.findByText("Pick a question", undefined, { timeout: 3000 })).toBeTruthy();
  });

  it("Clear all lists every park A to Z with no ranks, scores or ticks", async () => {
    history.replaceState(null, "", "#tab=planner&month=10");
    render(<App />);
    await screen.findByText(/parks? fit your trip/, undefined, { timeout: 3000 });
    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
    expect(await screen.findByText(/^All \d+ parks$/, undefined, { timeout: 3000 })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Show my parks" }));
    const boxes = (await screen.findAllByRole("checkbox")) as HTMLInputElement[];
    const names = boxes.map((b) => b.closest("label")!.querySelector("b")!.textContent!);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    expect(boxes.some((b) => b.checked)).toBe(false);
    expect(screen.queryByRole("img", { name: /^Score/ })).toBeNull();
    expect(screen.getByText(/Tick a park on the left/)).toBeTruthy();
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
