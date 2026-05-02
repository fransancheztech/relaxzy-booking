import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    primary: { main: "#002d04" },  // Dark green for accents
    secondary: { main: "#60a561" }, // Softer green for highlights
    background: { default: "#f8f8f8", paper: "#ffffff" },
  },
  typography: {
    fontFamily: ["Inter", "Roboto", "sans-serif"].join(","),
    button: { textTransform: "none", fontWeight: 600 },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 16,
          padding: "1.5rem",
          boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
          backgroundColor: "#fff",
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontWeight: 700,
          fontSize: "1.3rem",
          paddingBottom: "0.5rem",
        },
      },
    },
    MuiDialogActions: {
      styleOverrides: {
        root: {
          display: "flex",
          justifyContent: "flex-end",
          gap: "0.75rem",
          padding: "1rem 1.5rem",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: "none",
          fontWeight: 600,
          padding: "0.4rem 1.2rem",
        },
        containedPrimary: {
          backgroundColor: "#002d04",
          "&:hover": { backgroundColor: "#013307" },
        },
        containedSecondary: {
          backgroundColor: "#60a561",
          "&:hover": { backgroundColor: "#4c8f52" },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            borderRadius: 8,
          },
          "& label": {
            color: "#555",
          },
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        outlined: {
          borderRadius: 8,
        },
      },
    },
  },
});

export default theme;
