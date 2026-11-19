begin
    perform public.release_in_net_fishes();

    update public.user_in_area
    set
        area_id = null,
        session_id = null,
        status = null,
        updated_at = now()
    where user_id = auth.uid();
end;
