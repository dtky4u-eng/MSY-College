// Serializable shapes passed from the Learning Setup server page to its client components.
import type { ResourceType } from "@/lib/constants";

export interface Filters {
  q?: string | null;
  sector?: string | null;
  status?: string | null;
}

export interface SectorOption {
  id: string;
  name: string;
  domains: number;
}

export interface DomainValue {
  id: string;
  code: string;
  name: string;
  description: string | null;
  sectorId: string;
  durationHours: number;
  defaultFee: number; // paise
  active: boolean;
  featured: boolean;
}

export interface ModuleValue {
  id: string;
  domainId: string;
  number: number;
  name: string;
  description: string | null;
}

export interface ChapterValue {
  id: string;
  moduleId: string;
  number: number;
  name: string;
  description: string | null;
  minWatchSeconds: number;
  minReadSeconds: number;
}

export interface ResourceFile {
  id: string;
  name: string;
  size: number;
  mime: string;
  href: string;
  downloadHref: string;
}

export interface ResourceRow {
  id: string;
  type: ResourceType;
  title: string;
  url: string | null;
  content: string | null;
  sortOrder: number;
  primary: boolean;
  downloadable: boolean;
  file: ResourceFile | null;
  updatedAt: string;
}

export interface QuizValue {
  id: string;
  chapterId: string;
  title: string;
  description: string | null;
  passingScore: number;
  attemptsAllowed: number;
  timeLimitMinutes: number | null;
  randomize: boolean;
  showResult: boolean;
}

export interface QuizStats {
  attempts: number;
  submitted: number;
  passed: number;
}

export interface QuestionRow {
  id: string;
  text: string;
  options: string[];
  correctIndex: number;
  marks: number;
  explanation: string | null;
  sort: number;
}
