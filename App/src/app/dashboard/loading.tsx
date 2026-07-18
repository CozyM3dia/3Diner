const skel = "rounded-lg dash-skel";

function Box({ h, w = "100%" }: { h: number; w?: string }) {
  return <div className={skel} style={{ height: h, width: w }} />;
}

export default function DashboardLoading() {
  return (
    <div className="p-4 lg:p-6 max-w-[1400px] mx-auto">
      <div className="mb-5 flex items-end justify-between gap-3">
        <div className="space-y-2">
          <Box h={12} w="200px" />
          <Box h={24} w="260px" />
        </div>
        <div className="hidden sm:flex gap-2.5">
          <Box h={38} w="140px" />
          <Box h={38} w="150px" />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-4">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="dash-panel p-4 space-y-3">
            <Box h={13} w="80%" />
            <Box h={26} w="60%" />
            <Box h={12} w="50%" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4">
        <div className="lg:col-span-2 dash-panel">
          <div className="dash-panel-head"><Box h={11} w="120px" /></div>
          <div className="dash-panel-body"><Box h={170} /></div>
        </div>
        <div className="dash-panel">
          <div className="dash-panel-head"><Box h={11} w="130px" /></div>
          <div className="dash-panel-body"><Box h={170} /></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2 dash-panel">
          <div className="dash-panel-head"><Box h={11} w="140px" /></div>
          <div className="dash-panel-body space-y-3">
            {[0, 1, 2, 3].map((i) => <Box key={i} h={36} />)}
          </div>
        </div>
        <div className="dash-panel">
          <div className="dash-panel-head"><Box h={11} w="120px" /></div>
          <div className="dash-panel-body space-y-3">
            {[0, 1, 2, 3].map((i) => <Box key={i} h={20} />)}
          </div>
        </div>
      </div>
    </div>
  );
}
