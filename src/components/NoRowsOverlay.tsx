import { Box } from "@mui/material";

const NoRowsOverlay = ({ error }: { error: string | null }) => (
  <Box
    sx={{
      height: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: error ? "error.main" : "text.secondary",
    }}
  >
    {error ? `Error loading bookings: ${error}` : "No bookings found"}
  </Box>
);

export default NoRowsOverlay;
