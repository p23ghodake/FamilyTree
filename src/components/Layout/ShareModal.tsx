import React, { useState, useEffect, useCallback, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import LZString from 'lz-string';
import { useFamilyTree } from '../../context/FamilyTreeContext';
import { useLanguage } from '../../context/LanguageContext';
import { CONFIG } from '../../constants/config';
import { XIcon } from '../Icons';
import './ShareModal.css';

// QR v40 max ≈ 2953 bytes binary. Use CONFIG.share.QR_MAX_LENGTH as safe threshold.
const QR_MAX_LENGTH = CONFIG.share.QR_MAX_LENGTH;

interface ShareModalProps {
  onClose: () => void;
}

function buildShareUrl(jsonData: object): string {
  const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(jsonData));
  return `${window.location.origin}${window.location.pathname}?tree=${compressed}`;
}

const ShareModal: React.FC<ShareModalProps> = ({ onClose }) => {
  const { state } = useFamilyTree();
  const { t } = useLanguage();
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.data) setShareUrl(buildShareUrl(state.data));
  }, [state.data]);

  const qrFits = shareUrl.length > 0 && shareUrl.length <= QR_MAX_LENGTH;

  const handleCopy = useCallback(() => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl)
      .catch(() => {
        inputRef.current?.select();
        document.execCommand('copy');
      })
      .finally(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
  }, [shareUrl]);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  const sizeKb = (shareUrl.length / 1024).toFixed(1);

  return (
    <div className="share-modal__backdrop" onClick={handleBackdropClick}>
      <div className="share-modal">
        <div className="share-modal__header">
          <span className="share-modal__title">{t.shareTitle}</span>
          <button className="share-modal__close" onClick={onClose} aria-label={t.close}>
            <XIcon size={16} />
          </button>
        </div>

        <div className="share-modal__body">
          {!shareUrl && <p className="share-modal__hint">{t.shareNoData}</p>}

          {shareUrl && (
            <>
              {/* ── QR code (only when data fits) ── */}
              {qrFits ? (
                <>
                  <div className="share-modal__qr-wrap">
                    <QRCodeSVG
                      value={shareUrl}
                      size={200}
                      bgColor="#ffffff"
                      fgColor="#1e293b"
                      level="M"
                      includeMargin
                    />
                  </div>
                  <p className="share-modal__hint">{t.shareQrHint}</p>
                </>
              ) : (
                <div className="share-modal__qr-too-large">
                  <span className="share-modal__qr-too-large-icon">📋</span>
                  <p className="share-modal__qr-too-large-title">{t.shareQrTooLargeTitle}</p>
                  <p className="share-modal__qr-too-large-sub">
                    {t.shareQrTooLargeSub(sizeKb)}
                  </p>
                </div>
              )}

              {/* ── Copy link (always shown) ── */}
              <div className="share-modal__url-row">
                <input
                  ref={inputRef}
                  className="share-modal__url-input"
                  type="text"
                  readOnly
                  value={shareUrl}
                  onClick={e => (e.target as HTMLInputElement).select()}
                />
                <button
                  className={`share-modal__copy-btn${copied ? ' share-modal__copy-btn--copied' : ''}`}
                  onClick={handleCopy}
                >
                  {copied ? t.shareCopied : t.shareCopy}
                </button>
              </div>

              <p className="share-modal__note">
                {qrFits ? t.shareNoteQr : t.shareNoteLink}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShareModal;
