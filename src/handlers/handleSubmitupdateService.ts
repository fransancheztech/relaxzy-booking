import { BaseServiceSchemaType } from "@/schemas/service.schema";
import { toast } from "react-toastify";

const handleSubmitUpdateService = async (
  data: BaseServiceSchemaType & { id: string }
) => {
  try {
    const res = await fetch(`/api/services/${data.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const result = await res.json();

    if (!res.ok) {
      toast.error(result?.error || "Error updating service");
      return null;
    }

    toast.success("Service updated successfully");
    // Still not sure if we will need this
    // setTimeout(() => {
    //   window.dispatchEvent(new CustomEvent("refreshServicesData"));
    // }, 500);
    return result;
  } catch (err) {
    toast.error("Unexpected error while updating service");
    console.error(err);
    return null;
  }
};

export default handleSubmitUpdateService;
