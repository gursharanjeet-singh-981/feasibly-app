export interface Component {
  id: number;
  group: string;
  name: string;
  category: string;
  designDescription: string;
  developmentDescription: string;
  designEffort: number;
  devEffort: number;
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
  designEffortPerPage: number;
  devEffortBase: number;
  devEffortPerPage: number;
}

export interface SelectedTemplate extends Template {
  isSelected: boolean;
  additionalPages: number;
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
  totalTemplates: number;
  totalAdditionalPages: number;
  designDays: number;
  designDaysWithBuffer: number;
  designWeeks: number;
  devDays: number;
  devDaysWithBuffer: number;
  devWeeks: number;
}
