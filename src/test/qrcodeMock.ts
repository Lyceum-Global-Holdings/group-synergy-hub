import { vi } from "vitest";

vi.mock("qrcode", () => ({
  default: { toDataURL: vi.fn(async () => "data:image/png;base64,MOCK") },
  toDataURL: vi.fn(async () => "data:image/png;base64,MOCK"),
}));
