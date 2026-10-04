import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useLanguage } from '../../context/LanguageContext';
import { StyledFamilyMember, AvatarStyle } from '../../types/FamilyTypes';
import { BabyIcon, HeartIcon, MoreVerticalIcon, PencilIcon, Trash2Icon } from '../Icons';
import { getAvatarFallback } from '../../processing/avatarFallback';
import {
  getInitials,
  getAgeCategoryBgColor,
  getAvatarEmoji,
  getFaAvatarBg,
  getFaIconClass,
  getFaIconColor,
} from '../../processing/avatarHelpers';

// ─── Person Node (circle + name + dates + hover menu) ───

export const PersonNode = React.memo<{
  member: StyledFamilyMember;
  isSelected: boolean;
  isHighlighted: boolean | null;
  isHidden?: boolean;
  isFormerSpouse?: boolean;
  relRole?: 'source' | 'target' | 'path' | 'blood-path' | null;
  relStep?: 1 | 2 | null;
  showMarriageBadge?: boolean;
  avatarStyle: AvatarStyle;
  onClick: (id: string) => void;
  onMenuAction: (action: 'edit' | 'addChild' | 'addSpouse' | 'delete', memberId: string) => void;
}>(({ member, isSelected, isHighlighted, isHidden, isFormerSpouse, relRole, relStep, showMarriageBadge, avatarStyle, onClick, onMenuAction }) => {
  const { t, lang } = useLanguage();
  const displayName = lang === 'mr' && member.firstName_mr && (member.lastName_mr || !member.lastName)
    ? `${member.firstName_mr} ${member.lastName_mr || ''}`.trim()
    : member.fullName;
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top?: number; bottom?: number; left: number }>({ left: 0 });
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const prevMenuOpen = useRef(false);
  const highlightClass = isHighlighted === null ? '' : isHighlighted ? 'pnode--highlight' : 'pnode--dimmed';
  const hiddenClass = isHidden ? 'pnode--hidden' : '';
  const formerClass = isFormerSpouse ? 'pnode--former-spouse' : '';
  const relClass = relRole ? `pnode--rel-${relRole}` : '';

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        menuBtnRef.current && !menuBtnRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false);
        setConfirmDelete(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  // Return focus to menu button when menu closes
  useEffect(() => {
    if (prevMenuOpen.current && !menuOpen) {
      menuBtnRef.current?.focus();
    }
    prevMenuOpen.current = menuOpen;
  }, [menuOpen]);

  const openMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (menuOpen) { setMenuOpen(false); setConfirmDelete(false); return; }
    const rect = menuBtnRef.current?.getBoundingClientRect();
    if (!rect) return;
    const menuH = 165; // approximate height of the menu
    const menuW = 148;
    const flipUp = window.innerHeight - rect.bottom < menuH + 8 && rect.top >= menuH + 8;
    setMenuPos({
      top:    flipUp ? undefined : rect.bottom + 4,
      bottom: flipUp ? window.innerHeight - rect.top + 4 : undefined,
      left:   Math.max(8, Math.min(rect.right - menuW, window.innerWidth - menuW - 8)),
    });
    setMenuOpen(true);
  };

  const handleMenuAction = (action: 'edit' | 'addChild' | 'addSpouse' | 'delete') => {
    if (action === 'delete') {
      setConfirmDelete(true);
      return;
    }
    setMenuOpen(false);
    onMenuAction(action, member.id);
  };

  // Legal marriage age in India: 18 for female, 21 for male
  const minMarriageAge = member.gender === 'female' ? 18 : 21;
  const isMarriageEligible = member.age === null || member.age >= minMarriageAge;

  return (
    <div
      className={`pnode ${isSelected ? 'pnode--sel' : ''} ${highlightClass} ${hiddenClass} ${formerClass} ${relClass} ${menuOpen ? 'pnode--menu-open' : ''}`}
      data-member-id={member.id}
    >
      <div
        className="pnode__circle"
        style={{
          borderColor: member.nodeBorderColorHex,
          boxShadow: isSelected ? `0 0 0 4px ${member.baseColorHex}44` : undefined,
        }}
        onClick={() => onClick(member.id)}
        onKeyDown={e => {          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(member.id); }
          if (e.key === 'ArrowRight' || e.key === 'ContextMenu') { e.preventDefault(); menuBtnRef.current?.click(); }
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
            e.preventDefault();
            const allCircles = Array.from(
              document.querySelectorAll<HTMLElement>('.pnode__circle[role="button"]')
            );
            const current = e.currentTarget as HTMLElement;
            const cr = current.getBoundingClientRect();
            const cx = cr.left + cr.width / 2;
            const cy = cr.top + cr.height / 2;
            let best: HTMLElement | null = null;
            let bestScore = Infinity;
            for (const circle of allCircles) {
              if (circle === current) continue;
              const r = circle.getBoundingClientRect();
              const tx = r.left + r.width / 2;
              const ty = r.top + r.height / 2;
              const dx = tx - cx;
              const dy = ty - cy;
              const inDir =
                (e.key === 'ArrowUp'   && dy < 0) ||
                (e.key === 'ArrowDown' && dy > 0) ||
                (e.key === 'ArrowLeft' && dx < 0);
              if (!inDir) continue;
              const primary   = e.key === 'ArrowLeft' ? Math.abs(dx) : Math.abs(dy);
              const secondary = e.key === 'ArrowLeft' ? Math.abs(dy) : Math.abs(dx);
              const score = primary + secondary * 2;
              if (score < bestScore) { bestScore = score; best = circle; }
            }
            best?.focus();
          }
        }}
        tabIndex={0}
        role="button"
        title={relStep != null
          ? (relStep === 1 ? `${displayName} — ${t.tracerSelectHint1}` : `${displayName} — ${t.tracerSelectHint2}`)
          : undefined}
        aria-label={relStep != null
          ? `${displayName}. ${relStep === 1 ? t.tracerSelectHint1 : t.tracerSelectHint2}`
          : `${displayName}, ${member.birthYear ?? t.unknownYear}–${member.deathYear ?? t.present}. ${t.ariaKeyboardHint}`}
        aria-pressed={isSelected}
      >
        {member.imageConfig.imageSourceType === 'provided' ? (
          <img
            loading="lazy"
            src={member.imageConfig.finalImageUrl}
            alt={displayName}
            onError={e => {
              const img = e.target as HTMLImageElement;
              if (img.dataset.fallbackApplied) return;
              img.dataset.fallbackApplied = 'true';
              img.src = getAvatarFallback(member.gender, member.ageCategory);
            }}
          />
        ) : avatarStyle.startsWith('silhouette') ? (
          <div
            className="pnode__avatar-fa"
            style={{ background: getFaAvatarBg(member.ageCategory, member.gender, avatarStyle) }}
          >
            <i
              className={`fa-solid ${getFaIconClass(member.gender, member.ageCategory)}`}
              style={{ color: getFaIconColor(member.gender, avatarStyle) }}
            />
          </div>
        ) : avatarStyle === 'initials' ? (
          <div
            className="pnode__avatar-initials"
            style={{ background: `${member.baseColorHex}28`, color: member.nodeBorderColorHex }}
          >
            {getInitials(displayName)}
          </div>
        ) : (
          <div
            className="pnode__avatar-emoji"
            style={{ background: getAgeCategoryBgColor(member.ageCategory) }}
          >
            {getAvatarEmoji(member.gender, member.ageCategory)}
          </div>
        )}
        {showMarriageBadge && (
          <span className="pnode__marriage-badge" title={t.badgeMarriageEligible(member.gender === 'female' ? '18+' : '21+')}>💍</span>
        )}
      </div>
      <div className="pnode__name" title={displayName} onClick={() => onClick(member.id)}>{displayName}</div>
      <div className="pnode__dates" onClick={() => onClick(member.id)}>
        {member.birthYear ?? t.unknownYear} - {member.deathYear ?? t.present}
      </div>

      {/* ⋮ hover action button */}
      <button
        ref={menuBtnRef}
        className="pnode__menu-btn"
        onClick={openMenu}
        aria-label={`Open menu for ${displayName}`}
        aria-expanded={menuOpen}
        aria-haspopup="menu"
      >
        <MoreVerticalIcon size={14} />
      </button>

      {/* Menu rendered via portal so it escapes zoom/overflow clipping */}
      {menuOpen && ReactDOM.createPortal(
        <div
          ref={menuRef}
          className="pnode__menu"
          role="menu"
          aria-label={`Actions for ${displayName}`}
          style={{
            position: 'fixed',
            top: menuPos.top,
            bottom: menuPos.bottom,
            left: menuPos.left,
            zIndex: 2000,
          }}
        >
          <button className="pnode__menu-item" role="menuitem" onClick={() => handleMenuAction('edit')}>
            <PencilIcon size={13} style={{ verticalAlign: 'middle', marginRight: 6 }} />
            {t.menuEdit}
          </button>
          {(member.spouseIds?.length ?? (member.spouseId ? 1 : 0)) > 0 && (
            <button className="pnode__menu-item" role="menuitem" onClick={() => handleMenuAction('addChild')}>
              <BabyIcon size={13} style={{ verticalAlign: 'middle', marginRight: 6 }} />
              {t.menuAddChild}
            </button>
          )}
          {isMarriageEligible
            ? <button className="pnode__menu-item" role="menuitem" onClick={() => handleMenuAction('addSpouse')}>
                <HeartIcon size={13} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                {t.menuAddSpouse}
              </button>
            : <button
                className="pnode__menu-item pnode__menu-item--disabled"
                role="menuitem"
                title={t.tooltipMarriageAge(minMarriageAge, member.age ?? 0)}
                disabled
              >
                <HeartIcon size={13} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                {t.menuAddSpouse}
              </button>
          }
          {confirmDelete ? (
            <div className="pnode__menu-confirm">
              <span className="pnode__menu-confirm__label">{t.confirmDeleteNode}</span>
              <button
                className="pnode__menu-item pnode__menu-item--danger"
                onClick={() => { setMenuOpen(false); setConfirmDelete(false); onMenuAction('delete', member.id); }}
              >
                {t.btnYesDelete}
              </button>
              <button
                className="pnode__menu-item"
                onClick={() => setConfirmDelete(false)}
              >
                {t.btnCancel}
              </button>
            </div>
          ) : (
            <button className="pnode__menu-item pnode__menu-item--danger" onClick={() => handleMenuAction('delete')}>
              <Trash2Icon size={13} style={{ verticalAlign: 'middle', marginRight: 6 }} />
              {t.menuDelete}
            </button>
          )}
        </div>,
        document.body
      )}
    </div>
  );
});

PersonNode.displayName = 'PersonNode';
