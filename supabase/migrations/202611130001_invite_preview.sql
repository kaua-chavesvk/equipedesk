create function public.invite_preview(p_token text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare invitation public.invitations;
begin
  if auth.uid() is null or p_token is null or length(p_token) not between 32 and 256 then
    return jsonb_build_object('status','invalid');
  end if;

  select i.* into invitation from public.invitations i
  join auth.users u on u.id=auth.uid() and u.email_confirmed_at is not null and lower(u.email)=i.email
  where i.token_hash=encode(extensions.digest(p_token,'sha256'),'hex');

  if not found then return jsonb_build_object('status','invalid'); end if;
  if invitation.accepted_at is not null then return jsonb_build_object('status','used'); end if;
  if invitation.revoked_at is not null then return jsonb_build_object('status','revoked'); end if;
  if invitation.expires_at <= now() then return jsonb_build_object('status','expired'); end if;
  return (select jsonb_build_object('status','valid','company',name,'role',invitation.role)
    from public.organizations where id=invitation.organization_id);
end;
$$;
revoke all on function public.invite_preview(text) from public, anon;
grant execute on function public.invite_preview(text) to authenticated;
