export interface IncludedSection {
  title: string;
  items: string[];
}

export const DEV_INCLUDED: IncludedSection[] = [
  {
    title: "Engineering Analysis & Planning",
    items: [
      "Reviewing design documentation",
      "Understanding migration constraints",
      "Mapping to core components or deciding on custom build",
      "Authoring model definition",
      "Technical feasibility notes",
      "Task breakdown & estimation",
    ],
  },
  {
    title: "Pure Coding / Component Build",
    items: [
      "Backend AEM component implementation (HTL, Sling Models, dialogs)",
      "Front-end implementation (HTML, CSS, JS per component)",
      "Data layer wiring / analytics hooks",
      "Localisation support if needed",
      "Responsive behaviour implementation",
      "Reusable logic development (if part of system design)",
    ],
  },
  {
    title: "Engineering Documentation",
    items: [
      "Authoring documentation (how authors use the component)",
      "Technical documentation (dependencies, logic, architecture)",
      "Notes in UAT",
    ],
  },
  {
    title: "Manual Developer Testing",
    items: [
      "Unit tests",
      "Manual testing on breakpoints",
      "Checking alignment with design",
      "Browser testing",
      "Accessibility spot checks",
    ],
  },
  {
    title: "Code Review Process",
    items: [
      "Peer review",
      "Corrections and improvements",
      "Security and performance checks",
    ],
  },
  {
    title: "Build, Deploy & Release Activities",
    items: [
      "Integration into AEM environment",
      "Deployment pipeline steps",
      "Fixing environment configuration issues",
      "Release notes and artefacts",
    ],
  },
];

export const DESIGN_INCLUDED: IncludedSection[] = [
  {
    title: "Product & UX Discovery Activities",
    items: [
      "Requirements clarification",
      "Understanding constraints of AEM templating & authoring",
      "Reviewing existing components for migration impact",
      "Accessibility considerations from the start",
    ],
  },
  {
    title: "UX Design",
    items: [
      "Initial wireframes or structural patterns",
      "UX flows especially for interactive components like tabs, forms, nav, carousel",
      "Interaction principles",
      "Responsive rules (mobile, tablet, desktop behaviour)",
      "Edge cases and error states",
    ],
  },
  {
    title: "UI Design",
    items: [
      "Applying brand visual styling",
      "Component variants (sizes, states, themes)",
      "Hover, active, focus states",
      "Motion guidance (if applicable)",
      "Asset creation (icons, imagery guidance)",
    ],
  },
  {
    title: "Design System Alignment",
    items: [
      "Mapping patterns to the design system",
      "Creating new design tokens if needed",
      "Documenting rules for future reuse",
      "Ensuring consistency across components",
    ],
  },
  {
    title: "Code Review Process",
    items: [
      "Peer review",
      "Corrections and improvements",
      "Security and performance checks",
    ],
  },
  {
    title: "Documentation",
    items: [
      "Figma organisation",
      "Developer-ready annotation",
      "Final screens for all variants",
      "Accessibility specs",
      "Exporting assets where needed",
      "Preparation of component specification documentation",
    ],
  },
];
