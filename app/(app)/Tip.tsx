export default function Tip({
  text,
  pos = "center",
}: {
  text: string;
  pos?: "center" | "right";
}) {
  return (
    <span className="tip" tabIndex={0} role="note" aria-label={text}>
      <span className="tip-ic">i</span>
      <span className={"tip-pop" + (pos === "right" ? " right" : "")}>{text}</span>
    </span>
  );
}
