import { toast } from "react-toastify";

export default async function handleDeleteService(serviceId: string) {
  try {
    if (!serviceId) {
      toast.error("Missing service ID");
      return;
    }

    const res = await fetch(`/api/services/${serviceId}`, {
      method: "DELETE",
    });

    const result = await res.json();

    if (!res.ok) {
      console.error("Service delete error:", result);
      toast.error(result?.error || "Error deleting service");
      return;
    }

    toast.success("Service deleted successfully.");
  } catch (err) {
    console.error("Network or server error deleting service", err);
    toast.error("Network or server error");
  }
}
