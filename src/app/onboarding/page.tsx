"use client";

import { useRouter } from "next/navigation";
import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAppStore } from "@/store";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SvgIcon } from "@/components/SvgIcon";

const projectSchema = z.object({
  projectName: z.string().min(1, "Project name is required"),
  liveUrl: z.string().url("Must be a valid URL").or(z.literal("")),
  scopeComponents: z.boolean(),
  scopeTemplates: z.boolean(),
});

type FormData = z.infer<typeof projectSchema>;

export default function OnboardingPage() {
  const router = useRouter();
  const setProject = useAppStore((s) => s.setProject);
  const resetStore = useAppStore((s) => s.resetStore);

  // Reset state when visiting onboarding
  React.useEffect(() => {
    resetStore();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(
      projectSchema.refine(
        (data) => data.scopeComponents || data.scopeTemplates,
        { message: "Select at least one scope", path: ["scopeComponents"] }
      )
    ),
    defaultValues: {
      projectName: "",
      liveUrl: "",
      scopeComponents: false,
      scopeTemplates: false,
    },
  });

  const scopeComponents = watch("scopeComponents");
  const scopeTemplates = watch("scopeTemplates");

  const onSubmit = (data: FormData) => {
    setProject({
      projectName: data.projectName,
      liveUrl: data.liveUrl,
      scope: {
        components: data.scopeComponents,
        templates: data.scopeTemplates,
      },
      platform: "AEM",
    });
    router.push(data.scopeComponents ? "/components" : "/templates");
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-background-blue">
      {/* Left Panel */}
      <div className="flex flex-col justify-between lg:w-[624px] bg-cobalt p-8 md:p-12 lg:p-[60px] text-white">
        <div className="flex items-center gap-2">
          <SvgIcon name="feasibly-logo" width={24} height={24} className="text-red-500" />
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

      {/* Right Panel */}
      <div className="flex-1 flex items-start lg:items-center justify-center px-6 py-8 md:px-12 lg:px-16 overflow-y-auto">
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-[30px] w-full max-w-[519px]"
        >
          {/* Header */}
          <div className="flex flex-col gap-3 md:gap-[18px]">
            <p className="text-base md:text-[20px] text-cobalt tracking-[1px] uppercase">
              Let&apos;s set it up
            </p>
            <h2 className="text-3xl md:text-4xl lg:text-[50px] font-semibold text-black leading-tight">
              Create a new project
            </h2>
          </div>

          {/* Project Name */}
          <div className="flex flex-col gap-4 md:gap-5">
            <div className="flex items-start md:items-center gap-4 md:gap-5">
              <div className="flex items-center justify-center w-10 h-10 md:w-[50px] md:h-[50px] bg-sky-blue rounded-xl md:rounded-[15px] shrink-0">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2"
                >
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <div className="flex flex-col gap-1 md:gap-[10px]">
                <p className="text-base md:text-[20px] font-semibold text-black">
                  Name your project to get started*
                </p>
                <p className="text-sm md:text-[16px] text-light-grey-text">
                  Your final excel will be exported with this name
                </p>
              </div>
            </div>
            <Input
              {...register("projectName")}
              placeholder="Name your project"
              className="h-12 md:h-[60px] rounded-full px-5 md:px-[25px] text-sm md:text-[16px] border-strokes"
            />
            {errors.projectName && (
              <p className="text-destructive text-sm">
                {errors.projectName.message}
              </p>
            )}
          </div>

          {/* Live Site URL */}
          <div className="flex flex-col gap-4 md:gap-5">
            <div className="flex items-start md:items-center gap-4 md:gap-5">
              <div className="flex items-center justify-center w-10 h-10 md:w-[50px] md:h-[50px] bg-sky-blue rounded-xl md:rounded-[15px] shrink-0">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2"
                >
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
              </div>
              <div className="flex flex-col gap-1 md:gap-[10px]">
                <p className="text-base md:text-[20px] font-semibold text-black">
                  Does this project already have a live site?
                </p>
                <p className="text-sm md:text-[16px] text-light-grey-text">
                  Feasibly will use this URL to analyse the live site and select
                  the components and templates that you should be scoping for.
                </p>
              </div>
            </div>
            <Input
              {...register("liveUrl")}
              placeholder="Paste brand URL"
              className="h-12 md:h-[60px] rounded-full px-5 md:px-[25px] text-sm md:text-[16px] border-strokes"
            />
            {errors.liveUrl && (
              <p className="text-destructive text-sm">
                {errors.liveUrl.message}
              </p>
            )}
          </div>

          {/* Scope Selection */}
          <div className="flex flex-col gap-4 md:gap-5">
            <div className="flex items-start md:items-center gap-4 md:gap-5">
              <div className="flex items-center justify-center w-10 h-10 md:w-[50px] md:h-[50px] bg-sky-blue rounded-xl md:rounded-[15px] shrink-0">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M3 9h18" />
                  <path d="M3 15h18" />
                  <path d="M9 3v18" />
                </svg>
              </div>
              <div className="flex flex-col gap-1 md:gap-[10px]">
                <p className="text-base md:text-[20px] font-semibold text-black">
                  What&apos;s your scope?*
                </p>
                <p className="text-sm md:text-[16px] text-light-grey-text">
                  Select what you will be estimating:
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-3 pl-1">
              <div className="flex items-center gap-[10px]">
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
              <div className="flex items-center gap-[10px]">
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
          </div>

          {/* Platform */}
          <div className="flex flex-col gap-4 md:gap-5">
            <div className="flex items-start md:items-center gap-4 md:gap-5">
              <div className="flex items-center justify-center w-10 h-10 md:w-[50px] md:h-[50px] bg-sky-blue rounded-xl md:rounded-[15px] shrink-0">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2"
                >
                  <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
                  <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
                </svg>
              </div>
              <div className="flex flex-col gap-[10px]">
                <p className="text-base md:text-[20px] font-semibold text-black">
                  Select your platform*
                </p>
                <p className="text-sm md:text-[16px] text-light-grey-text">
                  At the moment, this scoping tool is only available for AEM.
                  However, you can still use it as a base for other platforms.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-[10px] pl-1">
              <Checkbox checked={true} disabled />
              <Label className="text-[16px] text-black font-normal">AEM</Label>
            </div>
          </div>

          {/* Submit */}
          <Button
            type="submit"
            className="h-12 md:h-[60px] rounded-full bg-cobalt hover:bg-cobalt/90 text-white text-sm md:text-[16px] w-full"
          >
            Create Project
          </Button>
        </form>
      </div>
    </div>
  );
}
