// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Home from "../Home";
import { installFakeApi, installStorage } from "../test/fakeApi";

installStorage();

beforeEach(() => {
  localStorage.clear();
  installFakeApi();
});
afterEach(cleanup);

describe("Home", () => {
  it("renders the name and the tagline", () => {
    render(<Home name="Sam" research={false} atlas={null} onGo={() => undefined} />);
    expect(screen.getByText("Welcome, Sam")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Go when the park is at its best.");
  });

  it("next case opens that case at step 0", () => {
    const onGo = vi.fn();
    render(<Home name="Sam" research={false} atlas={null} onGo={onGo} />);
    expect(screen.getByRole("heading", { name: "Play today" })).toBeTruthy();
    fireEvent.click(screen.getByText("Next mystery").closest("button")!);
    expect(onGo).toHaveBeenCalledWith("student", expect.objectContaining({ step: 0, caseId: expect.any(String) }));
  });

  it("has no month picker (Plan a trip covers it)", () => {
    render(<Home name="Sam" research={false} atlas={null} onGo={() => undefined} />);
    expect(screen.queryByRole("button", { name: "Jun" })).toBeNull();
  });

  it("CTA opens the planner", () => {
    const onGo = vi.fn();
    render(<Home name="Sam" research={false} atlas={null} onGo={onGo} />);
    fireEvent.click(screen.getByRole("button", { name: "Plan a trip" }));
    expect(onGo).toHaveBeenCalledWith("planner");
  });

  it("shows the research card only when research is on", () => {
    const onGo = vi.fn();
    const { rerender } = render(<Home name="Sam" research={false} atlas={null} onGo={onGo} />);
    expect(screen.queryByText("Research")).toBeNull();
    rerender(<Home name="Sam" research atlas={null} onGo={onGo} />);
    fireEvent.click(screen.getByText("Research").closest("button")!);
    expect(onGo).toHaveBeenCalledWith("atlas");
  });

  it("lists three real park picks for this month", async () => {
    render(<Home name="Sam" research={false} atlas={null} onGo={() => undefined} />);
    await waitFor(() => expect(screen.getAllByText(/Score \d+ of 100/).length).toBe(3));
  });

  it("hides the picks when the fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("down"))));
    render(<Home name="Sam" research={false} atlas={null} onGo={() => undefined} />);
    await waitFor(() => expect(screen.queryByLabelText("Right now")).toBeNull());
  });
});
