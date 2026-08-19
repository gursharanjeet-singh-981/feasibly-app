"use client";

import { useEffect, useState } from "react";
import { PageLayout } from "@/components/PageLayout";
import { useRequireOnboarding } from "@/hooks/useRequireOnboarding";
import { loadGlobalPrinciples, type GlobalPrinciple } from "@/lib/data";

export default function GlobalPrinciplesPage() {
  const ready = useRequireOnboarding();
  const [principles, setPrinciples] = useState<GlobalPrinciple[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    loadGlobalPrinciples()
      .then((data) => {
        if (!cancelled) {
          setPrinciples(data);
          setError(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("Failed to load global principles. Please refresh the page.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [ready]);

  if (!ready) return null;

  return (
    <PageLayout>
      <div className="rounded-2xl bg-white p-4 md:p-6 lg:rounded-[40px] lg:p-8">
          <h2 className="mb-8 text-xl font-semibold text-black md:text-2xl lg:mb-10 lg:text-[30px]">
            Global Principles
          </h2>

          <div className="border-strokes/50 overflow-hidden rounded-2xl border">
            {error && (
              <div className="p-8 text-center text-sm text-red-600">
                {error}
              </div>
            )}
            {!error && principles.length === 0 && (
              <div className="text-light-grey-text p-8 text-center text-sm">
                No global principles found.
              </div>
            )}

            {!error && principles.length > 0 && (
              <>
                <div className="bg-background-blue hidden text-sm font-semibold text-black lg:flex">
                  <div className="flex w-50 shrink-0 items-center gap-3 px-4 py-4">
                    <span>Global Parameter</span>
                  </div>
                  <div className="min-w-50 flex-1 px-4 py-4">
                    Design Description
                  </div>
                  <div className="min-w-50 flex-1 px-4 py-4">
                    Development Description
                  </div>
                </div>

                {principles.map((principle) => (
                  <div
                    key={principle.id}
                    className="border-strokes/50 border-b last:border-b-0"
                  >
                    <div className="hidden items-stretch text-xs text-black lg:flex">
                      <div className="border-strokes/50 flex w-50 shrink-0 items-start border-r px-4 py-4">
                        <span className="text-sm leading-snug font-medium">
                          {principle.name}
                        </span>
                      </div>
                      <div className="border-strokes/50 flex min-w-50 flex-1 items-start border-r px-4 py-4 leading-snug wrap-break-word">
                        {principle.designDescription}
                      </div>
                      <div className="flex min-w-50 flex-1 items-start px-4 py-4 leading-snug wrap-break-word">
                        {principle.developmentDescription}
                      </div>
                    </div>

                    <div className="p-4 lg:hidden">
                      <p className="mb-3 text-sm font-medium text-black">
                        {principle.name}
                      </p>
                      <div className="space-y-3">
                        <div>
                          <p className="mb-1 text-xs font-semibold text-black">
                            Design
                          </p>
                          <p className="text-light-grey-text text-xs leading-snug">
                            {principle.designDescription}
                          </p>
                        </div>
                        <div>
                          <p className="mb-1 text-xs font-semibold text-black">
                            Development
                          </p>
                          <p className="text-light-grey-text text-xs leading-snug">
                            {principle.developmentDescription}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
    </PageLayout>
  );
}
