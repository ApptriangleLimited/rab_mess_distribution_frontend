-- Put back members deleted by the replace script, without removing the 1753 new rows.
-- Dead row versions are readable only until vacuum reclaims the pages.

ALTER TABLE members SET (autovacuum_enabled = false);
ALTER TABLE assignments SET (autovacuum_enabled = false);
ALTER TABLE tag_requests SET (autovacuum_enabled = false);
ALTER TABLE suppressed_carries SET (autovacuum_enabled = false);
ALTER TABLE meal_assigns SET (autovacuum_enabled = false);

CREATE EXTENSION IF NOT EXISTS pageinspect;

DROP TABLE IF EXISTS members_deleted_raw;
CREATE TABLE members_deleted_raw (
  deleted_xmax xid,
  attrs text[]
);

DO $scan$
DECLARE
  pages integer;
  p integer;
BEGIN
  SELECT relpages INTO pages
  FROM pg_class
  WHERE oid = 'public.members'::regclass;

  IF pages IS NULL OR pages < 1 THEN
    RAISE NOTICE 'members has no pages';
    RETURN;
  END IF;

  FOR p IN 0..pages - 1 LOOP
    BEGIN
      INSERT INTO members_deleted_raw (deleted_xmax, attrs)
      SELECT h.t_xmax, h.t_attrs
      FROM heap_page_item_attrs(
        get_raw_page('public.members', p),
        'public.members'::regclass,
        true
      ) AS h
      WHERE h.t_xmax <> '0'::xid
        AND h.lp_flags = 1
        AND h.t_attrs IS NOT NULL;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE 'skip members page %: %', p, SQLERRM;
    END;
  END LOOP;
END
$scan$;

DO $restore$
DECLARE
  id_pos integer;
  col_list text;
  cast_list text;
  restored integer;
BEGIN
  SELECT pos
  INTO id_pos
  FROM (
    SELECT attname, row_number() OVER (ORDER BY attnum) AS pos
    FROM pg_attribute
    WHERE attrelid = 'public.members'::regclass
      AND attnum > 0
      AND NOT attisdropped
  ) AS numbered
  WHERE attname = 'id';

  SELECT string_agg(quote_ident(attname), ', ' ORDER BY attnum),
         string_agg(
           format(
             'NULLIF(attrs[%s], '''')::%s AS %I',
             pos,
             format_type(atttypid, atttypmod),
             attname
           ),
           ', ' ORDER BY attnum
         )
  INTO col_list, cast_list
  FROM (
    SELECT attname,
           attnum,
           atttypid,
           atttypmod,
           row_number() OVER (ORDER BY attnum) AS pos
    FROM pg_attribute
    WHERE attrelid = 'public.members'::regclass
      AND attnum > 0
      AND NOT attisdropped
  ) AS cols;

  DROP TABLE IF EXISTS members_deleted_recovery;
  EXECUTE format(
    'CREATE TABLE members_deleted_recovery AS
     SELECT DISTINCT ON (attrs[%s]) %s
     FROM members_deleted_raw
     WHERE COALESCE(attrs[%s], '''') <> ''''
       AND attrs[%s] NOT IN (SELECT id FROM members)
     ORDER BY attrs[%s], deleted_xmax::text::bigint DESC',
    id_pos, cast_list, id_pos, id_pos, id_pos
  );

  EXECUTE $sql$
    UPDATE members_deleted_recovery AS recovered
    SET rab_id = recovered.rab_id || ' (old)'
    WHERE COALESCE(recovered.rab_id, '') <> ''
      AND (
        lower(recovered.rab_id) IN (
          SELECT lower(rab_id) FROM members WHERE COALESCE(rab_id, '') <> ''
        )
        OR recovered.id NOT IN (
          SELECT DISTINCT ON (lower(rab_id)) id
          FROM members_deleted_recovery
          WHERE COALESCE(rab_id, '') <> ''
          ORDER BY lower(rab_id), id
        )
      )
  $sql$;

  EXECUTE format(
    'INSERT INTO members (%s) SELECT %s FROM members_deleted_recovery',
    col_list,
    col_list
  );

  GET DIAGNOSTICS restored = ROW_COUNT;
  RAISE NOTICE 'restored % members', restored;
END
$restore$;

ALTER TABLE members SET (autovacuum_enabled = true);
ALTER TABLE assignments SET (autovacuum_enabled = true);
ALTER TABLE tag_requests SET (autovacuum_enabled = true);
ALTER TABLE suppressed_carries SET (autovacuum_enabled = true);
ALTER TABLE meal_assigns SET (autovacuum_enabled = true);

SELECT count(*) AS recovered_rows FROM members_deleted_recovery;
SELECT count(*) AS members_now FROM members;
