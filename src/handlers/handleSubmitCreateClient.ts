import { ClientUpdateSchemaType } from "@/schemas/client.schema";
import { toast } from "react-toastify";

const handleSubmitCreateClient = async (data: ClientUpdateSchemaType) => {
  try {
    const res = await fetch(`/api/clients/new`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data }),
    });

    const result = await res.json();

    if (!res.ok) {
      toast.error(result?.error || "Error creating client");
      return null;
    }

    toast.success("Client created successfully");

    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("refreshClientsData"));
    }, 500);

    return result.client; // return the newly created client if needed
  } catch (err) {
    toast.error("Unexpected error while creating client");
    console.error(err);
    return null;
  }
};

export default handleSubmitCreateClient;
