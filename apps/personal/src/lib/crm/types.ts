import type { PersonalPageId } from "../../../../../site.config.ts";

export type DB = D1Database;

export interface Submission {
  id: number;
  page: PersonalPageId;
  batch: string;
  lang: string;
  name: string;
  contact: string;
  email: string | null;
  phone: string | null;
  child_name: string | null;
  met_where: string | null;
  good_times: string | null;
  message: string | null;
  status: string;
  created_at: string;
}

export interface Family {
  id: number;
  source_page: string | null;
  batch: string | null;
  first_contact_at: string;
  notes: string;
}

export interface Adult {
  id: number;
  family_id: number;
  name: string;
  phone: string | null;
  email: string | null;
  whatsapp: string | null;
  language: string;
  broadcast_opt_in: number;
}

export interface Child {
  id: number;
  family_id: number;
  first_name: string;
  knows: string;
  met_where: string | null;
}

export interface Interaction {
  id: number;
  family_id: number;
  at: string;
  kind: string;
  summary: string;
}

export interface Reminder {
  id: number;
  family_id: number;
  due_on: string;
  text: string;
  done_at: string | null;
}
