import React, { useRef, useCallback } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { getAvatarFallback } from '../../processing/avatarFallback';
import { computeAge, getAgeCategory } from '../../processing/ageCalculation';

interface PhotoUploadSectionProps {
  imageUrl: string;
  imageUrlError?: string;
  gender: 'male' | 'female' | 'unknown';
  birthYear: string;
  onImageChange: (url: string) => void;
}

export const PhotoUploadSection: React.FC<PhotoUploadSectionProps> = ({
  imageUrl,
  imageUrlError,
  gender,
  birthYear,
  onImageChange,
}) => {
  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      if (dataUrl) onImageChange(dataUrl);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, [onImageChange]);

  const fallback = getAvatarFallback(gender, getAgeCategory(computeAge(birthYear ? parseInt(birthYear, 10) : null, null)));

  return (
    <div className="member-form__field member-form__field--full">
      <label>{t.labelPhoto}</label>
      <div className="member-form__photo-row">
        {/* ─── Avatar preview ─── */}
        <div className="member-form__photo-preview">
          <img
            src={imageUrl || fallback}
            alt={imageUrl ? "Member photo preview" : "Default avatar"}
            className="member-form__photo-img"
            onError={e => { (e.target as HTMLImageElement).src = fallback; }}
          />
          {imageUrl && (
            <button
              type="button"
              className="member-form__photo-clear"
              onClick={() => onImageChange('')}
              title={t.removePhoto}
            >✕</button>
          )}
        </div>

        {/* ─── Upload + URL inputs ─── */}
        <div className="member-form__photo-inputs">
          {/* Hidden file picker */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleFileUpload}
            aria-label="Upload member photo"
          />
          <button
            type="button"
            className="member-form__photo-upload-btn"
            onClick={() => fileInputRef.current?.click()}
          >
            {t.uploadPhoto}
          </button>
          <span className="member-form__photo-or">{t.pasteUrl}</span>
          <input
            type="url"
            value={imageUrl.startsWith('data:') ? '' : imageUrl}
            onChange={e => onImageChange(e.target.value)}
            className={`member-form__input${imageUrlError ? ' member-form__input--err' : ''}`}
            placeholder={t.placeholderUrl}
          />
          {imageUrlError && <span className="member-form__error">{imageUrlError}</span>}
        </div>
      </div>
    </div>
  );
};
