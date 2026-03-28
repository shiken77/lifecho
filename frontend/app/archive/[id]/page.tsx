import JournalDetail from "./JournalDetail";

export default function Page({ params }: { params: { id: string } }) {
  return <JournalDetail id={params.id} />;
}
