import { BaseServiceSchemaType } from "@/schemas/service.schema";
import { toast } from "react-toastify";

export default async function handleSubmitCreateService(
  data: BaseServiceSchemaType,
) {
  try {
    const res = await fetch("/api/services", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) {
      toast.error(result?.error || "Error creating the service");
      throw new Error(result?.error ?? "Failed to create service");
    }
    toast.success("Service created successfully.");
    return result;
  } catch (error) {
    toast.error(`Unexpected error while creating service: ${error}`);
    return false;
  }
}
