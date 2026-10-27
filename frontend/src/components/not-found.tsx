import { Link } from "@tanstack/react-router";
import { FileQuestionIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

export function NotFound({ message }: { message?: string }) {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <FileQuestionIcon className="size-6" />
      </div>
      <div className="space-y-1">
        <p className="text-xs font-medium tracking-wide text-muted-foreground">
          404
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Not found
        </h1>
      </div>
      <p className="max-w-md text-sm text-muted-foreground">
        {message ??
          "The page you're looking for doesn't exist or may have been moved."}
      </p>
      <Button asChild>
        <Link to="/upload">Back to upload</Link>
      </Button>
    </div>
  );
}

export function NotFoundPage() {
  return (
    <div className="flex h-svh flex-col">
      <NotFound />
    </div>
  );
}
