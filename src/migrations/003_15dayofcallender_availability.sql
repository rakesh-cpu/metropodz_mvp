DO $$
DECLARE
    start_date date := '2025-09-01';
    end_date date := '2025-09-15';
    cur_date date;
    pod integer;
BEGIN
    cur_date := start_date;
    WHILE cur_date <= end_date LOOP
        FOR pod IN 1..10 LOOP
            INSERT INTO calendar_availability (calendar_id, pod_id, date, available_slots, max_capacity, notes)
            VALUES (uuid_generate_v4(), pod, cur_date, 
                    CASE 
                      WHEN pod IN (3,8) THEN 0 -- pods under maintenance no availability
                      ELSE 5 -- default 5 slots available
                    END,
                    5,
                    CASE 
                      WHEN pod = 3 THEN 'Maintenance ongoing' 
                      WHEN pod = 8 THEN 'Maintenance - washing machine not available'
                      ELSE NULL 
                    END
                   );
        END LOOP;
        cur_date := cur_date + interval '1 day';
    END LOOP;
END $$;
