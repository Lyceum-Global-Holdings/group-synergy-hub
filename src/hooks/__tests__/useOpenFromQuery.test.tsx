import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { useOpenFromQuery } from "../useOpenFromQuery";

function Probe({ onOpen, onRequest, seen }: { onOpen: () => void; onRequest: () => void; seen: (s: string) => void }) {
  useOpenFromQuery("new", { "1": onOpen, request: onRequest });
  seen(useLocation().search);
  return null;
}

function renderAt(url: string) {
  const onOpen = vi.fn();
  const onRequest = vi.fn();
  const searches: string[] = [];
  render(
    <MemoryRouter initialEntries={[url]}>
      <Probe onOpen={onOpen} onRequest={onRequest} seen={(s) => searches.push(s)} />
    </MemoryRouter>,
  );
  return { onOpen, onRequest, lastSearch: searches.at(-1) };
}

describe("useOpenFromQuery", () => {
  it("opens the matching dialog once and strips the parameter", () => {
    const { onOpen, onRequest, lastSearch } = renderAt("/procurement/purchase-order?new=1&tab=open");
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onRequest).not.toHaveBeenCalled();
    expect(lastSearch).toBe("?tab=open");
  });

  it("routes named values to their opener", () => {
    const { onOpen, onRequest } = renderAt("/warehouse/material-issue?new=request");
    expect(onRequest).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("ignores unknown values and pages without the parameter", () => {
    expect(renderAt("/warehouse/grn?new=bogus").onOpen).not.toHaveBeenCalled();
    expect(renderAt("/warehouse/grn").onOpen).not.toHaveBeenCalled();
  });
});
