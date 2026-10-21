create table public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.categories (
  id text primary key,
  name text not null,
  slug text not null unique,
  description text,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id text primary key,
  name text not null,
  slug text not null unique,
  description text not null,
  dimensions text,
  material text,
  price numeric(12, 2),
  minimum_order_quantity integer,
  featured boolean not null default false,
  in_stock boolean not null default true,
  is_published boolean not null default false,
  category_id text not null references public.categories (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_images (
  id text primary key,
  product_id text not null references public.products (id) on delete cascade,
  url text not null,
  alt_text text,
  is_primary boolean not null default false,
  display_order integer not null default 0,
  storage_path text,
  created_at timestamptz not null default now()
);

create index products_category_id_idx on public.products (category_id);
create index product_images_product_order_idx on public.product_images (product_id, display_order);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

alter table public.admin_users enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;

grant select on public.admin_users to authenticated;
grant select on public.categories to anon, authenticated;
grant insert, update, delete on public.categories to authenticated;
grant select on public.products, public.product_images to anon, authenticated;
grant insert, update, delete on public.products, public.product_images to authenticated;

create policy "Admins can view their own admin record"
  on public.admin_users for select to authenticated
  using (user_id = (select auth.uid()) and (select public.is_admin()));

create policy "Categories are public"
  on public.categories for select to anon, authenticated
  using (true);
create policy "Admins manage categories"
  on public.categories for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Published products are public"
  on public.products for select to anon, authenticated
  using (is_published);
create policy "Admins manage products"
  on public.products for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Published product images are public"
  on public.product_images for select to anon, authenticated
  using (
    exists (
      select 1
      from public.products
      where products.id = product_images.product_id
        and products.is_published
    )
  );
create policy "Admins manage product images"
  on public.product_images for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create or replace function public.admin_save_product(p_product jsonb, p_images jsonb)
returns void
language plpgsql
set search_path = ''
as $$
begin
  insert into public.products (
    id, name, slug, description, dimensions, material, price,
    minimum_order_quantity, featured, in_stock, is_published, category_id
  )
  values (
    p_product->>'id',
    p_product->>'name',
    p_product->>'slug',
    p_product->>'description',
    nullif(p_product->>'dimensions', ''),
    nullif(p_product->>'material', ''),
    nullif(p_product->>'price', '')::numeric,
    nullif(p_product->>'minimum_order_quantity', '')::integer,
    (p_product->>'featured')::boolean,
    (p_product->>'in_stock')::boolean,
    (p_product->>'is_published')::boolean,
    p_product->>'category_id'
  )
  on conflict (id) do update set
    name = excluded.name,
    slug = excluded.slug,
    description = excluded.description,
    dimensions = excluded.dimensions,
    material = excluded.material,
    price = excluded.price,
    minimum_order_quantity = excluded.minimum_order_quantity,
    featured = excluded.featured,
    in_stock = excluded.in_stock,
    is_published = excluded.is_published,
    category_id = excluded.category_id,
    updated_at = now();

  delete from public.product_images
  where product_id = p_product->>'id';

  insert into public.product_images (
    id, product_id, url, alt_text, is_primary, display_order, storage_path
  )
  select
    image.id,
    p_product->>'id',
    image.url,
    image.alt_text,
    image.is_primary,
    image.display_order,
    image.storage_path
  from jsonb_to_recordset(coalesce(p_images, '[]'::jsonb)) as image(
    id text,
    url text,
    alt_text text,
    is_primary boolean,
    display_order integer,
    storage_path text
  );
end;
$$;

revoke all on function public.admin_save_product(jsonb, jsonb) from public;
grant execute on function public.admin_save_product(jsonb, jsonb) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Product images are publicly readable"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'product-images');
create policy "Admins upload product images"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and (select public.is_admin()));
create policy "Admins update product images"
  on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and (select public.is_admin()))
  with check (bucket_id = 'product-images' and (select public.is_admin()));
create policy "Admins delete product images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and (select public.is_admin()));

