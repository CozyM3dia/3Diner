const skel = "rounded-lg dash-skel";

function Box({ h, w = "100%" }: { h: number; w?: string }) {
  return <div className={skel} style={{ height: h, width: w }} />;
}

export default function MenuLoading() {
  return (
    <div className="p-4 lg:p-6 max-w-[1100px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div className="space-y-2">
          <Box h={24} w="120px" />
          <Box h={13} w="140px" />
        </div>
        <div className="flex gap-2.5">
          <Box h={38} w="170px" />
          <Box h={38} w="140px" />
        </div>
      </div>
      <div className="dash-panel">
        <div className="px-3 py-2.5" style={{ borderBottom: "1px solid var(--dash-border)" }}>
          <Box h={34} w="240px" />
        </div>
        <div className="p-3 space-y-3">
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Box h={36} w="36px" />
              <div className="flex-1"><Box h={16} /></div>
              <Box h={22} w="90px" />
              <Box h={22} w="70px" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
