import { redirect } from 'next/navigation';
export default async function Page({ params }: { params: Promise<{ encounterId: string }> }) {
  const { encounterId } = await params;
  redirect(`/lims/verification/encounters/${encounterId}`);
}
