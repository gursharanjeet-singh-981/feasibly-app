"use client";

import { useEffect, useState } from "react";
import { PageLayout } from "@/components/PageLayout";
import { loadGlobalPrinciples, type GlobalPrinciple } from "@/lib/data";

export default function GlobalPrinciplesPage() {
  const [principles, setPrinciples] = useState<GlobalPrinciple[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadGlobalPrinciples()
      .then(setPrinciples)
      .catch(() => setError("Failed to load global principles. Please refresh the page."))
      .finally(() => setLoading(false));
  }, []);
  return (
    <PageLayout>
        <div className="bg-white rounded-2xl lg:rounded-[40px] p-4 md:p-6 lg:p-8">
            <h2 className="text-xl md:text-2xl lg:text-[30px] font-semibold text-black mb-8 lg:mb-10">
              Global Principles
            </h2>

            <div className="border border-strokes/50 rounded-2xl overflow-hidden">
              {loading && (
                <div className="p-8 text-center text-sm text-light-grey-text">Loading global principles…</div>
              )}
              {error && (
                <div className="p-8 text-center text-sm text-red-600">{error}</div>
              )}
              {!loading && !error && principles.length === 0 && (
                <div className="p-8 text-center text-sm text-light-grey-text">No global principles found.</div>
              )}

              {/* Table Header — Desktop */}
              {!loading && !error && principles.length > 0 && (
              <>
              <div className="hidden lg:flex bg-background-blue text-sm font-semibold text-black">
                <div className="flex items-center gap-3 px-4 py-4 w-50 shrink-0">
                  <span>Global Parameter</span>
                </div>
                <div className="px-4 py-4 flex-1 min-w-50">Design Description</div>
                <div className="px-4 py-4 flex-1 min-w-50">Development Description</div>
              </div>

              {/* Rows */}
              {principles.map((principle) => (
                <div
                  key={principle.id}
                  className="border-b border-strokes/50 last:border-b-0"
                >
                  {/* Desktop */}
                  <div className="hidden lg:flex items-stretch text-xs text-black">
                    <div className="flex items-start px-4 py-4 w-50 shrink-0 border-r border-strokes/50">
                      <span className="text-sm font-medium leading-snug">
                        {principle.name}
                      </span>
                    </div>
                    <div className="flex items-start px-4 py-4 flex-1 min-w-50 border-r border-strokes/50 leading-snug break-words">
                      {principle.designDescription}
                    </div>
                    <div className="flex items-start px-4 py-4 flex-1 min-w-50 leading-snug break-words">
                      {principle.developmentDescription}
                    </div>
                  </div>

                  {/* Mobile */}
                  <div className="lg:hidden p-4">
                    <p className="text-sm font-medium text-black mb-3">
                      {principle.name}
                    </p>
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs font-semibold text-black mb-1">
                          Design
                        </p>
                        <p className="text-xs text-light-grey-text leading-snug">
                          {principle.designDescription}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-black mb-1">
                          Development
                        </p>
                        <p className="text-xs text-light-grey-text leading-snug">
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
