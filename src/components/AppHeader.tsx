"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppStore } from "@/store";
import { Input } from "@/components/ui/input";
import { SvgIcon } from "@/components/SvgIcon";

const tabs = [
  { label: "Components", href: "/components", icon: "components" },
  { label: "Templates", href: "/templates", icon: "file-copy" },
  { label: "Global Principles", href: "/global-principles", icon: "flag" },
];

export function AppHeader() {
  const pathname = usePathname();
  const project = useAppStore((s) => s.project);
  const setProject = useAppStore((s) => s.setProject);

  return (
    <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between px-4 md:px-8 lg:px-[60px] pt-6 lg:pt-[60px] pb-4">
      {/* Left: Logo + Project Name */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center gap-5">
          {/* Feasibly Logo */}
          <div className="flex items-center gap-2">
            <SvgIcon name="feasibly-logo" width={24} height={24} className="text-[#F1012F]" />
            <div className="flex flex-col">
              <span className="text-base font-bold text-[#020E4E] leading-tight">Feasibly</span>
              <span className="text-[9px] text-light-grey-text leading-tight opacity-50">a Merkle tool</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-[30px] h-[30px] bg-sky-blue rounded-lg shrink-0">
              <SvgIcon name="folder-shared" width={12} height={12} className="text-white" />
            </div>
            <p className="text-xl font-semibold text-black">Project</p>
          </div>
        </div>
        <Input
          value={project.projectName}
          onChange={(e) => setProject({ ...project, projectName: e.target.value })}
          className="h-12 lg:h-[60px] rounded-full px-6 text-base border-strokes w-full lg:w-[245px] bg-white"
        />
      </div>

      {/* Right: Tabs */}
      <nav className="flex">
        <div className="flex gap-2 md:gap-5 bg-white border border-strokes rounded-full p-2 md:p-3 overflow-x-auto">
          {tabs.map((tab) => {
            const isActive = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex items-center gap-1.5 px-3 py-2.5 md:px-4 md:py-3 rounded-full text-sm whitespace-nowrap transition-colors ${
                  isActive
                    ? "bg-background-blue border border-cobalt text-black font-medium"
                    : "text-light-grey-text hover:bg-gray-50"
                }`}
              >
                <SvgIcon name={tab.icon} width={16} height={16} className={isActive ? "text-cobalt" : "text-current opacity-54"} />
                <span className="hidden sm:inline">{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
