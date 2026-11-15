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

  it("student home has the twin game", async () => {
    localStorage.setItem("profile", JSON.stringify({ name: "", persona: "student" }));
    render(<App />);
    expect(await screen.findByText(/Who changes most like/, undefined, { timeout: 3000 })).toBeTruthy();
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
