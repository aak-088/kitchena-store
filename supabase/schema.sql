-- supabase/schema.sql
-- Run this in Supabase SQL editor to create the initial tables and example RLS guidance

-- Enable pgcrypto for gen_random_uuid()
create extension if not exists pgcrypto;

-- site settings
create table if not exists site_settings (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  value text not null,
  updated_at timestamptz default now()
);

-- categories
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  parent_id uuid references categories(id) on delete set null,
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- products
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique not null,
  description text,
  sku text,
  price numeric not null,
  discount numeric default 0,
  currency text default 'EGP',
  in_stock boolean default true,
  stock integer default 0,
  category_id uuid references categories(id) on delete set null,
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- product images
create table if not exists product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade,
  url text not null,
  alt text,
  "order" integer default 0,
  created_at timestamptz default now()
);

-- banners
create table if not exists banners (
  id uuid primary key default gen_random_uuid(),
  title text,
  subtitle text,
  image_url text,
  link text,
  active boolean default true,
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- testimonials
create table if not exists testimonials (
  id uuid primary key default gen_random_uuid(),
  name text,
  content text,
  avatar_url text,
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- admin_profiles
create table if not exists admin_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_uid text unique,
  username text unique not null,
  role text default 'admin',
  force_password_change boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- orders / inquiries
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  customer_name text,
  phone text,
  email text,
  address text,
  items jsonb,
  total numeric,
  currency text default 'EGP',
  status text default 'new',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Example minimal RLS guidance (enable and adapt in Supabase console):
-- For production, enable RLS and add policies allowing read to anon and write only to admin users.
-- Example: allow anon read on products
-- alter table products enable row level security;
-- create policy "anon_read_products" on products for select using (true);
-- create a function is_admin() returning boolean as $$
--   select exists(select 1 from admin_profiles where auth_uid = current_setting('request.jwt.claim.sub', true));
-- $$ language sql stable;
-- create policy "admin_write_products" on products for insert, update, delete using (is_admin());
