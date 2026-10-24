"use client";

import { Alert, Box, Button, Paper, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { useState } from "react";
import { useTranslations } from "next-intl";
import type { VoucherPair } from "@/lib/clients/duplicates";
import { formatBusinessDate } from "@/utils/businessTime";
import { formatMoney } from "@/utils/formatMoney";
import { fullName } from "./DuplicateGroupCard";
import ClientMergeForm, { type MergeDecision } from "./ClientMergeForm";

type Decision = "merge" | "different";

type Props = {
  pair: VoucherPair;
  busy: boolean;
  onMerge: (decision: MergeDecision) => void;
  onDismiss: () => void;
};

/**
 * A gift voucher made out to a client saved without contact details, then redeemed under another
 * record with the same name. Same person → merge (the record with the phone is kept by default);
 * different people → recorded as reviewed so the pair isn't suggested again.
 */
const VoucherPairCard = ({ pair, busy, onMerge, onDismiss }: Props) => {
  const t = useTranslations("ClientDuplicates");
  // No default decision: the same first name redeeming a voucher is strong evidence, not proof.
  const [decision, setDecision] = useState<Decision | undefined>(undefined);
  const [merge, setMerge] = useState<MergeDecision | null>(null);

  const recipientName = fullName(pair.recipient) || "—";
  const redeemerName = fullName(pair.redeemer) || "—";
  const ready = decision === "different" || (decision === "merge" && !!merge);

  return (
    <Paper variant="outlined" sx={{ p: 2, opacity: busy ? 0.6 : 1, display: "flex", flexDirection: "column", gap: 1.5 }}>
      <Box>
        {pair.uses.map((u, i) => (
          <Typography key={`${u.code}-${i}`} variant="body2">
            {t(u.buyer ? "voucherUseLineFrom" : "voucherUseLine", {
              recipient: recipientName,
              buyer: u.buyer ?? "",
              code: u.code,
              redeemer: redeemerName,
              date: formatBusinessDate(u.used_at),
              amount: formatMoney(u.amount),
            })}
          </Typography>
        ))}
      </Box>

      <ToggleButtonGroup
        size="small"
        exclusive
        value={decision ?? null}
        disabled={busy}
        onChange={(_, v: Decision | null) => { if (v) setDecision(v); }}
        sx={{ "& .MuiToggleButton-root": { py: 0.25, px: 1.25, fontSize: "0.75rem" } }}
      >
        <ToggleButton value="merge">{t("samePerson")}</ToggleButton>
        <ToggleButton value="different">{t("differentPeople")}</ToggleButton>
      </ToggleButtonGroup>

      {decision === "merge" && (
        <ClientMergeForm
          clients={[pair.redeemer, pair.recipient]}
          defaultKeeperId={pair.redeemer.id}
          busy={busy}
          onChange={setMerge}
        />
      )}

      <Box sx={{ display: "flex", alignItems: "flex-end", gap: 2, flexWrap: "wrap" }}>
        <Box sx={{ flex: 1, minWidth: 240 }}>
          {!decision ? (
            <Alert severity="warning" sx={{ py: 0 }}>{t("chooseTypoDecision")}</Alert>
          ) : decision === "different" ? (
            <Typography variant="body2" color="text.secondary">
              {t("previewDifferent", { a: recipientName, b: redeemerName })}
            </Typography>
          ) : null}
        </Box>
        <Button
          variant="contained"
          size="small"
          disabled={!ready || busy}
          onClick={() => (decision === "different" ? onDismiss() : merge && onMerge(merge))}
        >
          {t("apply")}
        </Button>
      </Box>
    </Paper>
  );
};

export default VoucherPairCard;
