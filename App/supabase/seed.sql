-- Local reset seed intentionally contains no business rows.
-- Production-like fixtures belong in integration tests and must be isolated.
create extension if not exists pgcrypto;
