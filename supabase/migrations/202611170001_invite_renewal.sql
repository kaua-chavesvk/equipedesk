create function public.renew_invitation(p_slug text, p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  previous_invite public.invitations;
begin
  -- Reuse the existing checks and lock order. If issuing the replacement
  -- fails, the revocation also rolls back.
  perform public.desk_command(p_slug, 'revoke_invite', jsonb_build_object('id', p_id));

  select * into strict previous_invite
    from public.invitations
    where id = p_id;

  return public.desk_command(p_slug, 'invite', jsonb_build_object(
    'email', previous_invite.email,
    'role', previous_invite.role
  ));
end;
$$;

revoke all on function public.renew_invitation(text, uuid) from public, anon;
grant execute on function public.renew_invitation(text, uuid) to authenticated;
