export default function Placeholder({
  title,
  note,
}: {
  title: string;
  note?: string;
}) {
  return (
    <div className="ph">
      <h1>{title}</h1>
      <p>{note ?? "Skeleton page — wired up, ready to build out next."}</p>
      <div className="ph-box">“{title}” content goes here</div>
    </div>
  );
}
