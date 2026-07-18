const skel = "rounded-lg dash-skel";

function Box({ h, w = "100%" }: { h: number; w?: string }) {
  return <div className={skel} style={{ height: h, width: w }} />;
}

export default function AnnouncementsLoading() {
  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto">
      <div className="mb-5 space-y-2">
        <Box h={24} w="170px" />
        <Box h={13} w="300px" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4">
        <div className="dash-panel p-4 space-y-4">
          <Box h={38} />
          <Box h={90} />
          <Box h={38} w="60%" />
          <Box h={38} w="140px" />
        </div>
        <div className="dash-panel p-4">
          <Box h={420} />
        </div>
      </div>
    </div>
  );
}
