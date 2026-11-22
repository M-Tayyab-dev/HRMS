-- Catch-up for 0015_invoices. Databases that had already applied the earlier "0015_extra_email_domains"
-- (later renumbered to 0016) recorded a newer migration timestamp, so Drizzle skipped 0015_invoices on them.
-- This re-applies 0015_invoices exactly once on such databases and does nothing where it already ran.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'billing_invoices' AND column_name = 'number'
  ) THEN
    EXECUTE 'ALTER TABLE "billing_invoices" ADD COLUMN "number" text';
    EXECUTE 'ALTER TABLE "billing_invoices" ADD COLUMN IF NOT EXISTS "kind" text DEFAULT ''SUBSCRIPTION'' NOT NULL';
    EXECUTE 'ALTER TABLE "billing_invoices" ADD COLUMN IF NOT EXISTS "title" text';
    EXECUTE 'ALTER TABLE "billing_invoices" ADD COLUMN IF NOT EXISTS "items" jsonb DEFAULT ''[]''::jsonb NOT NULL';
    EXECUTE 'ALTER TABLE "billing_invoices" ADD COLUMN IF NOT EXISTS "due_date" date';
    EXECUTE 'ALTER TABLE "billing_invoices" ADD CONSTRAINT "billing_invoices_number_unique" UNIQUE("number")';
    EXECUTE 'CREATE SEQUENCE IF NOT EXISTS "billing_invoice_number_seq"';
    -- Number existing invoices in date order, and give them a title and one line (as 0015_invoices does).
    EXECUTE $q$
      WITH numbered AS (
        SELECT id, created_at, row_number() OVER (ORDER BY created_at, id) AS n FROM billing_invoices WHERE number IS NULL
      )
      UPDATE billing_invoices b SET number = 'INV-' || to_char(numbered.created_at, 'YYYY') || '-' || lpad((numbered.n)::text, 5, '0')
      FROM numbered WHERE numbered.id = b.id
    $q$;
    PERFORM setval('billing_invoice_number_seq', GREATEST((SELECT count(*) FROM billing_invoices), 1), (SELECT count(*) FROM billing_invoices) > 0);
    EXECUTE $q$
      UPDATE billing_invoices SET title = plan_name || ' subscription (' || lower(cycle) || ')',
        items = jsonb_build_array(jsonb_build_object('description', plan_name || ' plan, ' || period_start || ' to ' || period_end, 'quantity', 1, 'unitPrice', amount))
      WHERE title IS NULL
    $q$;
  END IF;
  EXECUTE 'ALTER TABLE "platform_settings" ADD COLUMN IF NOT EXISTS "invoice_template" jsonb';
END $$;
