import { Spinner } from "./Spinner";

export function BusyOverlay({
  label,
  testId = "app-busy"
}: {
  label: string;
  testId?: string;
}) {
  return (
    <div
      className="absolute inset-0 z-[70] flex items-center justify-center bg-[#d8dee6]/70 px-4 backdrop-blur-[2px]"
      data-testid={testId}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex min-w-[12rem] flex-col items-center gap-3 rounded-xl bg-white px-6 py-5 shadow-page">
        <Spinner size={28} />
        <p className="text-center text-[13px] font-medium text-[#344054]">{label}</p>
      </div>
    </div>
  );
}
