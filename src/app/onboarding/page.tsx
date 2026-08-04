"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAppStore } from "@/store";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SvgIcon } from "@/components/SvgIcon";
import {
  FormFieldSection,
  OutlineIcon,
} from "@/components/onboarding/FormFieldSection";
import { ROUTES, SCAN_FEATURE_ENABLED } from "@/lib/constants";
import { useScan } from "@/hooks/useScan";
import { ScanProgressOverlay } from "@/components/scan/ScanProgressOverlay";

const projectSchema = z
  .object({
    projectName: z.string().min(1, "Project name is required"),
    liveUrl: z.string().url("Must be a valid URL").or(z.literal("")),
    scopeComponents: z.boolean(),
    scopeTemplates: z.boolean(),
  })
  .refine((data) => data.scopeComponents || data.scopeTemplates, {
    message: "Select at least one scope",
    path: ["scopeComponents"],
  });

type FormData = z.infer<typeof projectSchema>;

export default function OnboardingPage() {
  const router = useRouter();
  const setProject = useAppStore((s) => s.setProject);
  const resetStore = useAppStore((s) => s.resetStore);
  const scan = useScan();
  const [overlayOpen, setOverlayOpen] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      projectName: "",
      liveUrl: "",
      scopeComponents: false,
      scopeTemplates: false,
    },
  });

  const scopeComponents = useWatch({ control, name: "scopeComponents" });
  const scopeTemplates = useWatch({ control, name: "scopeTemplates" });

  const onSubmit = async (data: FormData) => {
    resetStore();
    setProject({
      projectName: data.projectName,
      liveUrl: data.liveUrl,
      scope: {
        components: data.scopeComponents,
        templates: data.scopeTemplates,
      },
      platform: "AEM",
    });
    const nextRoute = data.scopeComponents ? ROUTES.components : ROUTES.templates;

    if (SCAN_FEATURE_ENABLED && data.liveUrl) {
      setOverlayOpen(true);
      const result = await scan.start(data.liveUrl);
      if (result) {
        setOverlayOpen(false);
        router.push(nextRoute);
      }
      // On error/cancel, keep overlay open so the user sees the message and can close it.
      return;
    }

    router.push(nextRoute);
  };

  const closeOverlay = () => {
    if (scan.isRunning) scan.cancel();
    setOverlayOpen(false);
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-background-blue">
      <div className="flex flex-col justify-between lg:w-131 bg-cobalt p-8 md:p-12 lg:p-15 text-white">
        <div className="flex items-center gap-2">
          <SvgIcon
            name="feasibly-logo"
            width={24}
            height={24}
            className="text-brand-red"
          />
          <div className="flex flex-col">
            <span className="text-2xl md:text-[31.5px] font-bold">Feasibly</span>
            <span className="text-xs text-light-white-text">a Merkle tool</span>
          </div>
        </div>
        <div className="flex flex-col gap-5 py-8 lg:py-0">
          <h1 className="text-3xl md:text-4xl lg:text-[50px] font-semibold leading-tight">
            Great projects start with great scope
          </h1>
          <p className="text-base md:text-lg lg:text-[20px] text-light-white-text">
            Build accurate design-to-code project estimates in minutes using
            structured inputs tailored for design workflows. No spreadsheets, no
            guesswork—just clear scope and confident pricing.
          </p>
        </div>
        <div className="hidden lg:block" />
      </div>

      <div className="flex-1 flex items-start lg:items-center justify-center px-6 py-8 md:px-12 lg:px-16 overflow-y-auto">
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-7.5 w-full max-w-129.75"
        >
          <div className="flex flex-col gap-3 md:gap-4.5">
            <p className="text-base md:text-[20px] text-cobalt tracking-[1px] uppercase">
              Let&apos;s set it up
            </p>
            <h2 className="text-3xl md:text-4xl lg:text-[50px] font-semibold text-black leading-tight">
              Create a new project
            </h2>
          </div>

          <FormFieldSection
            iconSlot={
              <OutlineIcon>
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </OutlineIcon>
            }
            title="Name your project to get started*"
            description="Your final excel will be exported with this name"
          >
            <Input
              {...register("projectName")}
              placeholder="Name your project"
              className="h-12 md:h-15 rounded-full px-5 md:px-6.25 text-sm md:text-[16px] border-strokes"
              aria-invalid={!!errors.projectName}
            />
            {errors.projectName && (
              <p className="text-destructive text-sm">
                {errors.projectName.message}
              </p>
            )}
          </FormFieldSection>

          <FormFieldSection
            iconSlot={
              <OutlineIcon>
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </OutlineIcon>
            }
            title="Does this project already have a live site?"
            description="Feasibly will use this URL to analyse the live site and select the components and templates that you should be scoping for."
          >
            <Input
              {...register("liveUrl")}
              placeholder="Paste brand URL"
              className="h-12 md:h-15 rounded-full px-5 md:px-6.25 text-sm md:text-[16px] border-strokes"
              aria-invalid={!!errors.liveUrl}
            />
            {errors.liveUrl && (
              <p className="text-destructive text-sm">
                {errors.liveUrl.message}
              </p>
            )}
          </FormFieldSection>

          <FormFieldSection
            iconSlot={
              <OutlineIcon>
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M3 9h18" />
                <path d="M3 15h18" />
                <path d="M9 3v18" />
              </OutlineIcon>
            }
            title="What's your scope?*"
            description="Select what you will be estimating:"
          >
            <div className="flex flex-col gap-3 pl-1">
              <div className="flex items-center gap-2.5">
                <Checkbox
                  checked={scopeComponents}
                  onCheckedChange={(checked) =>
                    setValue("scopeComponents", !!checked)
                  }
                />
                <Label className="text-[16px] text-black font-normal">
                  Components
                </Label>
              </div>
              <div className="flex items-center gap-2.5">
                <Checkbox
                  checked={scopeTemplates}
                  onCheckedChange={(checked) =>
                    setValue("scopeTemplates", !!checked)
                  }
                />
                <Label className="text-[16px] text-black font-normal">
                  Templates
                </Label>
              </div>
            </div>
            {errors.scopeComponents && (
              <p className="text-destructive text-sm">
                {errors.scopeComponents.message}
              </p>
            )}
          </FormFieldSection>

          <FormFieldSection
            iconSlot={
              <OutlineIcon>
                <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
                <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
              </OutlineIcon>
            }
            title="Select your platform*"
            description="At the moment, this scoping tool is only available for AEM. However, you can still use it as a base for other platforms."
          >
            <div className="flex items-center gap-2.5 pl-1">
              <Checkbox checked={true} disabled />
              <Label className="text-[16px] text-black font-normal">AEM</Label>
            </div>
          </FormFieldSection>

          <Button
            type="submit"
            className="h-12 md:h-15 rounded-full bg-cobalt hover:bg-cobalt/90 text-white text-sm md:text-[16px] w-full"
          >
            Create Project
          </Button>
        </form>
      </div>
      <ScanProgressOverlay open={overlayOpen} onCancel={closeOverlay} />
    </div>
  );
}
