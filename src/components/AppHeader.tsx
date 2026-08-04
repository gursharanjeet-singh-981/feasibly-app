"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppStore } from "@/store";
import { Input } from "@/components/ui/input";
import { SvgIcon } from "@/components/SvgIcon";
import { ROUTES } from "@/lib/constants";

const allTabs = [
  { label: "Components", href: ROUTES.components, icon: "components", scope: "components" as const },
  { label: "Templates", href: ROUTES.templates, icon: "file-copy", scope: "templates" as const },
  { label: "Global Principles", href: ROUTES.globalPrinciples, icon: "flag", scope: null },
];

export function AppHeader() {
  const pathname = usePathname();
  const project = useAppStore((s) => s.project);
  const setProject = useAppStore((s) => s.setProject);

  const tabs = allTabs.filter(
    (tab) => tab.scope === null || project.scope[tab.scope]
  );

  return (
    <header className="flex flex-wrap items-start gap-4 lg:gap-6 px-4 md:px-8 lg:px-15 pt-6 lg:pt-15 pb-4">
      {/* Feasibly Logo — top-aligned, separate from header content */}
      <Link href={ROUTES.home} className="flex items-center gap-2 shrink-0">
        <SvgIcon name="feasibly-logo" width={24} height={24} className="text-brand-red" />
        <div className="flex flex-col">
          <span className="text-base font-bold text-brand-navy leading-tight">Feasibly</span>
          <span className="text-[9px] text-light-grey-text leading-tight opacity-50">a Merkle tool</span>
        </div>
      </Link>

      {/* Header Content: Project info + Tabs — bottom-aligned with each other */}
      <div className="flex flex-wrap gap-4 lg:items-end lg:justify-between flex-1 min-w-0">
        {/* Left: Project icon/text + Input */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-5">
            <div className="flex items-center justify-center w-7.5 h-7.5 bg-sky-blue rounded-[9px] shrink-0">
              <SvgIcon name="folder-shared" width={12} height={12} className="text-white" />
            </div>
            <p className="text-xl font-semibold text-black">Project</p>
          </div>
          <Input
            value={project.projectName}
            onChange={(e) => setProject({ ...project, projectName: e.target.value })}
            className="h-12 lg:h-15 rounded-full px-6 text-base border-strokes w-full lg:w-61.25 bg-white"
          />
        </div>

        {/* Right: Tabs */}
        <div className="flex gap-5 bg-white border border-strokes rounded-[1000px] p-3 overflow-x-auto">
          {tabs.map((tab) => {
            const isActive = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex items-center gap-1.25 p-3 rounded-full text-sm whitespace-nowrap transition-colors ${
                  isActive
                    ? "bg-background-blue border border-cobalt text-black font-medium"
                    : "text-light-grey-text hover:bg-gray-50"
                }`}
              >
                <SvgIcon name={tab.icon} width={24} height={24} className={isActive ? "text-cobalt" : "text-current opacity-54"} />
                <span className="hidden sm:inline">{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </header>
  );
}
