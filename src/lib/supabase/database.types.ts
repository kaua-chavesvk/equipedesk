// Schema-aligned bootstrap types. Regenerate against the local database with `pnpm db:types`.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
export type MemberRole = 'admin' | 'agent' | 'requester';
export type TicketStatus = 'open' | 'in_progress' | 'resolved';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type Organization = { id: string; name: string; slug: string; created_at: string };
export type Membership = { organization_id: string; user_id: string; role: MemberRole; created_at: string };
export type Ticket = {
  id: string; organization_id: string; requester_id: string; assignee_id: string | null;
  title: string; description: string; priority: TicketPriority; status: TicketStatus;
  version: number; created_at: string; updated_at: string;
};
export type Comment = { id: string; organization_id: string; ticket_id: string; author_id: string; body: string; created_at: string };
export type TicketEvent = { id: string; organization_id: string; ticket_id: string; actor_id: string; kind: string; payload: Json; created_at: string };
export type Invitation = { id: string; organization_id: string; email: string; role: MemberRole; token_hash: string; expires_at: string; created_by: string; accepted_at: string | null; revoked_at: string | null; created_at: string };
type Table<Row> = { Row: Row; Insert: Partial<Row>; Update: Partial<Row>; Relationships: [] };
export type Database = {
  public: {
    Tables: {
      platform_admins: Table<{user_id:string;created_at:string}>;
      legal_acceptances: Table<{id:string;user_id:string|null;subject_hash:string;kind:string;terms_version:string|null;privacy_version:string|null;adult_confirmed:boolean|null;source:string;recorded_at:string;delete_after:string|null}>;
      privacy_preferences: Table<{user_id:string;marketing:boolean;unsubscribe_hash:string|null;updated_at:string}>;
      privacy_requests: Table<{id:string;user_id:string|null;subject_hash:string;kind:string;details:string;status:string;response:string|null;created_at:string;due_at:string;completed_at:string|null;delete_after:string|null}>;
      organizations: Table<Organization>;
      memberships: Table<Membership>;
      tickets: Table<Ticket>;
      comments: Table<Comment>;
      ticket_events: Table<TicketEvent>;
      invitations: Table<Invitation>;
    };
    Views: { [_ in never]: never };
    Functions: { invite_preview:{Args:{p_token:string};Returns:Json}; privacy_command:{Args:{p_action:string;p_payload?:Json};Returns:Json};unsubscribe_marketing:{Args:{p_token:string};Returns:undefined};desk_command: { Args: { p_slug: string; p_action: string; p_payload?: Json }; Returns: Json } };
    Enums: { member_role: MemberRole; ticket_status: TicketStatus; ticket_priority: TicketPriority };
    CompositeTypes: { [_ in never]: never };
  };
};
