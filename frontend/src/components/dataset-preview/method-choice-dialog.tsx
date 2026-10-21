import { useNavigate } from "@tanstack/react-router";
import {
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  SparklesIcon,
} from "lucide-react";

import { ChoiceCard } from "./choice-card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface MethodChoiceDialogProps {
  open: boolean;
  datasetId: string;
  onOpenChange: (open: boolean) => void;
}

export function MethodChoiceDialog({
  open,
  datasetId,
  onOpenChange,
}: MethodChoiceDialogProps) {
  const navigate = useNavigate();

  const handleGeneralTransformation = () => {
    onOpenChange(false);
    void navigate({
      to: "/datasets/$datasetId/transform",
      params: { datasetId },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Choose a method</DialogTitle>
          <DialogDescription>
            Pick how you want to protect this dataset before exporting.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <ChoiceCard
            icon={SlidersHorizontalIcon}
            title="General transformation"
            hint="Redact or generalize individual columns, then export."
            onClick={handleGeneralTransformation}
          />
          <ChoiceCard
            icon={ShieldCheckIcon}
            title="K-anonymization"
            hint="Coming soon."
            disabled
          />
          <ChoiceCard
            icon={SparklesIcon}
            title="Synthetic data generation"
            hint="Coming soon."
            disabled
          />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" size="sm" variant="outline">
              Close
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
