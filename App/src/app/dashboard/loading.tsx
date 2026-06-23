const PANEL = { background: "#0D1829", border: "1px solid rgba(255,255,255,0.07)" } as const;
const skel = "rounded-lg dash-skel";

function Box({ h, w = "100%" }: { h: number; w?: string }) {
  return <div className={skel} style={{ height: h, width: w }} />;
}

export default function DashboardLoading() {
  return (
    <div className="p-5 lg:p-8 max-w-[1400px] mx-auto">
      <div className="mb-7 space-y-2">
        <Box h={26} w="180px" />
        <Box h={14} w="280px" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl p-5 space-y-3" style={PANEL}>
            <Box h={28} w="60%" />
            <Box h={13} w="80%" />
            <Box h={12} w="50%" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
        <div className="lg:col-span-2 rounded-2xl p-5 space-y-4" style={PANEL}>
          <Box h={12} w="120px" />
          <Box h={170} />
        </div>
        <div className="rounded-2xl p-5 space-y-4" style={PANEL}>
          <Box h={12} w="120px" />
          <Box h={170} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-2xl p-5 space-y-3" style={PANEL}>
          <Box h={12} w="140px" />
          {[0, 1, 2, 3].map((i) => <Box key={i} h={36} />)}
        </div>
        <div className="rounded-2xl p-5 space-y-3" style={PANEL}>
          <Box h={12} w="120px" />
          {[0, 1, 2, 3].map((i) => <Box key={i} h={20} />)}
        </div>
      </div>
    </div>
  );
}
