import React, { useEffect, useMemo, useState } from 'react';
import { useFamilyTree } from '../../context/FamilyTreeContext';
import { useLanguage } from '../../context/LanguageContext';
import { StyledFamilyMember } from '../../types/FamilyTypes';
import { getDisplayFirstName } from '../../processing/displayName';
import { PencilIcon, XIcon } from '../Icons';
import { MemberAvatar } from './MemberAvatar';
import './MemberDetailsPanel.css';

const NOTES_PREVIEW_LENGTH = 90;

function displayFullName(member: StyledFamilyMember, lang: string): string {
  if (lang === 'mr' && (member.firstName_mr || member.lastName_mr)) {
    return `${member.firstName_mr ?? member.firstName} ${member.lastName_mr ?? member.lastName}`;
  }
  return member.fullName;
}

const MemberDetailsPanel: React.FC = () => {
  const { state, dispatch, currentTree, canEdit, isSaving } = useFamilyTree();
  const { t, lang } = useLanguage();
  const visible = !!state.selectedMemberId && !state.relMode && !state.memberFormMode;
  const member = visible ? currentTree?.members.find(m => m.id === state.selectedMemberId) : undefined;
  const [notesOpen, setNotesOpen] = useState(false);
  const memberId = member?.id;
  useEffect(() => setNotesOpen(false), [memberId]);

  const relatives = useMemo(() => {
    if (!member || !currentTree) return null;
    const byId = new Map(currentTree.members.map(m => [m.id, m]));
    const pick = (ids: string[]) => ids.map(id => byId.get(id)).filter((m): m is StyledFamilyMember => !!m);
    const { parentChild, spouses } = currentTree.relationships;
    return {
      parents: pick(parentChild.filter(r => r.childId === member.id).map(r => r.parentId)),
      children: pick(parentChild.filter(r => r.parentId === member.id).map(r => r.childId)),
      spouses: spouses
        .filter(r => r.spouse1Id === member.id || r.spouse2Id === member.id)
        .map(r => ({ member: byId.get(r.spouse1Id === member.id ? r.spouse2Id : r.spouse1Id), former: r.status !== 'current' }))
        .filter((s): s is { member: StyledFamilyMember; former: boolean } => !!s.member),
    };
  }, [member, currentTree]);

  useEffect(() => {
    if (!member) return;
    const onKeyDown = (event: KeyboardEvent) => {
      // Modal dialogs own Escape while they are open.
      if (event.key !== 'Escape' || event.defaultPrevented || document.querySelector('[aria-modal="true"]')) return;
      dispatch({ type: 'SELECT_MEMBER', payload: null });
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [member, dispatch]);

  if (!member || !relatives) return null;

  const name = displayFullName(member, lang);
  const otherName = lang === 'mr' ? member.fullName : [member.firstName_mr, member.lastName_mr].filter(Boolean).join(' ');
  const formatDate = (iso: string | null | undefined, year: number | null) => {
    const match = iso?.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
    if (!match) return year !== null ? String(year) : null;
    const month = t.months[Number(match[2]) - 1];
    return [match[3] ? String(Number(match[3])) : '', month, match[1]].filter(Boolean).join(' ');
  };
  const born = formatDate(member.birthDate, member.birthYear);
  const died = formatDate(member.deathDate, member.deathYear);
  const isDeceased = member.deathYear !== null;
  const select = (id: string) => dispatch({ type: 'SELECT_MEMBER', payload: id });

  const facts = [
    born && `${t.bornAbbrev} ${born}`,
    died && `${t.detailsDiedAbbrev} ${died}`,
    member.age !== null && (isDeceased ? t.detailsAgeAtDeath(member.age) : t.detailsAge(member.age)),
    member.occupation,
    member.location,
  ].filter(Boolean).join(' · ');

  const relativeLine = (label: string, items: Array<{ member: StyledFamilyMember; former?: boolean }>) => items.length > 0 && (
    <div className="member-details__relatives">
      <span className="member-details__label">{label}</span>
      {items.map(({ member: relative, former }, index) => (
        <React.Fragment key={relative.id}>
          {index > 0 && ', '}
          <button type="button" className="member-details__link" onClick={() => select(relative.id)} title={displayFullName(relative, lang)}>
            {getDisplayFirstName(relative, lang)}
          </button>
          {former && <span className="member-details__former"> ({t.detailsFormerSpouse})</span>}
        </React.Fragment>
      ))}
    </div>
  );

  const longNotes = !!member.notes && (member.notes.length > NOTES_PREVIEW_LENGTH || member.notes.includes('\n'));

  return (
    <aside className="member-details" aria-label={t.detailsPanelLabel(name)}>
      <header className="member-details__header">
        <span className="member-details__avatar" style={{ borderColor: member.nodeBorderColorHex }}>
          <MemberAvatar member={member} avatarStyle={state.avatarStyle} displayName={name} />
        </span>
        <div className="member-details__names">
          <h2 className="member-details__name">{name}</h2>
          {otherName && otherName !== name && <span className="member-details__alt-name">{otherName}</span>}
        </div>
        <div className="member-details__actions">
          {canEdit && (
            <button
              type="button"
              className="member-details__icon"
              disabled={isSaving}
              onClick={() => dispatch({ type: 'OPEN_MEMBER_FORM', payload: { mode: 'edit', targetId: member.id } })}
              aria-label={t.menuEdit}
              title={t.menuEdit}
            >
              <PencilIcon size={13} />
            </button>
          )}
          <button type="button" className="member-details__icon" onClick={() => dispatch({ type: 'SELECT_MEMBER', payload: null })} aria-label={t.close} title={t.close}>
            <XIcon size={14} />
          </button>
        </div>
      </header>

      {facts && <p className="member-details__facts">{facts}</p>}

      {relativeLine(t.detailsParents, relatives.parents.map(m => ({ member: m })))}
      {relativeLine(t.detailsSpouses, relatives.spouses)}
      {relativeLine(t.detailsChildren, relatives.children.map(m => ({ member: m })))}

      {member.notes && (
        <div className="member-details__notes-wrap">
          <p className={`member-details__notes${longNotes && !notesOpen ? ' member-details__notes--clamped' : ''}`}>{member.notes}</p>
          {longNotes && (
            <button type="button" className="member-details__more" aria-expanded={notesOpen} onClick={() => setNotesOpen(open => !open)}>
              {notesOpen ? t.detailsLess : t.detailsMore}
            </button>
          )}
        </div>
      )}
    </aside>
  );
};

export default MemberDetailsPanel;
