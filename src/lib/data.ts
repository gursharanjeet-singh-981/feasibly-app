import type { Component, Template } from "@/types";

export interface GlobalPrinciple {
  id: number;
  name: string;
  designDescription: string;
  developmentDescription: string;
}

export async function loadComponents(): Promise<Component[]> {
  const response = await fetch("/data/components.json");
  if (!response.ok) {
    throw new Error("Failed to load components data");
  }
  return response.json();
}

export async function loadTemplates(): Promise<Template[]> {
  const response = await fetch("/data/templates.json");
  if (!response.ok) {
    throw new Error("Failed to load templates data");
  }
  return response.json();
}

export async function loadGlobalPrinciples(): Promise<GlobalPrinciple[]> {
  const response = await fetch("/data/global-principles.json");
  if (!response.ok) {
    throw new Error("Failed to load global principles data");
  }
  return response.json();
}
