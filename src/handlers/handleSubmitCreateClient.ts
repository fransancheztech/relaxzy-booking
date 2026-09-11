import { ClientUpdateSchemaType } from "@/schemas/client.schema";
import { CLIENT_CONTACT_TAKEN, type CreateClientResult } from "@/types/clientConflict";
import { toast } from "react-toastify";

const handleSubmitCreateClient = async (
  data: ClientUpdateSchemaType,
): Promise<CreateClientResult> => {
  try {
    const res = await fetch(`/api/clients/new`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data }),
    });

    const result = await res.json();

    if (!res.ok) {
      // A contact collision is returned structured so the dialog can name the field and the
      // owner in the user's own language. Everything else is still a plain toast here.
      if (res.status === 409 && result?.error === CLIENT_CONTACT_TAKEN) {
        return {
          status: "contact_taken",
          field: result?.conflict?.field ?? null,
          name: result?.conflict?.name ?? null,
        };
      }
      toast.error(result?.error || "Error creating client");
      return { status: "error" };
    }

    toast.success("Client created successfully");
    return { status: "ok", client: result.client };
  } catch (err) {
    toast.error("Unexpected error while creating client");
    console.error(err);
    return { status: "error" };
  }
};

export default handleSubmitCreateClient;
