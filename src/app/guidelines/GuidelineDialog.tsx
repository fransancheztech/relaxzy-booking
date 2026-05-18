"use client";

import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormGroup,
  FormHelperText,
  TextField,
  Typography,
} from "@mui/material";
import { Controller, FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import {
  GUIDELINE_ROLES,
  GuidelineRole,
  GuidelineSchema,
  GuidelineSchemaType,
} from "@/schemas/guideline.schema";
import { useSubmitGuard } from "@/hooks/useSubmitGuard";

export interface GuidelineRow {
  id: string;
  title: string | null;
  content: string;
  target_roles: string[];
}

interface Props {
  open: boolean;
  guideline: GuidelineRow | null;
  onClose: () => void;
  onSaved: () => void;
}

const ROLE_LABEL_KEYS: Record<GuidelineRole, string> = {
  admin: "roleAdmin",
  receptionist: "roleReceptionist",
  therapist: "roleTherapist",
};

export default function GuidelineDialog({ open, guideline, onClose, onSaved }: Props) {
  const t = useTranslations("Guidelines");
  const tCommon = useTranslations("Common");
  const { submitting, guard } = useSubmitGuard();

  const methods = useForm<GuidelineSchemaType>({
    resolver: zodResolver(GuidelineSchema),
    defaultValues: {
      title: "",
      content: "",
      target_roles: ["receptionist", "therapist"],
    },
  });

  useEffect(() => {
    if (!open) return;
    methods.reset({
      title: guideline?.title ?? "",
      content: guideline?.content ?? "",
      target_roles: guideline?.target_roles?.length
        ? (guideline.target_roles.filter((r): r is GuidelineRole =>
            (GUIDELINE_ROLES as readonly string[]).includes(r),
          ))
        : ["receptionist", "therapist"],
    });
  }, [open, guideline]);

  const onSubmit = (data: GuidelineSchemaType) =>
    guard(async () => {
      const url = guideline ? `/api/guidelines/${guideline.id}` : "/api/guidelines";
      const method = guideline ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || t("saveError"));
        return;
      }

      toast.success(guideline ? t("updatedSuccess") : t("createdSuccess"));
      onSaved();
    });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{guideline ? t("editGuideline") : t("newGuideline")}</DialogTitle>
      <FormProvider {...methods}>
        <form onSubmit={methods.handleSubmit(onSubmit)} noValidate>
          <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "16px !important" }}>
            <Controller
              name="title"
              control={methods.control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label={t("titleOptional")}
                  size="small"
                  fullWidth
                />
              )}
            />
            <Controller
              name="content"
              control={methods.control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label={t("content")}
                  size="small"
                  fullWidth
                  multiline
                  rows={6}
                  required
                  error={!!methods.formState.errors.content}
                  helperText={methods.formState.errors.content?.message}
                />
              )}
            />
            <Controller
              name="target_roles"
              control={methods.control}
              render={({ field }) => (
                <FormControl error={!!methods.formState.errors.target_roles}>
                  <Box sx={{ display: "flex", alignItems: "baseline", gap: 1.5 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                      {t("audience")}
                    </Typography>
                    <Typography variant="caption" color="text.disabled">
                      {t("audienceHint")}
                    </Typography>
                  </Box>
                  <FormGroup row>
                    {GUIDELINE_ROLES.map((role) => (
                      <FormControlLabel
                        key={role}
                        control={
                          <Checkbox
                            size="small"
                            checked={field.value?.includes(role) ?? false}
                            onChange={(e) => {
                              const set = new Set(field.value ?? []);
                              if (e.target.checked) set.add(role);
                              else set.delete(role);
                              field.onChange(Array.from(set));
                            }}
                          />
                        }
                        label={t(ROLE_LABEL_KEYS[role] as Parameters<typeof t>[0])}
                      />
                    ))}
                  </FormGroup>
                  {methods.formState.errors.target_roles && (
                    <FormHelperText>
                      {methods.formState.errors.target_roles.message}
                    </FormHelperText>
                  )}
                </FormControl>
              )}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose} disabled={submitting}>
              {tCommon("cancel")}
            </Button>
            <Button type="submit" variant="contained" color="success" disabled={submitting}>
              {guideline ? tCommon("saveChanges") : tCommon("save")}
            </Button>
          </DialogActions>
        </form>
      </FormProvider>
    </Dialog>
  );
}
