const skel = "rounded-lg dash-skel";

function Box({ h, w = "100%" }: { h: number; w?: string }) {
  return <div className={skel} style={{ height: h, width: w }} />;
}

export default function SchedulerLoading() {
  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto">
      <div className="mb-5 space-y-2">
        <Box h={24} w="180px" />
        <Box h={13} w="320px" />
      </div>
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="dash-panel p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Box h={18} w="160px" />
              <Box h={22} w="90px" />
            </div>
            <Box h={34} w="200px" />
            <Box h={34} w="70%" />
          </div>
        ))}
      </div>
    </div>
  );
}
