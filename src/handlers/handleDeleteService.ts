export default async function handleDeleteService(serviceId: string) {
  const res = await fetch(`/api/services/${serviceId}`, {
    method: "DELETE",
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error?.error ?? "Failed to delete service");
  }

  return res.json();
}
