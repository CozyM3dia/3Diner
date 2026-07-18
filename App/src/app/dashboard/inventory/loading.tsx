export default function InventoryLoading() {
  return (
    <div className="max-w-[1180px] mx-auto p-5 lg:p-8" aria-busy="true" aria-label="Memuat inventory">
      <div className="mb-7">
        <div className="dash-skel h-7 w-32 rounded-lg" />
        <div className="dash-skel mt-3 h-4 w-72 max-w-full rounded-lg" />
      </div>
      <div className="grid grid-cols-2 gap-3 mb-6 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => <div key={index} className="dash-skel h-24 rounded-2xl" />)}
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-2xl p-4" style={{ background: "#0D1829", border: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="dash-skel h-5 w-32 rounded-lg" />
          <div className="dash-skel mt-5 h-56 w-full rounded-xl" />
        </div>
        <div className="rounded-2xl p-4" style={{ background: "#0D1829", border: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="dash-skel h-5 w-36 rounded-lg" />
          <div className="dash-skel mt-5 h-56 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
