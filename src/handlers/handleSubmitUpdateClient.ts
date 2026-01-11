import { ClientUpdateSchemaType } from "@/schemas/client.schema";
import { toast } from "react-toastify";

const handleSubmitUpdateClient = async (
  data: ClientUpdateSchemaType & { id: string }
) => {
  try {
    const res = await fetch(`/api/clients/${data.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, updated_at: new Date() }),
    });

    const result = await res.json();

    if (!res.ok) {
      toast.error(result?.error || "Error updating client");
      return null;
    }

    toast.success("Client updated successfully");
    // Still not sure if we will need this
    // setTimeout(() => {
    //   window.dispatchEvent(new CustomEvent("refreshClientsData"));
    // }, 500);
    return result;
  } catch (err) {
    toast.error("Unexpected error while updating client");
    console.error(err);
    return null;
  }
};

export default handleSubmitUpdateClient;
