export type ServiceListItem = {
  id: string;
  name: string | null;
  short_name: string | null;
  notes?: string | null;
  created_at: Date | null;
};