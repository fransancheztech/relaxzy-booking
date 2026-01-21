import { BaseServiceSchemaType } from "@/schemas/service.schema";

export default async function handleSubmitCreateService(
  data: BaseServiceSchemaType
) {
  const res = await fetch("/api/services", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error?.error ?? "Failed to create service");
  }

  return res.json();
}
