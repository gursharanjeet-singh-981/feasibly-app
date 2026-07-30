import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Project,
  SelectedComponent,
  SelectedTemplate,
  EstimationSummary,
} from "@/types";

interface AppState {
  // Project
  project: Project;
  setProject: (project: Project) => void;

  // Components
  components: SelectedComponent[];
  setComponents: (components: SelectedComponent[]) => void;
  toggleComponent: (id: number) => void;
  addComponent: (group: string) => void;
  updateComponent: (id: number, updates: Partial<SelectedComponent>) => void;

  // Templates
  templates: SelectedTemplate[];
  setTemplates: (templates: SelectedTemplate[]) => void;
  toggleTemplate: (id: number) => void;
  setAdditionalPages: (id: number, pages: number) => void;
  addTemplate: (group: string) => void;
  updateTemplate: (id: number, updates: Partial<SelectedTemplate>) => void;

  // Computed
  getEstimation: () => EstimationSummary;

  // Reset
  resetStore: () => void;
}

const BUFFER_MULTIPLIER = 1.2;
const DAYS_PER_WEEK = 5;

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Project
      project: {
        projectName: "",
        liveUrl: "",
        scope: { components: false, templates: false },
        platform: "AEM",
      },
      setProject: (project) => set({ project }),

      // Reset
      resetStore: () =>
        set({
          project: {
            projectName: "",
            liveUrl: "",
            scope: { components: false, templates: false },
            platform: "AEM",
          },
          components: [],
          templates: [],
        }),

      // Components
      components: [],
      setComponents: (components) => set({ components }),
      toggleComponent: (id) =>
        set((state) => ({
          components: state.components.map((c) =>
            c.id === id ? { ...c, isSelected: !c.isSelected } : c
          ),
        })),
      addComponent: (group) =>
        set((state) => {
          const maxId = state.components.reduce((max, c) => Math.max(max, c.id), 0);
          const newComponent: SelectedComponent = {
            id: maxId + 1,
            group,
            name: "",
            category: "",
            designDescription: "",
            developmentDescription: "",
            designEffort: 0,
            aiDesignEffort: 0,
            devEffort: 0,
            aiDevEffort: 0,
            assumptions: "__custom__",
            isSelected: false,
          };
          return { components: [...state.components, newComponent] };
        }),
      updateComponent: (id, updates) =>
        set((state) => ({
          components: state.components.map((c) =>
            c.id === id ? { ...c, ...updates } : c
          ),
        })),

      // Templates
      templates: [],
      setTemplates: (templates) => set({ templates }),
      toggleTemplate: (id) =>
        set((state) => ({
          templates: state.templates.map((t) =>
            t.id === id ? { ...t, isSelected: !t.isSelected } : t
          ),
        })),
      setAdditionalPages: (id, pages) =>
        set((state) => ({
          templates: state.templates.map((t) =>
            t.id === id ? { ...t, additionalPages: pages } : t
          ),
        })),
      addTemplate: (group) =>
        set((state) => {
          const maxId = state.templates.reduce((max, t) => Math.max(max, t.id), 0);
          const newTemplate: SelectedTemplate = {
            id: maxId + 1,
            name: group,
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
          return { templates: [...state.templates, newTemplate] };
        }),
      updateTemplate: (id, updates) =>
        set((state) => ({
          templates: state.templates.map((t) =>
            t.id === id ? { ...t, ...updates } : t
          ),
        })),

      // Estimation
      getEstimation: () => {
        const { components, templates } = get();

        const selectedComponents = components.filter((c) => c.isSelected);
        const selectedTemplates = templates.filter((t) => t.isSelected);

        const componentDesignDays = selectedComponents.reduce(
          (sum, c) => sum + c.designEffort,
          0
        );
        const componentDevDays = selectedComponents.reduce(
          (sum, c) => sum + c.devEffort,
          0
        );

        const templateDesignDays = selectedTemplates.reduce(
          (sum, t) =>
            sum + t.designEffortBase + t.additionalPages * t.designEffortPerPage,
          0
        );
        const templateDevDays = selectedTemplates.reduce(
          (sum, t) =>
            sum + t.devEffortBase + t.additionalPages * t.devEffortPerPage,
          0
        );

        const designDays = componentDesignDays + templateDesignDays;
        const devDays = componentDevDays + templateDevDays;

        const designDaysWithBuffer = designDays * BUFFER_MULTIPLIER;
        const devDaysWithBuffer = devDays * BUFFER_MULTIPLIER;

        return {
          totalComponents: selectedComponents.length,
          totalTemplates: selectedTemplates.length,
          totalAdditionalPages: selectedTemplates.reduce(
            (sum, t) => sum + t.additionalPages,
            0
          ),
          designDays,
          designDaysWithBuffer,
          designWeeks: Math.ceil(designDaysWithBuffer / DAYS_PER_WEEK),
          devDays,
          devDaysWithBuffer,
          devWeeks: Math.ceil(devDaysWithBuffer / DAYS_PER_WEEK),
        };
      },
    }),
    {
      name: "feasibly-storage",
    }
  )
);
