import React, { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#080C0A] flex flex-col items-center justify-center text-white px-4">
          <div className="flex flex-col items-center max-w-md w-full space-y-8">
            {/* Logo */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-3xl font-black tracking-tighter text-[#1A7A4A]">TIXORA</span>
            </div>

            <div className="text-center space-y-4">
              <h1 className="text-3xl font-bold">Something went wrong</h1>
              <p className="text-white/60">
                We hit an unexpected error. Try refreshing the page.
              </p>
            </div>

            <div className="flex flex-col w-full gap-4 pt-4">
              <Button 
                onClick={() => window.location.reload()}
                className="bg-[#1A7A4A] hover:bg-[#1A7A4A]/90 text-white h-12 rounded-xl font-bold text-lg"
              >
                Refresh Page
              </Button>
              <Button 
                variant="outline" 
                asChild
                className="border-white/10 text-white/60 hover:text-white hover:bg-white/5 h-12 rounded-xl font-bold"
              >
                <Link to="/">Go Home</Link>
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.children;
  }
}

export default ErrorBoundary;
