"use client";

import { AppHeader } from "@/components/AppHeader";
import { EstimationPanel } from "@/components/EstimationPanel";

export function PageLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background-blue flex flex-col">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 flex-1">
        <div className="lg:col-span-8 min-w-0">
          <AppHeader />
          <div className="px-4 md:px-8 lg:px-15 py-6 lg:py-10">
            {children}
          </div>
        </div>
        <div className="px-4 pb-4 md:px-6 md:pb-6 lg:col-span-4 lg:p-5 lg:pl-0 lg:sticky lg:top-0 lg:h-screen lg:self-start">
          <EstimationPanel />
        </div>
      </div>
    </div>
  );
}
