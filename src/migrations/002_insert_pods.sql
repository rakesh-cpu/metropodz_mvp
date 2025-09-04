-- Insert 3 pod locations in Hyderabad
INSERT INTO pod_location(pod_location_id, area, city, state, country, pincode, nearby_place)
VALUES
(uuid_generate_v4(), 'Banjara Hills', 'Hyderabad', 'Telangana', 'India', '500034', ARRAY['RP Road','Taher Nagar']),
(uuid_generate_v4(), 'Madhapur', 'Hyderabad', 'Telangana', 'India', '500081',ARRAY['Cyber Towers','Data Center']),
(uuid_generate_v4(), 'Jubilee Hills','Hyderabad','Telangana', 'India', '500033',ARRAY['Peddamma Temple','KBR Park']);

-- Insert 10 pods distributed in the above locations
INSERT INTO pods (pod_id, pod_number, description, location_id, status, address, coordinates, price_per_hour, created_at, updated_at)
VALUES
(uuid_generate_v4(), 'Pod-101', 'Single seat workspace with balcony', 1, 'available','Near Road No. 10',ST_SetSRID(ST_MakePoint(78.4749, 17.4165),4326), 150.00, now(), now()),
(uuid_generate_v4(), 'Pod-102', 'Double seat workspace with AC and fan', 1, 'available','Tech Park Lane', ST_SetSRID(ST_MakePoint(78.4749, 17.4165),4326), 200.00, now(), now()),
(uuid_generate_v4(), 'Pod-103', 'Single seat workspace near window', 1, 'maintenance','Jubilee Hills Road No.36', ST_SetSRID(ST_MakePoint(78.4749, 17.4165),4326), 150.00, now(), now()),
(uuid_generate_v4(), 'Pod-201', 'Triple seat workspace with sofa', 2, 'available','Jubilee Hills Road No.26', ST_SetSRID(ST_MakePoint(78.4849, 17.4165),4326), 300.00, now(), now()),
(uuid_generate_v4(), 'Pod-202', 'Quiet workspace with oven access', 2, 'occupied','Near Care hospitals', ST_SetSRID(ST_MakePoint(78.4749, 17.4165),4326), 180.00, now(), now()),
(uuid_generate_v4(), 'Pod-203', 'Workspace with AC and fan', 2, 'available','Banjara hills road number 12', ST_SetSRID(ST_MakePoint(78.4749, 17.4165),4326), 200.00, now(), now()),
(uuid_generate_v4(), 'Pod-301', 'Private workspace with balcony', 3, 'available','Tech park', ST_SetSRID(ST_MakePoint(78.4749, 17.4165),4326), 250.00, now(), now()),
(uuid_generate_v4(), 'Pod-302', 'Shared workspace with washing machine access', 3, 'maintenance','Near cyber towers', ST_SetSRID(ST_MakePoint(78.4749, 17.4165),4326), 220.00, now(), now()),
(uuid_generate_v4(), 'Pod-303', 'Single seat workspace with sofa and AC', 3, 'available','Near lotus pod', ST_SetSRID(ST_MakePoint(78.4749, 17.4165),4326), 180.00, now(), now()),
(uuid_generate_v4(), 'Pod-304', 'Double seat workspace with oven', 3, 'available','Jubilee Hills Road No.26', ST_SetSRID(ST_MakePoint(78.4749, 17.4165),4326), 200.00, now(), now());

-- Insert amenities
INSERT INTO amenities (name, amenity_icon)
VALUES
('sofa', 'sofa_icon.svg'),
('washing_machine', 'washing_machine_icon.svg'),
('fan', 'fan_icon.svg'),
('ac', 'ac_icon.svg'),
('oven', 'oven_icon.svg'),
('balcony', 'balcony_icon.svg');

-- Link pods and amenities
INSERT INTO pod_amenities (pod_id, amenity_id)
VALUES
(1, (SELECT id FROM amenities WHERE name = 'balcony')),
(2, (SELECT id FROM amenities WHERE name = 'ac')),
(2, (SELECT id FROM amenities WHERE name = 'fan')),
(4, (SELECT id FROM amenities WHERE name = 'sofa')),
(5, (SELECT id FROM amenities WHERE name = 'oven')),
(6, (SELECT id FROM amenities WHERE name = 'ac')),
(6, (SELECT id FROM amenities WHERE name = 'fan')),
(7, (SELECT id FROM amenities WHERE name = 'balcony')),
(8, (SELECT id FROM amenities WHERE name = 'washing_machine')),
(9, (SELECT id FROM amenities WHERE name = 'sofa')),
(9, (SELECT id FROM amenities WHERE name = 'ac')),
(10, (SELECT id FROM amenities WHERE name = 'oven'));
