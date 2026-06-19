export default function MenuSkeleton() {
  return (
    <div className="min-h-dvh" style={{ background: "#FDFDFD" }}>
      {/* Header skeleton */}
      <div
        className="h-52 relative overflow-hidden"
        style={{ background: "linear-gradient(160deg, #022C60 0%, #002355 100%)" }}
      >
        <div className="px-5 pt-12 pb-8 space-y-3">
          <div className="skeleton w-16 h-16 rounded-2xl" />
          <div className="skeleton h-8 w-48 rounded-xl" />
          <div className="skeleton h-4 w-32 rounded-lg" />
        </div>
      </div>

      {/* Grid skeleton */}
      <div className="px-4 pt-6">
        <div className="skeleton h-5 w-28 rounded-lg mb-4" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl overflow-hidden"
              style={{ background: "#FFFFFF", border: "1px solid #CFD9E4" }}
            >
              <div className="skeleton aspect-[4/3] w-full" style={{ borderRadius: 0 }} />
              <div className="px-3.5 py-3 space-y-2">
                <div className="skeleton h-4 w-24 rounded" />
                <div className="skeleton h-3 w-16 rounded" />
                <div className="skeleton h-5 w-20 rounded mt-2.5" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
