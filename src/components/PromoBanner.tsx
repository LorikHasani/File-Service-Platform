import React from 'react';
import { Link } from 'react-router-dom';
import { usePromoBanners } from '@/hooks/useSupabase';
import type { PromoBanner as PromoBannerType } from '@/types/database';

// A single banner image. Wrapped in a link when the banner has a link_url:
//  - internal paths (starting with "/") use react-router navigation
//  - external URLs (http...) open in a new tab
const BannerImage: React.FC<{ banner: PromoBannerType }> = ({ banner }) => {
  const img = (
    <img
      src={banner.image_url}
      alt={banner.title || 'Promotion'}
      className="w-full aspect-[16/5] object-cover"
    />
  );

  const wrapperClass =
    'block rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-sm';

  if (!banner.link_url) {
    return <div className={wrapperClass}>{img}</div>;
  }

  const isInternal = banner.link_url.startsWith('/');
  if (isInternal) {
    return (
      <Link to={banner.link_url} className={`${wrapperClass} hover:opacity-95 transition-opacity`}>
        {img}
      </Link>
    );
  }

  return (
    <a
      href={banner.link_url}
      target="_blank"
      rel="noopener noreferrer"
      className={`${wrapperClass} hover:opacity-95 transition-opacity`}
    >
      {img}
    </a>
  );
};

// Shows all active promo banners stacked. Renders nothing when there are none,
// so it's safe to drop at the top of the dashboard unconditionally.
export const PromoBanner: React.FC = () => {
  const { banners, loading } = usePromoBanners(true);

  if (loading || banners.length === 0) return null;

  return (
    <div className="mb-6 space-y-4">
      {banners.map((banner) => (
        <BannerImage key={banner.id} banner={banner} />
      ))}
    </div>
  );
};
