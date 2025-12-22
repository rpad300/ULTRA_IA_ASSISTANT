import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "./button";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./card";

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    private handleReset = () => {
        this.setState({ hasError: false, error: null });
    };

    public render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="flex items-center justify-center min-h-[400px] p-8">
                    <Card className="max-w-md">
                        <CardHeader>
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-red-500/10 flex items-center justify-center">
                                    <AlertCircle className="h-5 w-5 text-red-500" />
                                </div>
                                <div>
                                    <CardTitle>Something went wrong</CardTitle>
                                    <CardDescription>
                                        An unexpected error occurred
                                    </CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {this.state.error && (
                                <div className="p-3 rounded-lg bg-muted text-sm font-mono text-muted-foreground">
                                    {this.state.error.message}
                                </div>
                            )}
                            <Button onClick={this.handleReset} className="w-full">
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Try again
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            );
        }

        return this.props.children;
    }
}

