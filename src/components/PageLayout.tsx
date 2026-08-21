"use client";

import { AppHeader } from "@/components/AppHeader";
import { EstimationPanel } from "@/components/EstimationPanel";

export function PageLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background-blue flex flex-col" suppressHydrationWarning>
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-0 flex-1">
        <div className="xl:col-span-8 min-w-0">
          <AppHeader />
          <div className="px-4 md:px-8 lg:px-15 py-6 lg:py-10">
            {children}
          </div>
        </div>
        <div className="px-4 pb-4 md:px-6 md:pb-6 xl:col-span-4 xl:p-5 xl:pl-0 xl:sticky xl:top-0 xl:h-screen xl:self-start">
          <EstimationPanel />
        </div>
      </div>
    </div>
  );
}
