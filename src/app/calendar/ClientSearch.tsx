import { ClientRow } from "@/hooks/useSimilarClients";
import { Button, Container, Typography } from "@mui/material";
import {
  FieldValues,
  UseFormSetValue,
  Path,
  PathValue,
} from "react-hook-form";

type ClientFields = {
  client_name?: string;
  client_surname?: string;
  client_email?: string;
  client_phone?: string;
};

type ClientSearchProps<T extends FieldValues & ClientFields> = {
  setValue: UseFormSetValue<T>;
  clients: ClientRow[];
  loading: boolean;
  error?: string;
};

const ClientSearch = <T extends FieldValues & ClientFields>({
  setValue,
  clients,
  loading,
  error,
}: ClientSearchProps<T>) => {
  const handlePickClient = (c: ClientRow) => {
    setValue(
      "client_name" as Path<T>,
      (c.client_name ?? "") as PathValue<T, Path<T>>
    );
    setValue(
      "client_surname" as Path<T>,
      (c.client_surname ?? "") as PathValue<T, Path<T>>
    );
    setValue(
      "client_email" as Path<T>,
      (c.client_email ?? "") as PathValue<T, Path<T>>
    );
    setValue(
      "client_phone" as Path<T>,
      (c.client_phone ?? "") as PathValue<T, Path<T>>
    );
  };

  return (
    <>
      {loading && <Typography variant="body2">Searching...</Typography>}
      {error && <Typography color="error">{error}</Typography>}
      {clients.length > 0 && (
        <Container sx={{ mt: 2 }}>
          <Typography variant="subtitle2">
            Possible existing clients:
          </Typography>
          {clients.map((c) => (
            <Button
              key={c.id}
              onClick={() => handlePickClient(c)}
              sx={{ textTransform: "none" }}
            >
              {`${c.client_name ?? ""} ${c.client_surname ?? ""}`.trim()} –{" "}
              {c.client_phone || c.client_email}
            </Button>
          ))}
        </Container>
      )}
    </>
  );
};

export default ClientSearch;
