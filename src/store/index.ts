import { create } from "zustand";
import { persist } from "zustand/middleware";
import { calculateEstimation } from "@/lib/calculations";
import { STORAGE_KEY, STORAGE_VERSION } from "@/lib/constants";
import { initialScanSliceState, type ScanSliceState } from "@/lib/scanner/types";
import type {
  Project,
  SelectedComponent,
  SelectedTemplate,
  EstimationSummary,
} from "@/types";

const emptyProject: Project = {
  projectName: "",
  liveUrl: "",
  scope: { components: false, templates: false },
  platform: "AEM",
};

function makeCustomComponent(id: number, group: string): SelectedComponent {
  return {
    id,
    group,
    name: "",
    category: "",
    designDescription: "",
    developmentDescription: "",
    designEffort: 0,
    aiDesignEffort: 0,
    devEffort: 0,
    aiDevEffort: 0,
    assumptions: "",
    isSelected: false,
    isCustom: true,
  };
}

function makeCustomTemplate(id: number, name: string): SelectedTemplate {
  return {
    id,
    name,
    category: "",
    description: "",
    designEffortBase: 0,
    aiDesignEffortBase: 0,
    designEffortPerPage: 0,
    devEffortBase: 0,
    aiDevEffortBase: 0,
    devEffortPerPage: 0,
    isSelected: false,
    additionalPages: 0,
    isCustom: true,
  };
}

function nextId(items: { id: number }[]): number {
  return items.reduce((max, i) => Math.max(max, i.id), 0) + 1;
}

interface AppState {
  project: Project;
  setProject: (project: Project) => void;

  useAiEstimation: boolean;
  toggleAiEstimation: () => void;

  components: SelectedComponent[];
  setComponents: (components: SelectedComponent[]) => void;
  toggleComponent: (id: number) => void;
  setComponentsSelection: (ids: number[], isSelected: boolean) => void;
  addComponent: (group: string) => void;
  updateComponent: (id: number, updates: Partial<SelectedComponent>) => void;

  templates: SelectedTemplate[];
  setTemplates: (templates: SelectedTemplate[]) => void;
  toggleTemplate: (id: number) => void;
  setTemplatesSelection: (ids: number[], isSelected: boolean) => void;
  setAdditionalPages: (id: number, pages: number) => void;
  addTemplate: (name: string) => void;
  updateTemplate: (id: number, updates: Partial<SelectedTemplate>) => void;

  getEstimation: () => EstimationSummary;
  resetStore: () => void;

  scan: ScanSliceState;
  setScan: (partial: Partial<ScanSliceState>) => void;
  resetScan: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      project: { ...emptyProject },
      setProject: (project) => set({ project }),

      useAiEstimation: false,
      toggleAiEstimation: () =>
        set((state) => ({ useAiEstimation: !state.useAiEstimation })),

      resetStore: () =>
        set({
          project: { ...emptyProject },
          components: [],
          templates: [],
          useAiEstimation: false,
          scan: { ...initialScanSliceState },
        }),

      components: [],
      setComponents: (components) => set({ components }),
      toggleComponent: (id) =>
        set((state) => ({
          components: state.components.map((c) =>
            c.id === id ? { ...c, isSelected: !c.isSelected } : c,
          ),
        })),
      setComponentsSelection: (ids, isSelected) =>
        set((state) => {
          const idSet = new Set(ids);
          return {
            components: state.components.map((c) =>
              idSet.has(c.id) ? { ...c, isSelected } : c,
            ),
          };
        }),
      addComponent: (group) =>
        set((state) => ({
          components: [
            ...state.components,
            makeCustomComponent(nextId(state.components), group),
          ],
        })),
      updateComponent: (id, updates) =>
        set((state) => ({
          components: state.components.map((c) =>
            c.id === id ? { ...c, ...updates } : c,
          ),
        })),

      templates: [],
      setTemplates: (templates) => set({ templates }),
      toggleTemplate: (id) =>
        set((state) => ({
          templates: state.templates.map((t) =>
            t.id === id ? { ...t, isSelected: !t.isSelected } : t,
          ),
        })),
      setTemplatesSelection: (ids, isSelected) =>
        set((state) => {
          const idSet = new Set(ids);
          return {
            templates: state.templates.map((t) =>
              idSet.has(t.id) ? { ...t, isSelected } : t,
            ),
          };
        }),
      setAdditionalPages: (id, pages) =>
        set((state) => ({
          templates: state.templates.map((t) =>
            t.id === id ? { ...t, additionalPages: Math.max(0, pages) } : t,
          ),
        })),
      addTemplate: (name) =>
        set((state) => ({
          templates: [
            ...state.templates,
            makeCustomTemplate(nextId(state.templates), name),
          ],
        })),
      updateTemplate: (id, updates) =>
        set((state) => ({
          templates: state.templates.map((t) =>
            t.id === id ? { ...t, ...updates } : t,
          ),
        })),

      getEstimation: () => {
        const { components, templates, useAiEstimation } = get();
        return calculateEstimation(components, templates, useAiEstimation);
      },

      scan: { ...initialScanSliceState },
      setScan: (partial) =>
        set((state) => ({ scan: { ...state.scan, ...partial } })),
      resetScan: () => set({ scan: { ...initialScanSliceState } }),
    }),
    {
      name: STORAGE_KEY,
      version: STORAGE_VERSION,
      // v1 -> v2: promote the `assumptions === "__custom__"` sentinel to explicit isCustom.
      // v2 -> v3: seed empty scan slice for the live-site scan feature.
      migrate: (persisted, version) => {
        const state = persisted as Partial<AppState> | undefined;
        if (!state) return persisted as AppState;
        if (version < 2) {
          state.components = (state.components ?? []).map((c) => ({
            ...c,
            isCustom: c.isCustom ?? c.assumptions === "__custom__",
            assumptions:
              c.assumptions === "__custom__" ? "" : (c.assumptions ?? ""),
          }));
          state.templates = (state.templates ?? []).map((t) => ({
            ...t,
            isCustom: t.isCustom ?? false,
          }));
        }
        if (version < 3) {
          state.scan = { ...initialScanSliceState };
        }
        return state as AppState;
      },
    },
  ),
);