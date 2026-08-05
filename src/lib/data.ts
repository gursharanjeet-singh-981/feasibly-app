import { DATA_URLS } from "@/lib/constants";
import type { Component, Template } from "@/types";

export interface GlobalPrinciple {
  id: number;
  name: string;
  designDescription: string;
  developmentDescription: string;
}

async function loadJson<T>(url: string, label: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load ${label} data`);
  }
  return response.json();
}

export const loadComponents = () =>
  loadJson<Component[]>(DATA_URLS.components, "components");

export const loadTemplates = () =>
  loadJson<Template[]>(DATA_URLS.templates, "templates");

export const loadGlobalPrinciples = () =>
  loadJson<GlobalPrinciple[]>(DATA_URLS.globalPrinciples, "global principles");
