export interface Site {
  id: number;
  url: string;
  status: string;
  pages_crawled: number;
  chunks_indexed: number;
  has_contact_form: boolean;
  refresh_interval_hours: number;
  last_crawled: string | null;
  created_at: string;
}

export interface ContactFormField {
  name: string;
  type: string;
  required: boolean;
}

export interface ContactFormSchema {
  form_url: string;
  action: string;
  method: string;
  fields: ContactFormField[];
}

export interface Lead {
  session_id: string;
  data: Record<string, string>;
  form_submitted: boolean;
  captured_at: string;
  created_at: string;
}

export interface LeadsResponse {
  contact_form: ContactFormSchema | null;
  leads: Lead[];
}

export interface Session {
  session_id: string;
  lead_captured: boolean;
  created_at: string;
}

export interface Message {
  role: string;
  content: string;
  verdict: string;
  retries: number;
  mode: string;
  created_at: string;
}

export interface AdminUserRow {
  id: number;
  email: string;
  is_active: boolean;
  created_at: string;
}

export interface WidgetConfigShape {
  bot_name: string;
  title: string;
  welcome_message: string;
  placeholder: string;
  primary_color: string;
  text_color: string;
  bubble_icon: string;
  position: string;
  theme: string;
  launcher_label: string;
  show_branding: boolean;
  language: string;
  suggested_questions: string[];
}

export interface Analytics {
  site_indexed: boolean;
  site_url: string | null;
  total_sessions: number;
  total_questions: number;
  total_leads: number;
  lead_conversion_rate: number;
  grounded_rate: number;
  avg_retries: number;
  messages_per_day: { day: string; count: number }[];
  sessions_per_day: { day: string; count: number }[];
  leads_per_day: { day: string; count: number }[];
}
