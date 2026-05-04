import "@testing-library/jest-dom";
import { vi, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => cleanup());

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }),
});

Object.defineProperty(window.URL, "createObjectURL", { value: vi.fn(() => "blob:mock"), configurable: true });
Object.defineProperty(window.URL, "revokeObjectURL", { value: vi.fn(), configurable: true });
Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", { value: vi.fn(), configurable: true });

Object.defineProperty(navigator, "clipboard", {
  value: { writeText: vi.fn(async () => {}), readText: vi.fn(async () => "") },
  configurable: true,
});
