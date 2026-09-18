-- The marble: a track's fingerprint, made visible.
--
-- Six numbers derived from the three component embeddings by fixed random
-- projection. Because the projection is fixed, two tracks whose vectors are
-- close produce close marbles — so tracks that sound alike look alike. That
-- is the whole point: the visual carries the same signal the matching does.
--
-- Stored rather than computed per request: the embeddings are 512-dimension
-- and a feed page would otherwise ship thousands of floats to draw a
-- thumbnail.

alter table fingerprints
  add column if not exists marble real[];

alter table fingerprints
  drop constraint if exists fingerprints_marble_len;
alter table fingerprints
  add constraint fingerprints_marble_len
  check (marble is null or array_length(marble, 1) = 6);
