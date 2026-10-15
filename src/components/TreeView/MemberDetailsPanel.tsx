import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFamilyTree } from '../../context/FamilyTreeContext';
import { useLanguage } from '../../context/LanguageContext';
import { StyledFamilyMember } from '../../types/FamilyTypes';
import { getDisplayFirstName } from '../../processing/displayName';
import { PencilIcon, XIcon } from '../Icons';
import { MemberAvatar } from './MemberAvatar';
import './MemberDetailsPanel.css';

type TimelineItem =
  | { kind: 'event'; key: string; year: number | null; tone: 'life' | 'death'; content: React.ReactNode }
  | { kind: 'note'; key: string; text: string };

function splitText(text: string): string[] {
  return text.match(/[\s\S]{1,80}(?:\s|$)|[\s\S]{1,80}/g)?.map(part => part.trim()).filter(Boolean) ?? [];
}

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
  const [page, setPage] = useState(0);
  const [pageEnds, setPageEnds] = useState<number[]>([]);
  const [contentHeight, setContentHeight] = useState(210);
  const bodyRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const memberId = member?.id;
  useEffect(() => setPage(0), [memberId, lang]);

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
        .map(r => ({
          member: byId.get(r.spouse1Id === member.id ? r.spouse2Id : r.spouse1Id),
          former: r.status !== 'current',
          year: r.marriageYear ?? (Number(r.marriageDate?.slice(0, 4)) || null),
          date: r.marriageDate,
          endYear: r.endYear ?? null,
        }))
        .filter((s): s is { member: StyledFamilyMember; former: boolean; year: number | null; date: string | undefined; endYear: number | null } => !!s.member),
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

  const name = member ? displayFullName(member, lang) : '';
  const dayMonth = (iso: string | null | undefined) => {
    const match = iso?.match(/^\d{4}-(\d{2})(?:-(\d{2}))?$/);
    if (!match) return null;
    return [match[2] ? String(Number(match[2])) : '', t.months[Number(match[1]) - 1]].filter(Boolean).join(' ');
  };
  const isDeceased = member?.deathYear != null;
  const select = (id: string) => dispatch({ type: 'SELECT_MEMBER', payload: id });

  const generation = member?.generationIndex != null ? t.genFormat(member.generationIndex) : null;
  const age = member?.age != null ? (isDeceased ? t.detailsAgeAtDeath(member.age) : t.detailsAge(member.age)) : null;
  const subtitle = [generation, age].filter(Boolean).join(' · ');
  const meta = [member?.occupation, member?.location].filter(Boolean).join(' · ');

  const link = (relative: StyledFamilyMember) => (
    <button key={relative.id} type="button" className="member-details__link" onClick={() => select(relative.id)} title={displayFullName(relative, lang)}>
      {getDisplayFirstName(relative, lang)}
    </button>
  );

  const items: TimelineItem[] = [];
  if (member && relatives) {
    const bornOn = dayMonth(member.birthDate);
    if (member.birthYear !== null || bornOn || relatives.parents.length > 0) {
      items.push({
        kind: 'event', key: 'birth', year: member.birthYear, tone: 'life',
        content: <>
          {t.tlVerbBorn}{bornOn && ` · ${bornOn}`}
          {relatives.parents.length > 0 && <> <span className="member-details__label">{t.detailsParents}</span>{relatives.parents.map(link)}</>}
        </>,
      });
    }
    type LifeEvent = Extract<TimelineItem, { kind: 'event' }>;
    const marriages: LifeEvent[] = relatives.spouses.map(spouse => {
      const on = dayMonth(spouse.date);
      return {
        kind: 'event', key: `spouse-${spouse.member.id}`, year: spouse.year, tone: 'life',
        content: <>
          {t.tlVerbMarried}{on && ` · ${on}`} {link(spouse.member)}
          {spouse.former && <span className="member-details__former">({t.detailsFormerSpouse}{spouse.endYear ? ` – ${spouse.endYear}` : ''})</span>}
        </>,
      };
    });
    const births: LifeEvent[] = relatives.children.map(child => ({
      kind: 'event', key: `child-${child.id}`, year: child.birthYear, tone: 'life',
      content: <>
        {child.gender === 'male' ? t.detailsSon : child.gender === 'female' ? t.detailsDaughter : t.detailsChild} {link(child)}
      </>,
    }));
    const dated = [...marriages, ...births].filter(event => event.year !== null);
    dated.sort((a, b) => a.year! - b.year!);
    // Without a date, a marriage most likely precedes the dated children; an undated child follows them.
    items.push(...marriages.filter(event => event.year === null), ...dated, ...births.filter(event => event.year === null));
    if (isDeceased) {
      const diedOn = dayMonth(member.deathDate);
      items.push({
        kind: 'event', key: 'death', year: member.deathYear, tone: 'death',
        content: <>{t.tlVerbDied}{diedOn && ` · ${diedOn}`}</>,
      });
    }
    splitText(member.notes ?? '').forEach((text, index) => items.push({ kind: 'note', key: `note-${index}`, text }));
  }

  const renderItems = (list: TimelineItem[]) => list.map((item, index) => {
    const previous = list[index - 1];
    const next = list[index + 1];
    if (item.kind === 'note') {
      const first = previous?.kind !== 'note';
      return (
        <div key={item.key} className={`member-details__row${first && index > 0 ? ' member-details__row--spaced' : ''}`}>
          <p className={`member-details__notes${first ? ' member-details__notes--first' : ''}${next?.kind !== 'note' ? ' member-details__notes--last' : ''}`}>{item.text}</p>
        </div>
      );
    }
    const edges = `${previous?.kind !== 'event' ? ' member-details__event--first' : ''}${next?.kind !== 'event' ? ' member-details__event--last' : ''}`;
    return (
      <div key={item.key} className={`member-details__row member-details__event member-details__event--${item.tone}${edges}`}>
        <span className="member-details__year">{item.year ?? ''}</span>
        <span className="member-details__dot" aria-hidden="true" />
        <span className="member-details__event-text">{item.content}</span>
      </div>
    );
  });

  useLayoutEffect(() => {
    const body = bodyRef.current;
    const measure = measureRef.current;
    if (!body || !measure) return;
    measure.setAttribute('inert', '');
    const paginate = () => {
      const heights = Array.from(measure.children).map(row => row.getBoundingClientRect().height);
      setContentHeight(heights.reduce((total, height) => total + height, 0));
      const available = body.clientHeight;
      if (!available) { setPageEnds([measure.children.length]); return; }
      const ends: number[] = [];
      let used = 0;
      heights.forEach((height, index) => {
        if (used > 0 && used + height > available) {
          ends.push(index);
          used = 0;
        }
        used += height;
      });
      ends.push(measure.children.length);
      setPageEnds(previous => previous.join(',') === ends.join(',') ? previous : ends);
    };
    paginate();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(paginate);
    observer.observe(body);
    observer.observe(measure);
    return () => observer.disconnect();
  }, [member, relatives, lang]);

  if (!member || !relatives) return null;
  const currentPage = Math.min(page, Math.max(0, pageEnds.length - 1));
  const start = currentPage ? pageEnds[currentPage - 1] : 0;
  const end = pageEnds[currentPage] ?? items.length;

  return (
    <aside className="member-details" aria-label={t.detailsPanelLabel(name)}>
      <header className="member-details__header">
        <span className="member-details__avatar" style={{ borderColor: member.nodeBorderColorHex }}>
          <MemberAvatar member={member} avatarStyle={state.avatarStyle} displayName={name} />
        </span>
        <div className="member-details__names">
          <h2 className="member-details__name">{name}</h2>
          {subtitle && <span className="member-details__sub">{subtitle}</span>}
          {meta && <span className="member-details__meta">{meta}</span>}
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

      {items.length > 0 && (
        <div className={`member-details__body${items.some(item => item.kind === 'event' && item.year !== null) ? '' : ' member-details__body--undated'}`} ref={bodyRef} style={{ height: Math.min(210, contentHeight) }} role="group" aria-label={t.detailsTimeline}>
          <div className="member-details__measure" ref={measureRef} aria-hidden="true">
            {renderItems(items)}
          </div>
          <div className="member-details__page">
            {renderItems(items.slice(start, end))}
          </div>
        </div>
      )}
      {pageEnds.length > 1 && items.length > 0 && (
        <nav className="member-details__pagination" aria-label={t.detailsPanelLabel(name)}>
          <button type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>{t.detailsPrevious}</button>
          <span aria-live="polite">{t.detailsPage(currentPage + 1, pageEnds.length)}</span>
          <button type="button" disabled={currentPage === pageEnds.length - 1} onClick={() => setPage(currentPage + 1)}>{t.detailsNext}</button>
        </nav>
      )}
    </aside>
  );
};

export default MemberDetailsPanel;
