import { useEffect } from 'react';
import './AvatarPreviewModal.css';

const AVATAR_PREVIEW_HISTORY_KEY = '__avatarPreviewOpen';

export default function AvatarPreviewModal({
  imageUrl,
  alt,
  onClose,
}: {
  imageUrl: string;
  alt: string;
  onClose: () => void;
}) {
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const currentState = typeof window.history.state === 'object' && window.history.state !== null
      ? window.history.state
      : {};

    window.history.pushState({ ...currentState, [AVATAR_PREVIEW_HISTORY_KEY]: true }, '');

    const handlePopState = () => {
      onClose();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        handleDismiss();
      }
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const handleDismiss = () => {
    if (
      typeof window !== 'undefined'
      && typeof window.history.state === 'object'
      && window.history.state !== null
      && window.history.state[AVATAR_PREVIEW_HISTORY_KEY]
    ) {
      window.history.back();
      return;
    }

    onClose();
  };

  return (
    <div className="modal-overlay modal-center avatar-preview-overlay" onClick={handleDismiss}>
      <div className="avatar-preview-shell" onClick={(event) => event.stopPropagation()}>
        <img src={imageUrl} alt={alt} className="avatar-preview-image" />
      </div>
    </div>
  );
}
