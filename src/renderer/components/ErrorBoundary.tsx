import React from "react";

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Without this, any render error left the packaged app showing a blank window
 * with no way to find out what happened.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("Studio Markdown — render error", error, info.componentStack);
  }

  private reload = () => {
    this.setState({ error: null });
    window.location.reload();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="error-boundary" role="alert">
        <h1>Studio Markdown</h1>
        <p>Wystąpił nieoczekiwany błąd interfejsu. / An unexpected interface error occurred.</p>
        <pre>{error.message}</pre>
        {error.stack && <pre className="error-stack">{error.stack}</pre>}
        <button type="button" className="primary" onClick={this.reload}>
          Przeładuj / Reload
        </button>
      </div>
    );
  }
}
