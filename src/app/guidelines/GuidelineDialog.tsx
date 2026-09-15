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
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { Controller, FormProvider, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import {
  GUIDELINE_ROLES,
  GuidelineRole,
  GuidelineSchema,
  GuidelineSchemaType,
} from "@/schemas/guideline.schema";
import { useSubmitGuard } from "@/hooks/useSubmitGuard";
import Markdown from "@/components/Markdown";

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
  // Authoring aid: the same renderer the page uses, so what you preview is exactly what
  // readers get. Receptionists have not written markdown before, hence the tab rather than
  // expecting them to imagine the output.
  const [tab, setTab] = useState<"edit" | "preview">("edit");

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

  // Live value, so switching to Preview shows what is in the box right now without needing
  // a save first.
  const watchedContent = useWatch({ control: methods.control, name: "content" });

  useEffect(() => {
    if (!open) return;
    setTab("edit");
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
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
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
            <Box>
              <Tabs
                value={tab}
                onChange={(_, v) => setTab(v as "edit" | "preview")}
                sx={{ minHeight: 34, mb: 1, "& .MuiTab-root": { minHeight: 34, py: 0, fontSize: "0.8rem" } }}
              >
                <Tab value="edit" label={t("tabEdit")} />
                <Tab value="preview" label={t("tabPreview")} />
              </Tabs>

              {tab === "edit" ? (
                <>
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
                        minRows={14}
                        maxRows={26}
                        required
                        error={!!methods.formState.errors.content}
                        helperText={methods.formState.errors.content?.message}
                      />
                    )}
                  />
                  <Typography
                    variant="caption"
                    color="text.disabled"
                    sx={{ display: "block", mt: 0.75, lineHeight: 1.7 }}
                  >
                    {t("markdownHint")}
                  </Typography>
                </>
              ) : (
                <Box
                  sx={{
                    border: "1px solid", borderColor: "divider", borderRadius: 1,
                    p: 1.5, minHeight: 340, maxHeight: 560, overflowY: "auto",
                  }}
                >
                  {watchedContent?.trim() ? (
                    <Markdown>{watchedContent}</Markdown>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      {t("previewEmpty")}
                    </Typography>
                  )}
                </Box>
              )}
            </Box>
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
