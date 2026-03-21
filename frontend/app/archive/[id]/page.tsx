import JournalDetail from "./JournalDetail";

const MOCK_IDS = [
  "2026-03-03-1",
  "2026-03-07-1", "2026-03-07-2",
  "2026-03-10-1",
  "2026-03-14-1", "2026-03-14-2", "2026-03-14-3",
  "2026-03-18-1",
  "2026-03-21-1",
  "2026-02-10-1",
  "2026-02-14-1", "2026-02-14-2",
  "2026-02-22-1",
];

export function generateStaticParams() {
  return MOCK_IDS.map((id) => ({ id }));
}

export default function Page({ params }: { params: { id: string } }) {
  return <JournalDetail id={params.id} />;
}
