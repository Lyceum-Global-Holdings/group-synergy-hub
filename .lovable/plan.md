# Upload progress + retry/error handling for supplier form file uploads

## Scope

Frontend-only enhancement to `FileUploadField` in `src/components/sourcing/registration/DynamicSupplierForm.tsx`. No edge function or schema changes — the existing `supplier-upload-sign` flow already returns a signed PUT URL that supports `XMLHttpRequest` upload progress events.

## Changes

### 1. Per-file upload state

Replace the single boolean `uploading` flag with a `Map<id, UploadTask>` (kept in component state):

```ts
type UploadStatus = "queued" | "signing" | "uploading" | "success" | "error" | "canceled";
type UploadTask = {
  id: string;            // local uuid
  file: File;
  progress: number;      // 0–100
  status: UploadStatus;
  error?: string;
  attempt: number;       // 1-based
  xhr?: XMLHttpRequest;  // for cancel
};
```

This lets the UI show one row per in-flight file with its own progress bar, status, and action buttons.

### 2. Switch from `fetch` to `XMLHttpRequest` for the PUT

`fetch` has no upload progress in browsers. Use `xhr.upload.onprogress` to drive a real percentage. Wrap in a small promise helper:

```ts
function putWithProgress(url, file, onProgress, signal): Promise<{ ok: boolean; status: number }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status });
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.ontimeout = () => reject(new Error("Upload timed out"));
    xhr.timeout = 5 * 60 * 1000; // 5 min ceiling per file
    signal?.addEventListener("abort", () => xhr.abort());
    xhr.send(file);
    return xhr;
  });
}
```

### 3. Retry with exponential backoff

- Auto-retry on transient failures (network error, timeout, HTTP 408/429/5xx) up to **3 attempts total** with backoff `500ms → 1.5s → 4s` plus small jitter.
- Do NOT retry on 4xx other than 408/429 (those are signing/permission/MIME/size problems — surface and stop).
- Each retry re-calls `supplier-upload-sign` to get a fresh signed URL (signed URLs are short-lived).
- Track `attempt` so the UI can show "Retrying… (2/3)".

### 4. UI per file row

Replace the single dashed dropzone "Uploading…" label with a list that, while in flight, shows for each task:

- File name + size
- A `<Progress />` bar (shadcn) bound to `task.progress`
- Status text: `Signing…` / `Uploading 42%` / `Retrying (2/3)…` / `Failed: <reason>` / `Done`
- **Cancel** button (X) while `uploading` → calls `xhr.abort()`, marks `canceled`
- **Retry** button when `status === "error"` → resets `attempt = 1`, restarts the pipeline for that file only
- **Remove** button on completed files (keeps existing remove behavior)

The dashed dropzone label stays, but its disabled state is driven by `items.length + activeUploads >= maxFiles` instead of the old global `uploading` flag — so users can keep queueing within the cap.

### 5. Drag-and-drop (small UX add)

Add `onDragOver` / `onDrop` handlers to the dashed label so users can drop files. Same `handleFiles(...)` path. Honors the same accept / size / count guards.

### 6. Aggregate behavior

- The form-level `onChange(...)` for the field is only called when a task reaches `success` (so partially failed batches still commit the successes).
- A submit-time guard already exists via react-hook-form `required`. Add a soft block: while any task is `uploading` / `signing` / `queued`, disable the form's submit button. Achieved via a `useUploadGuard()`-style ref counter exposed through props (or by lifting "are any uploads in flight?" into the parent via a callback prop on `FileUploadField`).
  - Minimal version: add `onActiveChange?: (active: boolean) => void` to `FileUploadField` and let the parent (`DynamicSupplierForm`) aggregate across fields and disable submit while any are active.

### 7. Validation + error messages

Keep existing client-side checks (MIME whitelist, max size, max count) but display them inline inside the failed row (red text + Retry hidden for permanent errors) instead of toast-only. Toasts remain for completion summary ("3 of 4 files uploaded — 1 failed").

### 8. Cleanup

- On component unmount, abort all in-flight `xhr`s.
- On successful upload of all queued files, prune `success` rows from the in-flight list after a short delay (they're already rendered as committed items below).

## Out of scope

- No edge function changes (`supplier-upload-sign` and `public-supplier-registration` stay as-is).
- No storage policy changes.
- No virus scanning, chunked/resumable uploads, or background-resume across page reloads. (Multipart/TUS would be a separate, larger change — happy to follow up if you want it.)
- No changes to other file-upload surfaces in the app (warehouse, contracts, GRN, etc.).

## Verification

1. Upload a 5–10 MB PDF on a throttled "Slow 3G" profile → progress bar advances smoothly 0→100%, then row turns green "Done".
2. Mid-upload, click Cancel → request aborts, row shows "Canceled" with Retry button; clicking Retry re-signs and restarts.
3. Toggle DevTools "Offline" briefly during upload → row shows "Retrying (2/3)…" with backoff, then succeeds when back online; if 3 attempts fail it stops on "Failed: Network error" with Retry available.
4. Try a 20 MB file or `.exe` → rejected client-side with inline error, no network call.
5. Queue 3 files at once → 3 independent rows with independent progress; submit button stays disabled until all settle.
