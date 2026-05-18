## Goal
Make submodule clicks from the left menu open immediately, following enterprise SPA performance standards: prefetch on user intent, avoid mounting hidden heavy modules, and keep the shell visible while content loads.

## Findings
- The active left menu is `CompanySidebar`, not the older `AppSidebar`. `AppSidebar` has preload handlers, but `CompanySidebar` links do not, so most real submodule clicks still wait for lazy JS chunks after click.
- Finance uses one large `Accounting` page that eagerly imports every finance submodule, so clicking any finance submodule loads all finance modules at once.
- Some configured routes are missing or mismatched in `routePreload` (`/finance`, several construction URLs, `finished-goods`, `nda-compliance`, child routes), so prefetch coverage is incomplete.
- Pinned submodule links also do not preload.

## Implementation Plan
1. **Wire route preloading into the real sidebar**
   - Add `preloadRoute` to `CompanySidebar`.
   - Attach `onMouseEnter`, `onFocus`, and `onTouchStart` to Dashboard, Super Admin, normal submodule links, nested child links, and pinned submodule links.
   - Add optional `onMouseDown`/pointer-down preloading so even very fast clicks start the chunk fetch before navigation.

2. **Make route preload coverage complete and maintainable**
   - Update `src/lib/routePreload.ts` to include all routes exposed by `moduleConfig` and `App.tsx`, including:
     - `/finance` and `/finance/*`
     - `/tuh-modules/finished-goods`
     - construction routes using actual paths (`project-master`, `progress-tracking`, `resource-allocation/*`, etc.)
     - social media `/social-media/nda-compliance`
     - admin/training and management dynamic dashboard routes.
   - Keep longest-prefix matching for child/detail routes.

3. **Lazy-load Finance internals**
   - Convert `src/pages/Accounting.tsx` module imports to `React.lazy`.
   - Render only the active finance tab component instead of mounting all tab contents.
   - Add a compact tab fallback so the page frame appears immediately.
   - Map finance sidebar URLs to `tab` query params where needed, or ensure `/finance/*` selects the correct tab without loading unrelated finance modules.

4. **Improve first-click behavior for high-use module groups**
   - When a sidebar department is expanded or hovered, preload the first few visible submodules in that group during idle time.
   - Keep the existing idle warm-up but align it with actual hot routes.

5. **Verify performance**
   - Use browser performance profiling after implementation to compare click-to-content and resource loading.
   - Confirm no broken route mapping and no blank content while chunks load.

## Technical Notes
- No database/RLS changes are needed.
- No new dependencies are needed.
- This keeps the current lazy-loading strategy, but applies it correctly to the sidebar users actually click and removes eager loading inside the finance route.