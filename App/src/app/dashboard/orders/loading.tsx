const skel = "rounded-lg dash-skel";

function Box({ h, w = "100%" }: { h: number; w?: string }) {
  return <div className={skel} style={{ height: h, width: w }} />;
}

export default function OrdersLoading() {
  return (
    <div className="p-4 lg:p-6 max-w-[1100px] mx-auto">
      <div className="mb-5 space-y-2">
        <Box h={24} w="120px" />
        <Box h={13} w="220px" />
      </div>
      <div className="flex gap-2 mb-4">
        {[0, 1, 2, 3].map((i) => <Box key={i} h={32} w="80px" />)}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="dash-panel p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Box h={16} w="100px" />
              <Box h={22} w="70px" />
            </div>
            <Box h={14} w="80%" />
            <Box h={14} w="60%" />
            <div className="flex items-center justify-between">
              <Box h={18} w="90px" />
              <Box h={34} w="110px" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
