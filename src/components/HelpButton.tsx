"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import {
  Box,
  Divider,
  Drawer,
  Fab,
  IconButton,
  List,
  ListItem,
  Typography,
} from "@mui/material";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import CloseIcon from "@mui/icons-material/Close";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";

interface HelpSection {
  heading: string;
  tips: string[];
}

interface HelpPage {
  title: string;
  sections: HelpSection[];
}

const HELP: Record<string, HelpPage> = {
  "/calendar": {
    title: "Calendar",
    sections: [
      {
        heading: "Creating a booking",
        tips: [
          'Click "New Booking" in the top-right corner.',
          "Fill in the client details — name, phone, and email are optional but useful.",
          "Select the service, therapist, date & time, duration, and price.",
          "Click Save to confirm. The booking appears on the calendar immediately.",
        ],
      },
      {
        heading: "Opening & editing a booking",
        tips: [
          "Click any event block on the calendar to open it.",
          "Update any field and click Save Changes.",
          "You can also change the status (e.g. mark as Completed or Cancelled).",
        ],
      },
      {
        heading: "Navigating the calendar",
        tips: [
          'Use the ← → arrows to move to the previous or next day/week/month.',
          'Click "Today" to jump back to the current date.',
          'Switch between "By therapist", "Day", "Week", and "Month" views using the buttons top-right.',
          '"By therapist" shows all therapists as side-by-side columns — useful to spot free slots.',
        ],
      },
    ],
  },

  "/bookings": {
    title: "Bookings",
    sections: [
      {
        heading: "Finding a booking",
        tips: [
          "Type a client name or phone number in the search bar to filter instantly.",
          "Click any column header to sort ascending or descending.",
          "Use the pagination arrows at the bottom to browse older bookings.",
        ],
      },
      {
        heading: "Editing a booking",
        tips: [
          "Click the pencil icon on any row to open the edit dialog.",
          "You can change the service, therapist, date/time, price, and status.",
          'To cancel a booking, change the Status field to "Cancelled" and save.',
        ],
      },
      {
        heading: "Payments",
        tips: [
          "The Paid column shows the total amount already collected.",
          'Open a booking and click "Add Payment" to record a new payment.',
          "You can split payments between cash, card, and voucher.",
        ],
      },
      {
        heading: "Tips",
        tips: [
          'Open a booking, scroll to the Tips section, and click "Add".',
          "Select the therapist, amount, and payment method.",
          "IVA is applied automatically for credit card and voucher tips.",
        ],
      },
    ],
  },

  "/clients": {
    title: "Clients",
    sections: [
      {
        heading: "Viewing a client",
        tips: [
          "Click a client row to see their full profile and booking history.",
          "The booking count shows how many times they have visited.",
        ],
      },
      {
        heading: "Adding a client",
        tips: [
          'Click "New Client" in the top-right corner.',
          "Name and phone are the most important fields — email is optional.",
        ],
      },
      {
        heading: "Finding a client",
        tips: [
          "Use the search bar to filter by name, phone, or email.",
        ],
      },
    ],
  },

  "/payments": {
    title: "Payments",
    sections: [
      {
        heading: "Reading the table",
        tips: [
          "Each row is a payment event — one booking can have several rows if paid in parts.",
          "The Method column shows how the client paid: cash, card, or voucher.",
          "Refunds appear as negative amounts.",
        ],
      },
      {
        heading: "Recording a payment",
        tips: [
          "Payments are recorded inside the booking — open the booking from Calendar or Bookings and click Add Payment.",
          "You cannot add a payment directly from this page.",
        ],
      },
    ],
  },

  "/services": {
    title: "Services",
    sections: [
      {
        heading: "What services control",
        tips: [
          "Services define what treatments you offer and their standard durations and prices.",
          "When creating a booking, selecting a service + duration will auto-fill the price.",
        ],
      },
      {
        heading: "Adding a service",
        tips: [
          'Click "New Service" and enter a name and short name.',
          "Add one or more duration/price combinations (e.g. 60 min → €65, 90 min → €80).",
        ],
      },
      {
        heading: "Editing a service",
        tips: [
          "Click the pencil icon on a service row to update its name or prices.",
          "Changes apply to new bookings only — existing bookings keep their original price.",
        ],
      },
    ],
  },

  "/therapists": {
    title: "Therapists",
    sections: [
      {
        heading: "Managing therapists",
        tips: [
          'Click "New Therapist" to add a team member.',
          "Each therapist needs a full name — phone, email, and notes are optional.",
          "Therapists appear in the booking form and in the By-therapist calendar view.",
        ],
      },
      {
        heading: "Deactivating a therapist",
        tips: [
          "Deleting a therapist removes them from future booking dropdowns.",
          "Their past bookings are not affected.",
        ],
      },
    ],
  },

  "/vouchers": {
    title: "Vouchers",
    sections: [
      {
        heading: "Creating a voucher",
        tips: [
          'Click "New Voucher" and set the initial balance and expiry date.',
          "A unique code is generated automatically.",
        ],
      },
      {
        heading: "Applying a voucher to a booking",
        tips: [
          "Open the booking, click Add Payment, and select Voucher as the payment method.",
          "Enter the voucher code — the balance is deducted automatically.",
        ],
      },
      {
        heading: "Checking a voucher balance",
        tips: [
          "Search by the voucher code or client name to find it in the table.",
          "The Balance column shows the remaining credit.",
        ],
      },
    ],
  },

  "/stats": {
    title: "Stats",
    sections: [
      {
        heading: "Changing the date range",
        tips: [
          "Use the preset buttons (This week, This month, etc.) to switch quickly.",
          'Select "Custom" to enter any start and end date.',
        ],
      },
      {
        heading: "Reading the dashboard",
        tips: [
          "The six cards at the top are the key business numbers for the selected period.",
          "Scroll down for detailed charts: revenue by payment method, bookings by service and hour, client retention, and tips.",
          "Charts update automatically when you change the date range.",
        ],
      },
    ],
  },

  "/tips": {
    title: "Tips",
    sections: [
      {
        heading: "What this page shows",
        tips: [
          "This page lists tips that have been recorded but not yet paid out to therapists.",
          "Tips are grouped by therapist and month.",
        ],
      },
      {
        heading: "Releasing a payout",
        tips: [
          'Click "Release" next to a therapist\'s pending tips to mark them as paid.',
          "The net amount (after IVA) is what the therapist receives.",
          "Once released, the tips move out of the pending list.",
        ],
      },
      {
        heading: "Recording a tip",
        tips: [
          "Tips are added inside a booking — open the booking and scroll to the Tips section.",
        ],
      },
    ],
  },
};

