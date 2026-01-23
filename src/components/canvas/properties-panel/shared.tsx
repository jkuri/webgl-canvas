import { Menu01Icon, RotateRight01Icon, ViewIcon, ViewOffSlashIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

export function SectionHeader({ title }: { title: string }) {
  return <span className="font-semibold text-[10px] text-muted-foreground uppercase tracking-wider">{title}</span>;
}

export const RotateIcon = () => <HugeiconsIcon icon={RotateRight01Icon} className="size-3.5" />;

export const WeightIcon = () => <HugeiconsIcon icon={Menu01Icon} className="size-3.5" />;

export const EyeIcon = () => <HugeiconsIcon icon={ViewIcon} className="size-4" />;

export const EyeOffIcon = () => <HugeiconsIcon icon={ViewOffSlashIcon} className="size-3.5" />;
