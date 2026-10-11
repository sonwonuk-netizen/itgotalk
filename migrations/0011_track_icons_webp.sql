-- Site images moved to WebP (public/site/*.webp); track icons are stored here too.
update tracks set icon = replace(replace(icon, '.png', '.webp'), '.jpg', '.webp')
where icon like '/site/%.png' or icon like '/site/%.jpg';