const FALLBACK: HelpPage = {
  title: "Help",
  sections: [
    {
      heading: "Getting started",
      tips: [
        "Use the sidebar to navigate between pages.",
        'Click "New Booking" from the Calendar or Bookings page to create a booking.',
        "Each page has its own help — navigate there and re-open this panel.",
      ],
    },
  ],
};

export default function HelpButton() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  if (pathname === "/login") return null;

  const help = HELP[pathname] ?? FALLBACK;

  return (
    <>
      <Fab
        size="small"
        onClick={() => setOpen(true)}
        sx={{
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 1300,
          bgcolor: "rgba(1,26,2,0.85)",
          color: "#fff",
          boxShadow: "0 2px 12px rgba(0,0,0,0.25)",
          "&:hover": { bgcolor: "#002d04" },
          width: 40,
          height: 40,
        }}
      >
        <HelpOutlineIcon sx={{ fontSize: 20 }} />
      </Fab>

      <Drawer anchor="right" open={open} onClose={() => setOpen(false)}>
        <Box sx={{ width: 340, display: "flex", flexDirection: "column", height: "100%" }}>
          {/* Header */}
          <Box
            sx={{
              px: 2.5,
              py: 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              bgcolor: "#011a02",
              color: "#fff",
              flexShrink: 0,
            }}
          >
            <Box>
              <Typography variant="overline" sx={{ color: "rgba(255,255,255,0.5)", fontSize: "0.65rem", lineHeight: 1 }}>
                Help
              </Typography>
              <Typography variant="h6" fontWeight={700} sx={{ lineHeight: 1.3 }}>
                {help.title}
              </Typography>
            </Box>
            <IconButton onClick={() => setOpen(false)} sx={{ color: "rgba(255,255,255,0.6)" }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>

          {/* Content */}
          <Box sx={{ flex: 1, overflowY: "auto", px: 2.5, py: 2 }}>
            {help.sections.map((section, si) => (
              <Box key={si} sx={{ mb: 3 }}>
                <Typography
                  variant="subtitle2"
                  fontWeight={700}
                  sx={{ mb: 1, color: "text.primary" }}
                >
                  {section.heading}
                </Typography>
                <List dense disablePadding>
                  {section.tips.map((tip, ti) => (
                    <ListItem key={ti} disablePadding sx={{ alignItems: "flex-start", mb: 0.75 }}>
                      <FiberManualRecordIcon
                        sx={{ fontSize: 6, mt: "7px", mr: 1, flexShrink: 0, color: "#60a561" }}
                      />
                      <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                        {tip}
                      </Typography>
                    </ListItem>
                  ))}
                </List>
                {si < help.sections.length - 1 && <Divider sx={{ mt: 2 }} />}
              </Box>
            ))}
          </Box>
        </Box>
      </Drawer>
    </>
  );
}
