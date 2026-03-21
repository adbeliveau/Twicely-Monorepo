'use client';

import type { ComponentConfig } from '@puckeditor/core';

export interface VideoEmbedBlockProps {
  url: string;
  aspectRatio: '16:9' | '4:3';
}

function getEmbedUrl(url: string): string | null {
  // YouTube
  const ytMatch = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/
  );
  if (ytMatch?.[1]) return `https://www.youtube.com/embed/${ytMatch[1]}`;

  // Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch?.[1]) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;

  return null;
}

export function VideoEmbedBlock({ url, aspectRatio }: VideoEmbedBlockProps) {
  const embedUrl = url ? getEmbedUrl(url) : null;
  const paddingBottom = aspectRatio === '4:3' ? '75%' : '56.25%';

  if (!embedUrl) {
    return (
      <div className="flex items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-8 text-gray-400">
        Paste a YouTube or Vimeo URL
      </div>
    );
  }

  return (
    <div
      className="relative w-full overflow-hidden rounded-lg"
      style={{ paddingBottom }}
    >
      <iframe
        src={embedUrl}
        className="absolute inset-0 h-full w-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        title="Video embed"
      />
    </div>
  );
}

export const videoEmbedBlockConfig: ComponentConfig<VideoEmbedBlockProps> = {
  label: 'Video Embed',
  defaultProps: { url: '', aspectRatio: '16:9' },
  fields: {
    url: { type: 'text', label: 'YouTube or Vimeo URL' },
    aspectRatio: {
      type: 'radio',
      label: 'Aspect Ratio',
      options: [
        { label: '16:9', value: '16:9' },
        { label: '4:3', value: '4:3' },
      ],
    },
  },
  render: (props) => <VideoEmbedBlock {...props} />,
};
