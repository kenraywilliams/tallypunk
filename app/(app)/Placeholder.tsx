export default function Placeholder({
  title,
  note,
}: {
  title: string;
  note?: string;
}) {
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{title}</h1>
          <p className="page-sub">
            {note ?? "Skeleton page — wired up, ready to build out next."}
          </p>
        </div>
      </div>
      <div className="ph-box">“{title}” content goes here</div>
    </div>
  );
}
