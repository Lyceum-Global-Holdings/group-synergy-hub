import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

// Top-level defensive boundary. Prevents a silent white screen when a
// render error escapes route-level boundaries (e.g. a router/basename
// mismatch or a lazy-loaded chunk failing). Purposely dependency-free
// so it renders even if design-system components are the ones failing.
export default class RootErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Keep the raw Error for stack preservation.
    console.error("[RootErrorBoundary]", error, info);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoAuth = () => {
    window.location.href = "/auth";
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1.5rem",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          background: "hsl(220 20% 97%)",
          color: "hsl(220 25% 10%)",
        }}
      >
        <div style={{ maxWidth: 480, textAlign: "center" }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: 14, opacity: 0.7, marginBottom: 20 }}>
            The page failed to load. Please reload, or return to the sign-in
            screen and try again.
          </p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <button
              type="button"
              onClick={this.handleReload}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "1px solid hsl(220 13% 91%)",
                background: "hsl(213 94% 42%)",
                color: "white",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Reload
            </button>
            <button
              type="button"
              onClick={this.handleGoAuth}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "1px solid hsl(220 13% 91%)",
                background: "white",
                color: "hsl(220 25% 10%)",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Go to sign-in
            </button>
          </div>
        </div>
      </div>
    );
  }
}
