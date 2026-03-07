 export enum PlanType {
   FREE = 'FREE',
   START = 'START',
   PREMIUM = 'PREMIUM',
   VIP = 'VIP'
 }
 
 export type StyleCategory = 'realistic' | 'artistic' | 'futuristic' | 'wild';
 
 export interface User {
   id: string;
   plan: PlanType;
   remainingCredits: number;
   allowedStylesCount: number | 'all';
   paidUntil?: string;
   history: string[];
 }
 
 export interface Style {
   id: string;
   name: string;
   category: StyleCategory;
   description: string;
   prompt: string;
   previewUrl: string;
 }
 
 export interface Package {
   id: PlanType;
   name: string;
   price: number;
   credits: number;
   stylesLimit: number | 'all';
   description: string;
   features: string[];
 }
 
export interface Job {
   id: string;
   userId: string;
   status: 'queued' | 'running' | 'done' | 'error';
   styleIds: string[];
   isFullBody?: boolean;
   customPrompt?: string;
   originalImage: string;
   originalDimensions?: { width: number; height: number };
   results: string[];
   createdAt: number;
 }