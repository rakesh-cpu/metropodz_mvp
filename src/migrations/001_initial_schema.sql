CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS USERS(
    id serial primary key,
    user_id uuid not null unique default uuid_generate_v4(),
    name varchar(128) not null,
    email varchar(128) not null unique,
    phone_number varchar(64) not null unique,
    country_code varchar(16) not null,
    internationalized_phone_number varchar(64) not null,
    password_hash varchar(255) not null,
    user_type varchar(32) default 'regular',
    area varchar(128),
    address varchar(128),
    city varchar(64),
    state varchar(64),
    country varchar(64),
    pincode varchar(32),
    location geography(point,4326),
    created_at timestamp default now(),
    updated_at timestamp default now()
);

CREATE TABLE IF NOT EXISTS POD_LOCATION(
    id serial primary key,
    pod_location_id uuid not null unique default uuid_generate_v4(),
    area varchar(128),
    city varchar(64),
    state varchar(64),
    country varchar(64),
    pincode varchar(32),
    nearby_place text[]
);

CREATE TYPE status_enum_type as enum('available','occupied','maintenance');

CREATE TABLE IF NOT EXISTS PODS(
    id serial primary key,
    pod_id uuid not null unique default uuid_generate_v4(),
    pod_number varchar(32) not null,
    description text,
    location_id integer references pod_location(id) on delete set null,
    status status_enum_type not null default 'available',
    address varchar(128),
    coordinates geography(point,4326) not null,
    price_per_hour numeric(10,2) not null default 100.00,
    max_capacity integer not null default 1,
    created_at timestamp not null default now(),
    updated_at timestamp not null default now()
);

CREATE TABLE IF NOT EXISTS AMENITIES(
    id serial primary key,
    name varchar(64) unique not null,
    amenity_icon text
);

CREATE TABLE IF NOT EXISTS POD_AMENITIES(
    pod_id integer references pods(id) on delete cascade,
    amenity_id integer references amenities(id) on delete cascade,
    primary key (pod_id,amenity_id)
);

CREATE TYPE booking_status_type_enum AS ENUM('confirmed','cancelled','pending');

CREATE TABLE IF NOT EXISTS BOOKINGS(
    id serial primary key,
    booking_id uuid not null unique default uuid_generate_v4(),
    user_id integer not null,
    pod_id integer not null,
    booking_status booking_status_type_enum not null,
    check_in timestamp not null,
    check_out timestamp not null,
    created_at timestamp default now(),
    updated_at timestamp default now(),
    total_price numeric(10,2) not null,
    FOREIGN KEY (user_id) REFERENCES users(id) on delete cascade,
    FOREIGN KEY (pod_id) REFERENCES pods(id) on delete cascade
);

CREATE TABLE IF NOT EXISTS CALENDAR_AVAILABILITY(
    id serial primary key,
    calendar_id uuid not null default uuid_generate_v4(),
    pod_id integer not null,
    date date not null,
    available_slots integer not null,
    max_capacity integer not null,
    notes text null,
    FOREIGN KEY (pod_id) REFERENCES pods(id) on delete cascade
);

CREATE TYPE payment_status_type_enum as ENUM('pending','failed','refund','successful');

CREATE TABLE IF NOT EXISTS PAYMENTS(
    id serial primary key,
    payment_id uuid not null unique default uuid_generate_v4(),
    booking_id integer not null,
    payment_method varchar(50) not null,
    payment_status payment_status_type_enum,
    amount numeric(10,2) not null,
    payment_date timestamp default now(),
    transaction_reference varchar(100),
    FOREIGN KEY(booking_id) REFERENCES bookings(id) on delete cascade
);

CREATE TYPE access_key_status_type_enum as ENUM('active','expired','revoked');

CREATE TABLE IF NOT EXISTS ACCESS_CODE(
    id serial primary key,
    access_id uuid not null unique default uuid_generate_v4(),
    booking_id integer not null,
    access_qr_code text not null,
    access_pin varchar(10) not null,
    valid_from timestamp not null,
    valid_until timestamp not null,
    status access_key_status_type_enum,
    created_at timestamp default now(),
    FOREIGN KEY (booking_id) REFERENCES bookings(id) on delete cascade
);

CREATE TABLE IF NOT EXISTS BOOKING_STATUS_HISTORY(
    id serial primary key,
    history_id uuid not null unique default uuid_generate_v4(),
    booking_id integer not null,
    old_status varchar(20) not null,
    new_status varchar(20) not null,
    changed_at timestamp default now(),
    changed_by varchar(100),
    FOREIGN KEY (booking_id) references bookings(id) on delete cascade
);
-- CREATE INDEX idx_pod_location_coordinates ON pods USING GIST(coordinates);
-- CREATE INDEX idx_users_location ON users USING GIST(location);