-- Audio metadata captured at upload, so the app never has to open the file.
--
-- byte_size lets the streaming route convert "30 seconds" into a byte range
-- without decoding, and peaks stores the real waveform drawn in the UI
-- (computed in the browser at upload time) instead of a synthetic shape.

alter table tracks
  add column if not exists byte_size bigint,
  add column if not exists peaks smallint[];

-- Bound the array so a malformed client can't write a huge row.
alter table tracks
  drop constraint if exists tracks_peaks_len;
alter table tracks
  add constraint tracks_peaks_len
  check (peaks is null or array_length(peaks, 1) <= 400);
