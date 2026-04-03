

## Fix: Missing `build:dev` Script

### Problem
The `package.json` is missing the `"build:dev"` script that the build system expects. The current scripts section only has `dev`, `build`, and `preview`.

### Fix
Add the `build:dev` script to `package.json`:

```json
"scripts": {
  "dev": "vite --port 8080",
  "build": "vite build",
  "build:dev": "vite build --mode development",
  "preview": "vite preview"
}
```

### Files to Edit
- `package.json` — add `"build:dev": "vite build --mode development"` to the scripts block (line 7)

