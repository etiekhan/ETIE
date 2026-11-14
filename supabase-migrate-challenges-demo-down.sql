-- ============================================================
-- Etie Challenges Demo — DOWN migration
-- Removes the challenges_demo schema completely.
-- Run after "Reset demo data" wipe.
-- ============================================================

drop schema if exists challenges_demo cascade;
