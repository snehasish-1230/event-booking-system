import { useEffect, useState } from 'react';
import { resolveImageUrl } from '../../utils/imageUrl';

const EventImage = ({
  src,
  alt,
  className = 'h-full w-full object-cover',
  fallbackClassName = 'flex h-full w-full items-center justify-center bg-gray-100 dark:bg-gray-800',
  fallback,
}) => {
  const imageUrl = resolveImageUrl(src);
  const [failedUrl, setFailedUrl] = useState('');

  useEffect(() => {
    setFailedUrl('');
  }, [imageUrl]);

  if (!imageUrl || failedUrl === imageUrl) {
    return (
      fallback || (
        <div className={fallbackClassName} role="img" aria-label={`${alt || 'Event'} image unavailable`}>
          <svg className="h-10 w-10 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
          </svg>
        </div>
      )
    );
  }

  return (
    <img
      src={imageUrl}
      alt={alt || ''}
      className={className}
      decoding="async"
      onError={() => setFailedUrl(imageUrl)}
    />
  );
};

export default EventImage;
