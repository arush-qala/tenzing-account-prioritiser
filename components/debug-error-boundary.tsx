'use client';

import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  label?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: string;
}

export class DebugErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    const stack = info.componentStack ?? '';
    // eslint-disable-next-line no-console
    console.error(
      `[DebugErrorBoundary] Error in "${this.props.label ?? 'unknown'}":`,
      error.message,
      '\nComponent stack:',
      stack,
    );
    this.setState({ errorInfo: stack });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-lg border-2 border-red-300 bg-red-50 p-4 text-sm">
          <p className="font-bold text-red-700">
            Error in: {this.props.label ?? 'unknown'}
          </p>
          <p className="mt-1 text-red-600">{this.state.error?.message}</p>
          <pre className="mt-2 max-h-40 overflow-auto text-xs text-red-500">
            {this.state.errorInfo}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}
