import OwnerShell from "@/components/dashboard-v2/OwnerShell";

interface Props {
  title: string;
  /** Apa yang akan hidup di rute ini, dan dari mana asalnya di dashboard lama.
   *  Ditulis supaya kontrak 564 fitur bisa diadu baris per baris nanti. */
  willHold: string[];
  /** Rute lama yang masih memegang fitur ini sampai v2 menggantikannya. */
  liveAt: string;
}

/** Rute yang sudah ada di nav tapi belum dibangun.
 *
 *  Sengaja bukan halaman kosong maupun 404: nav tujuh rute adalah bagian dari
 *  bentuk yang sudah disetujui, dan menyembunyikan rute yang belum jadi membuat
 *  bentuk itu tidak bisa dinilai. Halaman ini mengatakan apa yang akan ada di
 *  sini dan ke mana harus pergi sementara ini. */
export default function RoutePlaceholder({ title, willHold, liveAt }: Props) {
  return (
    <OwnerShell title={title}>
      <div className="dv2-group">
        <div className="dv2-ghd">
          <span>Belum dibangun</span>
        </div>
        <div className="dv2-placeholder">
          <p className="dv2-state-title">Rute ini belum dipindahkan ke konsol baru</p>
          <p className="dv2-state-body">
            Sementara ini fiturnya masih hidup di <code>{liveAt}</code>, dan tidak ada yang hilang
            — dashboard lama tetap jalan sampai rute ini terbukti memuat seluruhnya.
          </p>
          <p className="dv2-state-body" style={{ marginTop: 12 }}>
            Yang akan ada di sini:
          </p>
          <ul className="dv2-list">
            {willHold.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </OwnerShell>
  );
}
