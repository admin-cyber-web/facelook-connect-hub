-- Multi-image FameFeed posts.
-- Keep media_url populated with the first image for legacy clients.
alter table public.posts
  add column if not exists image_urls text[];

update public.posts
set image_urls = array[media_url]
where (image_urls is null or cardinality(image_urls) = 0)
  and media_url is not null
  and coalesce(type, 'image') = 'image';