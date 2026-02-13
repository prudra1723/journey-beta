// src/features/group/components/PlanCardActions.tsx
import { Button } from "../../../components/ui/Button";

export function PlanCardActions({
  mapUrl,
  onEdit,
  onDelete,
}: {
  mapUrl?: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {mapUrl && (
        <Button
          variant="primary"
          onClick={() => window.open(mapUrl, "_blank", "noopener,noreferrer")}
        >
          Start
        </Button>
      )}
      <Button variant="ghost" onClick={onEdit}>
        Edit
      </Button>
      <Button variant="orange" onClick={onDelete}>
        Remove
      </Button>
    </div>
  );
}
