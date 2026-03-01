import { redirect } from 'next/navigation';

export default function QrRedirect({
  params,
  searchParams,
}: {
  params: { tenantSlug: string };
  searchParams: { location?: string };
}) {
  const url = searchParams.location
    ? `/marketplace/${params.tenantSlug}?location=${searchParams.location}`
    : `/marketplace/${params.tenantSlug}`;
  redirect(url);
}
