import { useLayoutEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/**
 * Headless component: resets the main scroll container to the top
 * on PUSH/REPLACE navigations. Preserves scroll on POP (back/forward)
 * per W3C scroll restoration conventions.
 *
 * Listens to `pathname` only — query string and hash changes do not
 * reset scroll, so in-page tabs/anchors behave naturally.
 */
export default function ScrollToTop() {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();

  useLayoutEffect(() => {
    if (navigationType === "POP") return;

    const container = document.getElementById("app-scroll-container");
    if (container) {
      container.scrollTop = 0;
    } else {
      window.scrollTo(0, 0);
    }
  }, [pathname, navigationType]);

  return null;
}
