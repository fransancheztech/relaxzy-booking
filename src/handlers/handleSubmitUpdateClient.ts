import { ClientUpdateSchemaType } from "@/schemas/client.schema";
import { toast } from "react-toastify";
import { CLIENT_CONTACT_TAKEN, type ClientUpdateResult } from "@/types/clientConflict";

const handleSubmitUpdateClient = async (
  data: ClientUpdateSchemaType & { id: string }
): Promise<ClientUpdateResult> => {
  try {
    const res = await fetch(`/api/clients/${data.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, updated_at: new Date() }),
    });

    const result = await res.json();

    if (!res.ok) {
      // Contact collision is handled by the caller (translated, names the other client).
      if (res.status === 409 && result?.error === CLIENT_CONTACT_TAKEN) {
        return { status: "contact_taken", name: result?.conflict?.name, field: result?.conflict?.field };
      }
      toast.error(result?.error || "Error updating client");
      return { status: "error" };
    }

    toast.success("Client updated successfully");
    return { status: "ok" };
  } catch (err) {
    toast.error("Unexpected error while updating client");
    console.error(err);
    return { status: "error" };
  }
};

export default handleSubmitUpdateClient;
