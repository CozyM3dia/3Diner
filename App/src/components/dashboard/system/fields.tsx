/** Pola field form dashboard — label uppercase kecil + hint, konsisten
 *  dengan bahasa SettingsForm/MenuForm existing. */
export function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5"
        style={{ color: "var(--dash-muted)" }}
      >
        {label}
      </label>
      {children}
      {hint && (
        <p className="text-[11px] mt-1.5" style={{ color: "var(--dash-muted)" }}>
          {hint}
        </p>
      )}
    </div>
  );
}

export const dashInputClass = "dash-input w-full px-3.5 py-2.5 rounded-xl text-sm outline-none";
export const dashInputStyle: React.CSSProperties = {
  background: "var(--dash-raised)",
  border: "1px solid rgba(255,255,255,0.1)",
  color: "var(--dash-text)",
};
