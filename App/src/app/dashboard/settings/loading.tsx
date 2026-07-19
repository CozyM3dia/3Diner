const skel = "rounded-lg dash-skel";

function Box({ h, w = "100%" }: { h: number; w?: string }) {
  return <div className={skel} style={{ height: h, width: w }} />;
}

export default function SettingsLoading() {
  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto">
      <div className="mb-5 space-y-2">
        <Box h={24} w="200px" />
        <Box h={13} w="300px" />
      </div>
      <div className="dash-panel mb-6">
        <div className="px-3.5 py-2.5" style={{ borderBottom: "1px solid var(--dash-border)" }}>
          <Box h={11} w="120px" />
        </div>
        <div className="p-4 grid grid-cols-1 lg:grid-cols-[minmax(260px,38%)_1fr] gap-5">
          <Box h={280} />
          <div className="space-y-3">
            <Box h={13} w="140px" />
            <Box h={44} />
            <div className="grid grid-cols-2 gap-2.5">
              <Box h={44} />
              <Box h={44} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4">
        <div className="space-y-4">
          <div className="dash-panel p-4 space-y-4">
            <Box h={38} />
            <Box h={38} />
            <Box h={38} />
          </div>
          <div className="dash-panel p-4 space-y-4">
            <Box h={80} />
            <Box h={80} />
          </div>
          <Box h={38} w="160px" />
        </div>
        <div className="dash-panel p-4">
          <Box h={420} />
        </div>
      </div>
    </div>
  );
}
