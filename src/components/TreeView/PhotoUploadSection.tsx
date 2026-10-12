import React, { useRef, useCallback, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { getAvatarFallback } from '../../processing/avatarFallback';
import { computeAge, getAgeCategory } from '../../processing/ageCalculation';
import { compressImage, ImageCompressionError } from '../../processing/imageCompression';
import { UploadIcon, XIcon } from '../Icons';

interface PhotoUploadSectionProps {
  imageUrl: string;
  gender: 'male' | 'female' | 'unknown';
  birthYear: string;
  onImageChange: (url: string) => void;
}

export const PhotoUploadSection: React.FC<PhotoUploadSectionProps> = ({
  imageUrl,
  gender,
  birthYear,
  onImageChange,
}) => {
  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadError(null);
    setProcessing(true);
    try {
      onImageChange(await compressImage(file));
    } catch (error) {
      setUploadError(error instanceof ImageCompressionError && error.reason === 'not-image' ? t.photoNotImage : t.photoProcessFailed);
    } finally {
      setProcessing(false);
    }
  }, [onImageChange, t]);

  const fallback = getAvatarFallback(gender, getAgeCategory(computeAge(birthYear ? parseInt(birthYear, 10) : null, null)));

  return (
    <div className="mf-photo">
      <div className="mf-photo__wrap">
        <button
          type="button"
          className={`mf-photo__circle${imageUrl ? '' : ' mf-photo__circle--empty'}`}
          onClick={() => fileInputRef.current?.click()}
          disabled={processing}
          aria-label={imageUrl ? t.photoChange : t.photoAdd}
        >
          <img
            src={imageUrl || fallback}
            alt=""
            className="mf-photo__img"
            onError={e => { (e.target as HTMLImageElement).src = fallback; }}
          />
          <span className="mf-photo__badge"><UploadIcon size={12} /></span>
        </button>
        {imageUrl && (
          <button type="button" className="mf-photo__clear" onClick={() => onImageChange('')} aria-label={t.removePhoto}>
            <XIcon size={11} />
          </button>
        )}
      </div>
      <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleFileUpload} />
      <div className="mf-photo__text">
        <span className="mf-hint" aria-live="polite">{processing ? t.photoProcessing : t.photoOptionalHint}</span>
        {uploadError && <span className="mf-err" role="alert">{uploadError}</span>}
      </div>
    </div>
  );
};
