-- ============================================================
-- Etie Memory Cancel Tag — run after supabase-migrate-memory-model.sql
-- Allows the tagger (owner) to cancel a pending tag before the
-- tagged person responds. Does NOT trigger the 72h cooldown.
-- ============================================================

-- Allow owner to delete their pending memory_tags
create or replace function public.cancel_tag(p_memory_id uuid, p_tagged_user_id uuid)
returns boolean language plpgsql security definer as $$
declare
  v_owner uuid;
  v_status text;
begin
  -- Verify the caller is the memory owner
  select user_id into v_owner from public.hangout_logs where id = p_memory_id;
  if v_owner is null or v_owner <> auth.uid() then
    return false;
  end if;

  -- Only cancel pending tags
  select status into v_status from public.memory_tags
  where memory_id = p_memory_id and tagged_user_id = p_tagged_user_id;
  if v_status is null or v_status <> 'pending' then
    return false;
  end if;

  -- Delete the tag (no cooldown triggered since it's a cancellation, not a decline)
  delete from public.memory_tags
  where memory_id = p_memory_id and tagged_user_id = p_tagged_user_id and status = 'pending';

  -- Also revert the connection to 'none' if it was created by this tag
  -- (only if no other tags exist between these users)
  if not exists (
    select 1 from public.memory_tags
    where tagged_by = auth.uid() and tagged_user_id = p_tagged_user_id
  ) then
    update public.connections set status = 'pending', responded_at = null
    where user_low = least(auth.uid(), p_tagged_user_id)
      and user_high = greatest(auth.uid(), p_tagged_user_id)
      and created_via = 'memory'
      and status = 'pending';
  end if;

  return true;
end;
$$;

grant execute on function public.cancel_tag(uuid, uuid) to authenticated;
