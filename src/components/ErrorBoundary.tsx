import React from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';
import { Button } from '../design-system/ui';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; onReset?: () => void },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode; onReset?: () => void }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'An unexpected workspace rendering error occurred.',
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="h-full w-full flex items-center justify-center bg-[#F7F5FF] p-6"
        >
          <div className="max-w-md w-full bg-white border border-[#E4DFF7] rounded-xl p-6 space-y-4 shadow-sm">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-[#DC2626] shrink-0 mt-0.5" />
              <div>
                <h2 className="text-sm font-bold text-[#141226]">Workspace Recovery</h2>
                <p className="text-xs text-[#5B587A] mt-1 leading-relaxed">
                  {this.state.message}
                </p>
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  this.setState({ hasError: false, message: '' });
                  this.props.onReset?.();
                }}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reload Workspace
              </Button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
