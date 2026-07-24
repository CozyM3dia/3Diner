-- idx_logs_cafe(cafe_id) is fully covered by Analytics_Logs_cafe_id_created_at_idx
-- which indexes cafe_id as the leading column. Pure write overhead with no query benefit.
DROP INDEX IF EXISTS idx_logs_cafe;
