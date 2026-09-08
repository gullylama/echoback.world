-- Only keep matches worth showing.
--
-- The original function inserted a row for every fingerprinted reference
-- track, so one upload against 1,000 artists produced 1,000 rows — most of
-- them noise around chance similarity. That bloats the table and buries the
-- real matches in the ranked list.
--
-- 55 is the floor for "this actually sounds like you". Tune it once you have
-- real match-quality data from the founder cohort.

create or replace function refresh_matches_for_track(p_track_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_kind track_kind;
  v_min_score constant real := 55;
begin
  select kind into v_kind from tracks where id = p_track_id;

  if v_kind = 'demo' then
    insert into matches (demo_track_id, talent_profile_id, talent_track_id,
                         vocal_score, style_score, production_score, blended_score)
    select * from (
      select
        p_track_id as demo_track_id,
        t.owner_id as talent_profile_id,
        t.id as talent_track_id,
        case when t.kind = 'voice'
             then greatest(0, (1 - (df.vocal_vector <=> f.vocal_vector)) * 100) else 0 end,
        greatest(0, (1 - (df.style_vector <=> f.style_vector)) * 100),
        case when t.kind = 'production'
             then greatest(0, (1 - (df.production_vector <=> f.production_vector)) * 100) else 0 end,
        case when t.kind = 'voice'
             then greatest(0, (1 - (df.vocal_vector <=> f.vocal_vector)) * 100) * 0.55
                  + greatest(0, (1 - (df.style_vector <=> f.style_vector)) * 100) * 0.45
             else greatest(0, (1 - (df.production_vector <=> f.production_vector)) * 100) * 0.6
                  + greatest(0, (1 - (df.style_vector <=> f.style_vector)) * 100) * 0.4 end as blended
      from tracks t
      join fingerprints f on f.track_id = t.id
      cross join (select * from fingerprints where track_id = p_track_id) df
      where t.kind in ('voice', 'production')
        and t.status = 'fingerprinted'
        and t.owner_id <> (select owner_id from tracks where id = p_track_id)
    ) scored(demo_track_id, talent_profile_id, talent_track_id,
             vocal_score, style_score, production_score, blended_score)
    where blended_score >= v_min_score
    on conflict (demo_track_id, talent_profile_id) do update
      set vocal_score = excluded.vocal_score,
          style_score = excluded.style_score,
          production_score = excluded.production_score,
          blended_score = excluded.blended_score,
          talent_track_id = excluded.talent_track_id;
  else
    insert into matches (demo_track_id, talent_profile_id, talent_track_id,
                         vocal_score, style_score, production_score, blended_score)
    select * from (
      select
        d.id as demo_track_id,
        t.owner_id as talent_profile_id,
        p_track_id as talent_track_id,
        case when v_kind = 'voice'
             then greatest(0, (1 - (df.vocal_vector <=> f.vocal_vector)) * 100) else 0 end,
        greatest(0, (1 - (df.style_vector <=> f.style_vector)) * 100),
        case when v_kind = 'production'
             then greatest(0, (1 - (df.production_vector <=> f.production_vector)) * 100) else 0 end,
        case when v_kind = 'voice'
             then greatest(0, (1 - (df.vocal_vector <=> f.vocal_vector)) * 100) * 0.55
                  + greatest(0, (1 - (df.style_vector <=> f.style_vector)) * 100) * 0.45
             else greatest(0, (1 - (df.production_vector <=> f.production_vector)) * 100) * 0.6
                  + greatest(0, (1 - (df.style_vector <=> f.style_vector)) * 100) * 0.4 end as blended
      from tracks d
      join fingerprints df on df.track_id = d.id
      join tracks t on t.id = p_track_id
      join fingerprints f on f.track_id = p_track_id
      where d.kind = 'demo'
        and d.status = 'fingerprinted'
        and d.owner_id <> t.owner_id
    ) scored(demo_track_id, talent_profile_id, talent_track_id,
             vocal_score, style_score, production_score, blended_score)
    where blended_score >= v_min_score
    on conflict (demo_track_id, talent_profile_id) do update
      set vocal_score = excluded.vocal_score,
          style_score = excluded.style_score,
          production_score = excluded.production_score,
          blended_score = excluded.blended_score,
          talent_track_id = excluded.talent_track_id;
  end if;
end;
$$;
