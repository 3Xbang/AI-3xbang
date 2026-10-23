-- Link old maintenance tickets (customer_user_id IS NULL) to owner accounts
-- by matching customer_name to users.full_name or users.username (case-insensitive)
UPDATE maintenance_tickets mt
SET customer_user_id = u.id
FROM users u
WHERE mt.customer_user_id IS NULL
  AND u.role = 'owner'
  AND (
    LOWER(mt.customer_name) = LOWER(u.full_name)
    OR LOWER(mt.customer_name) = LOWER(u.username)
    OR LOWER(u.full_name) LIKE '%' || LOWER(mt.customer_name) || '%'
  );

SELECT 'Updated: ' || COUNT(*) || ' old tickets linked to owner accounts'
FROM maintenance_tickets
WHERE customer_user_id IS NOT NULL;