insert into public.categories (id, name, slug, description, image_url) values
  ('cmnpysppm0001ujnqhm0om4h7', 'Living Room', 'living-room', 'Sofas, coffee tables, TV units and more', 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600'),
  ('cmnpyspps0002ujnqvyfbipoe', 'Bedroom', 'bedroom', 'Beds, wardrobes, dressers and nightstands', 'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?w=600'),
  ('cmnpysppy0003ujnq8zgg8e9e', 'Dining', 'dining', 'Dining tables, chairs and sideboards', 'https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=600'),
  ('cmnpyspq40004ujnqhb8599xj', 'Office', 'office', 'Desks, office chairs and storage solutions', 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=600'),
  ('cmnpyspqa0005ujnqluieiura', 'Outdoor', 'outdoor', 'Garden furniture and outdoor seating', 'https://images.unsplash.com/photo-1600210492493-0946911123ea?w=600'),
  ('cmnpyspqg0006ujnq8okn1lt0', 'Storage', 'storage', 'Bookshelves, cabinets and storage units', 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600');

insert into public.products (
  id, name, slug, description, dimensions, material, price,
  minimum_order_quantity, featured, in_stock, is_published, category_id, created_at, updated_at
) values
  ('cmnpyspqs0008ujnq7fwxumcv', 'Artisan Oak Sofa', 'artisan-oak-sofa', 'Handcrafted solid oak sofa with premium fabric upholstery. Perfect for modern and traditional homes alike.', 'W220 x D85 x H85 cm', 'Solid Oak, Premium Fabric', 45000, 10, true, true, true, 'cmnpysppm0001ujnqhm0om4h7', '2026-04-08T11:28:24Z', '2026-04-08T11:28:24Z'),
  ('cmnpyspr7000eujnq1jr8j14x', 'Heritage King Bed', 'heritage-king-bed', 'Majestic king-sized bed with hand-carved headboard. Made from premium teak wood with mortise and tenon joints.', 'W200 x D220 x H140 cm', 'Premium Teak Wood', 65000, 5, true, true, true, 'cmnpyspps0002ujnqvyfbipoe', '2026-04-08T11:28:24Z', '2026-04-08T11:28:24Z'),
  ('cmnpyspri000iujnqp9e579tm', 'Manor Dining Table', 'manor-dining-table', '8-seater dining table crafted from reclaimed wood. Each piece is unique with natural character marks.', 'W240 x D100 x H76 cm', 'Reclaimed Mango Wood', 38000, 8, true, true, true, 'cmnpysppy0003ujnq8zgg8e9e', '2026-04-08T11:28:24Z', '2026-04-08T11:28:24Z'),
  ('cmnpysprt000mujnqf0k73me3', 'Executive Work Desk', 'executive-work-desk', 'Spacious executive desk with built-in cable management and modesty panel. Ideal for corporate offices.', 'W180 x D80 x H76 cm', 'Solid Sheesham Wood', 28000, 20, false, true, true, 'cmnpyspq40004ujnqhb8599xj', '2026-04-08T11:28:24Z', '2026-04-08T11:28:24Z'),
  ('cmnpysps4000qujnqlg5weiyf', 'Rajwada Wardrobe', 'rajwada-wardrobe', 'Grand 6-door wardrobe with intricate brass inlay work. Combines traditional craftsmanship with modern storage solutions.', 'W250 x D60 x H220 cm', 'Solid Teak, Brass Fittings', 85000, 3, true, true, true, 'cmnpyspps0002ujnqvyfbipoe', '2026-04-08T11:28:24Z', '2026-04-08T11:28:24Z'),
  ('cmnpyspsf000uujnqn9ououx3', 'Lotus Coffee Table', 'lotus-coffee-table', 'Low-profile coffee table with hand-carved lotus motif. Perfect centerpiece for any living room.', 'W120 x D60 x H45 cm', 'Solid Rosewood', 18000, 15, false, true, true, 'cmnpysppm0001ujnqhm0om4h7', '2026-04-08T11:28:24Z', '2026-04-08T11:28:24Z');

insert into public.product_images (id, product_id, url, alt_text, is_primary, display_order) values
  ('cmnpyspqx000aujnqg1l5wods', 'cmnpyspqs0008ujnq7fwxumcv', 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800', 'Artisan Oak Sofa', true, 0),
  ('cmnpyspr2000cujnqjfx7bs82', 'cmnpyspqs0008ujnq7fwxumcv', 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800', 'Artisan Oak Sofa', false, 1),
  ('cmnpysprd000gujnq5xl91kzu', 'cmnpyspr7000eujnq1jr8j14x', 'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?w=800', 'Heritage King Bed', true, 0),
  ('cmnpysprn000kujnqlnn2aepy', 'cmnpyspri000iujnqp9e579tm', 'https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=800', 'Manor Dining Table', true, 0),
  ('cmnpyspry000oujnqmidqn5c2', 'cmnpysprt000mujnqf0k73me3', 'https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=800', 'Executive Work Desk', true, 0),
  ('cmnpysps9000sujnqxcugoc1o', 'cmnpysps4000qujnqlg5weiyf', 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800', 'Rajwada Wardrobe', true, 0),
  ('cmnpyspsk000wujnqhcuenafy', 'cmnpyspsf000uujnqn9ououx3', 'https://images.unsplash.com/photo-1533090481720-856c6e3c1fdc?w=800', 'Lotus Coffee Table', true, 0);
