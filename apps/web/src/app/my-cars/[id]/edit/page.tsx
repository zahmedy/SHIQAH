import CarDraftForm from "@/components/CarDraftForm";

export default async function EditDraftPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const carId = Number(id);

  return <CarDraftForm mode="edit" carId={Number.isFinite(carId) ? carId : undefined} />;
}
