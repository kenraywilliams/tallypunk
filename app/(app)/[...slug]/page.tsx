import Placeholder from "../Placeholder";

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const raw = slug?.[0] ?? "Page";
  const title = raw.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return <Placeholder title={title} />;
}
