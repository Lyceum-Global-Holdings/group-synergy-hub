import { preloadRoute } from "@/lib/routePreload";

/**
 * Props to spread on a <NavLink> / <Link> so the route's JS chunk starts
 * downloading the moment the user signals intent (hover, focus, touch,
 * or pointer-down). By the time the click resolves, the chunk is usually
 * cached and navigation feels instant.
 */
export function navPreloadProps(path: string) {
  const fire = () => preloadRoute(path);
  return {
    onMouseEnter: fire,
    onFocus: fire,
    onTouchStart: fire,
    onPointerDown: fire,
  };
}
