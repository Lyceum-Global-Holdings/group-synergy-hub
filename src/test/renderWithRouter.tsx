import { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { render, RenderOptions } from "@testing-library/react";
import { Toaster } from "@/components/ui/toaster";

export function renderWithRouter(
  ui: ReactElement,
  { route = "/", ...options }: { route?: string } & RenderOptions = {},
) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      {ui}
      <Toaster />
    </MemoryRouter>,
    options,
  );
}
