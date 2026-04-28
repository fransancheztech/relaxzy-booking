import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { redirect } from "next/navigation";
import { Box, Card, CardContent, Typography } from "@mui/material";
import ConstructionIcon from "@mui/icons-material/Construction";

const StatsPage = async () => {
  const role = await getCurrentUserRole();
  if (role !== "admin") redirect("/");

  return (
    <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
      <Card elevation={3} sx={{ maxWidth: 400, textAlign: "center", p: 3 }}>
        <CardContent>
          <ConstructionIcon sx={{ fontSize: 64, color: "text.secondary", mb: 2 }} />
          <Typography variant="h5" fontWeight="bold" gutterBottom>
            Coming Soon
          </Typography>
          <Typography variant="body1" color="text.secondary">
            The Stats page is under construction. Check back later.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default StatsPage;
