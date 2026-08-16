BEGIN;

INSERT INTO projects (
  id, code, name, location, region, phase, status, progress, planned_progress,
  manager_name, client_name, contractor_name, contract_value, start_date,
  target_date, working_days_total, next_milestone, next_milestone_date,
  report_recipients, accent
) VALUES (
  'north-gate-residences', 'NGR-01', 'North Gate Residences', 'Gurugram, Haryana',
  'North', 'Structure', 'watch', 42, 46, 'Project Manager', 'Client name',
  'Main contractor', 'Configure in INR', CURRENT_DATE - 120, CURRENT_DATE + 300,
  420, 'Typical floor slab', CURRENT_DATE + 14,
  ARRAY['head-office@example.com'], '#315c4c'
) ON CONFLICT (id) DO NOTHING;

-- Phone numbers remain NULL deliberately so this seed cannot place a real call.
INSERT INTO project_contacts (id, project_id, name, role, phone_e164, preferred_language, call_time, priority)
VALUES
  ('10000000-0000-4000-8000-000000000001', 'north-gate-residences', 'Site Project Manager', 'Project Manager', NULL, 'en-hi', '18:00', 10),
  ('10000000-0000-4000-8000-000000000002', 'north-gate-residences', 'Civil Lead', 'Civil Engineer', NULL, 'en-hi', '18:05', 20),
  ('10000000-0000-4000-8000-000000000003', 'north-gate-residences', 'Safety Lead', 'EHS Manager', NULL, 'hi', '18:10', 30),
  ('10000000-0000-4000-8000-000000000004', 'north-gate-residences', 'Planning Lead', 'Planning Engineer', NULL, 'en', '18:15', 40),
  ('10000000-0000-4000-8000-000000000005', 'north-gate-residences', 'Stores Lead', 'Stores Manager', NULL, 'en-hi', '18:20', 50)
ON CONFLICT (id) DO NOTHING;

INSERT INTO milestones (id, project_id, name, planned_date, forecast_date, progress, status)
VALUES
  ('20000000-0000-4000-8000-000000000001', 'north-gate-residences', 'Typical floor slab', CURRENT_DATE + 12, CURRENT_DATE + 14, 68, 'watch'),
  ('20000000-0000-4000-8000-000000000002', 'north-gate-residences', 'MEP first-fix start', CURRENT_DATE + 35, CURRENT_DATE + 35, 8, 'on-track')
ON CONFLICT (id) DO NOTHING;

INSERT INTO issues (id, project_id, title, description, category, severity, owner_name, impacted_activity, due_date)
VALUES (
  '30000000-0000-4000-8000-000000000001', 'north-gate-residences', 'Example: approval pending',
  'Replace this example issue with the current site constraint.', 'approval', 'high',
  'Project Manager', 'Typical floor slab', CURRENT_DATE + 2
) ON CONFLICT (id) DO NOTHING;

COMMIT;
