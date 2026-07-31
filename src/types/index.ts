export interface Component {
  id: number;
  group: string;
  name: string;
  category: string;
  designDescription: string;
  developmentDescription: string;
  designEffort: number;
  aiDesignEffort: number;
  devEffort: number;
  aiDevEffort: number;
  assumptions: string;
}

export interface SelectedComponent extends Component {
  isSelected: boolean;
}

export interface Template {
  id: number;
  name: string;
  category: string;
  description: string;
  designEffortBase: number;
  aiDesignEffortBase: number;
  designEffortPerPage: number;
  devEffortBase: number;
  aiDevEffortBase: number;
  devEffortPerPage: number;
}

export interface SelectedTemplate extends Template {
  isSelected: boolean;
  additionalPages: number;
  isCustom?: boolean;
}

export interface Project {
  projectName: string;
  liveUrl: string;
  scope: {
    components: boolean;
    templates: boolean;
  };
  platform: "AEM";
}

export interface EstimationSummary {
  totalComponents: number;
  totalVariants: number;
  totalTemplates: number;
  totalAdditionalPages: number;
  designDays: number;
  designDaysWithBuffer: number;
  designWeeks: number;
  devDays: number;
  devDaysWithBuffer: number;
  devWeeks: number;
}
