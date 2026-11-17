// Schema-aligned bootstrap types. Regenerate against the local database with `pnpm db:types`.
import type { AccountPreferences } from '@/features/account-settings/contracts';
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
export type AccountProfile = { user_id: string; display_name: string; avatar_path: string | null; avatar_version: number; updated_at: string; version: number };
export type UserPreferences = AccountPreferences & { user_id: string; updated_at: string; version: number };
export type UserWorkspacePreferences = { user_id: string; organization_id: string; last_view: 'overview' | 'queue'; last_queue_view: 'list' | 'kanban'; updated_at: string; version: number };
type Table<Row> = { Row: Row; Insert: Partial<Row>; Update: Partial<Row>; Relationships: [] };
export type Database = {
  public: {
    Tables: {
      profiles: Table<AccountProfile>;
      user_preferences: Table<UserPreferences>;
      user_workspace_preferences: Table<UserWorkspacePreferences>;
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
    Functions: {
      renew_invitation: { Args: { p_slug: string; p_id: string }; Returns: Json };
      account_profile_update: { Args: { p_name: string; p_version: number }; Returns: Json };
      account_preferences_update: { Args: { p_patch: Json; p_version: number }; Returns: Json };
      account_workspace_preference_update: { Args: { p_slug: string; p_view: string; p_queue_view: string; p_version: number }; Returns: Json };
      account_feature_status: { Args: Record<string, never>; Returns: Json };
      account_feature_set: { Args: { p_name: string; p_enabled: boolean }; Returns: undefined };
      avatar_processing_key_set: { Args: { p_key_id: string; p_secret_id: string }; Returns: undefined };
      avatar_processing_key_disable: { Args: { p_key_id: string }; Returns: undefined };
      avatar_prepare_intent: { Args: { p_id: string; p_digest: string; p_size: number; p_version: number; p_expires: number; p_key_id: string; p_signature: string }; Returns: Json };
      avatar_finalize_intent: { Args: { p_id: string; p_signature: string }; Returns: Json };
      avatar_remove: { Args: { p_version: number }; Returns: Json };
      avatar_cancel_intent: { Args: { p_id: string }; Returns: undefined };
      avatar_cleanup_claim: { Args: { p_limit?: number }; Returns: Json };
      avatar_cleanup_complete: { Args: { p_id: string; p_lease: string }; Returns: undefined };
      invite_preview:{Args:{p_token:string};Returns:Json}; privacy_command:{Args:{p_action:string;p_payload?:Json};Returns:Json};unsubscribe_marketing:{Args:{p_token:string};Returns:undefined};desk_command: { Args: { p_slug: string; p_action: string; p_payload?: Json }; Returns: Json }
    };
    Enums: { member_role: MemberRole; ticket_status: TicketStatus; ticket_priority: TicketPriority };
    CompositeTypes: { [_ in never]: never };
  };
};
