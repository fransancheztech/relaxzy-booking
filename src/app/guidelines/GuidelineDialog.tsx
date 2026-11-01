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
import { useLocale, useTranslations } from "next-intl";
import { toast } from "react-toastify";
import {
  GUIDELINE_ROLES,
  GuidelineRole,
  GuidelineSchema,
  GuidelineSchemaType,
} from "@/schemas/guideline.schema";
import { useSubmitGuard } from "@/hooks/useSubmitGuard";
import Markdown from "@/components/Markdown";
import {
  GUIDELINE_LANGUAGES,
  GUIDELINE_LANGUAGE_NATIVE,
  GuidelineLanguage,
  GuidelineTranslation,
  isGuidelineLanguage,
} from "@/lib/guidelines/languages";

export interface GuidelineRow {
  id: string;
  target_roles: string[];
  translations: GuidelineTranslation[];
}

const EMPTY_TRANSLATIONS = { es: { title: "", content: "" }, en: { title: "", content: "" }, th: { title: "", content: "" } };

interface Props {
  open: boolean;
  guideline: GuidelineRow | null;
  /** The language tab to open on: the version being read, when editing. */
  initialLanguage?: GuidelineLanguage;
  onClose: () => void;
  /** Receives the saved guideline (its id at least), so the page can open a new one. */
  onSaved: (saved: { id: string } | null) => void;
}

const ROLE_LABEL_KEYS: Record<GuidelineRole, string> = {
  admin: "roleAdmin",
  receptionist: "roleReceptionist",
  therapist: "roleTherapist",
};

export default function GuidelineDialog({ open, guideline, initialLanguage, onClose, onSaved }: Props) {
  // Authoring aid: the same renderer the page uses, so what you preview is exactly what
  // readers get. Receptionists have not written markdown before, hence the tab rather than
  // expecting them to imagine the output.
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  // One guideline holds every language version; the tabs pick which one is being written.
  const appLocale = useLocale();
  const [lang, setLang] = useState<GuidelineLanguage>("es");

  const t = useTranslations("Guidelines");
  const tCommon = useTranslations("Common");
  const { submitting, guard } = useSubmitGuard();

  const methods = useForm<GuidelineSchemaType>({
    resolver: zodResolver(GuidelineSchema),
    defaultValues: {
      translations: EMPTY_TRANSLATIONS,
      target_roles: ["receptionist", "therapist"],
    },
  });

  // Live values, so switching to Preview shows what is in the box right now without needing
  // a save first, and the tabs can mark the languages that have text.
  const watchedTranslations = useWatch({ control: methods.control, name: "translations" });
  const watchedContent = watchedTranslations?.[lang]?.content ?? "";
  const errors = methods.formState.errors;

  useEffect(() => {
    if (!open) return;
    setTab("edit");
    // Editing opens on the version being read; a new guideline on the app's language.
    setLang(initialLanguage ?? (isGuidelineLanguage(appLocale) ? appLocale : "es"));
    const translations = structuredClone(EMPTY_TRANSLATIONS);
    for (const tr of guideline?.translations ?? []) {
      translations[tr.language] = { title: tr.title ?? "", content: tr.content };
    }
    methods.reset({
      translations,
      target_roles: guideline?.target_roles?.length
        ? (guideline.target_roles.filter((r): r is GuidelineRole =>
            (GUIDELINE_ROLES as readonly string[]).includes(r),
          ))
        : ["receptionist", "therapist"],
    });
  }, [open, guideline, initialLanguage, appLocale]);

  // On a failed save, show the language tab that has the problem.
  const onInvalid = (errs: typeof errors) => {
    const withError = GUIDELINE_LANGUAGES.find((l) => errs.translations?.[l]);
    if (withError) setLang(withError);
  };

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

      const saved = await res.json().catch(() => ({}));
      toast.success(guideline ? t("updatedSuccess") : t("createdSuccess"));
      onSaved(saved.guideline ?? null);
    });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{guideline ? t("editGuideline") : t("newGuideline")}</DialogTitle>
      <FormProvider {...methods}>
        <form onSubmit={methods.handleSubmit(onSubmit, onInvalid)} noValidate>
          <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "8px !important" }}>
            <Box>
              <Tabs
                value={lang}
                onChange={(_, v) => setLang(v as GuidelineLanguage)}
                sx={{ borderBottom: 1, borderColor: "divider" }}
              >
                {GUIDELINE_LANGUAGES.map((l) => (
                  <Tab
                    key={l}
                    value={l}
                    label={
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                        {GUIDELINE_LANGUAGE_NATIVE[l]}
                        {/* Dot: this language has text and will be saved (red: it has a problem). */}
                        <Box
                          component="span"
                          sx={{
                            width: 7,
                            height: 7,
                            borderRadius: "50%",
                            bgcolor: errors.translations?.[l] ? "error.main" : "success.main",
                            visibility:
                              watchedTranslations?.[l]?.content?.trim() || errors.translations?.[l]
                                ? "visible"
                                : "hidden",
                          }}
                        />
                      </Box>
                    }
                  />
                ))}
              </Tabs>
              <Typography
                variant="caption"
                color={errors.translations?.message ? "error" : "text.disabled"}
                sx={{ display: "block", mt: 0.75 }}
              >
                {errors.translations?.message ?? t("languagesHint")}
              </Typography>
            </Box>
            <Controller
              key={`title-${lang}`}
              name={`translations.${lang}.title`}
              control={methods.control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ""}
                  label={t("titleOptional")}
                  size="small"
                  fullWidth
                  inputProps={{ lang }}
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
                    key={`content-${lang}`}
                    name={`translations.${lang}.content`}
                    control={methods.control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        value={field.value ?? ""}
                        label={t("content")}
                        size="small"
                        fullWidth
                        multiline
                        minRows={14}
                        maxRows={26}
                        inputProps={{ lang }}
                        error={!!errors.translations?.[lang]?.content}
                        helperText={errors.translations?.[lang]?.content?.message}
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
                  {watchedContent.trim() ? (
                    <Box lang={lang}>
                      <Markdown>{watchedContent}</Markdown>
                    </Box>
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
