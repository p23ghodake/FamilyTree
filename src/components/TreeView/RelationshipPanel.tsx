import React, { useMemo } from 'react';
import { useFamilyTree } from '../../context/FamilyTreeContext';
import { useLanguage } from '../../context/LanguageContext';
import {
  AlertCircleIcon,
  ArrowDownIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  GitBranchIcon,
  HeartIcon,
  RotateCcwIcon,
  XIcon,
} from '../Icons';
import { MemberAvatar } from './MemberAvatar';
import './RelationshipPanel.css';

const RelationshipPanel: React.FC = () => {
  const { state, dispatch, currentTree, relResult } = useFamilyTree();
  const { t, lang } = useLanguage();
  const { relMode, relSource, relTarget, avatarStyle } = state;

  const memberMap = useMemo(
    () => new Map(currentTree?.members.map(m => [m.id, m]) ?? []),
    [currentTree?.members],
  );

  if (!relMode) return null;

  // Mirror PersonNode's display-name logic: use Marathi fields when lang=mr
  const displayName = (m: NonNullable<ReturnType<typeof memberMap.get>>) =>
    lang === 'mr' && m.firstName_mr && (m.lastName_mr || !m.lastName)
      ? `${m.firstName_mr} ${m.lastName_mr || ''}`.trim()
      : m.fullName;

  const displayFirst = (m: NonNullable<ReturnType<typeof memberMap.get>>) =>
    lang === 'mr' && m.firstName_mr ? m.firstName_mr : m.firstName;

  const sourceMember = relSource ? memberMap.get(relSource) : null;
  const targetMember = relTarget ? memberMap.get(relTarget) : null;
  const pathMembers = relResult?.path
    .map(id => memberMap.get(id))
    .filter((m): m is NonNullable<typeof m> => m !== undefined) ?? [];

  return (
    <div className="relationship-panel">
      <div className="relationship-panel__header">
        <span className="relationship-panel__title">
          <GitBranchIcon size={15} style={{ verticalAlign: 'middle', marginRight: 6 }} />
          {t.tracerTitle}
        </span>
        <div className="relationship-panel__header-actions">
          <button
            className="relationship-panel__clear"
            onClick={() => dispatch({ type: 'CLEAR_REL_PATH' })}
            title={t.tracerReset}
          >
            <RotateCcwIcon size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
            {t.tracerReset}
          </button>
          <button
            className="relationship-panel__close"
            onClick={() => dispatch({ type: 'TOGGLE_REL_MODE' })}
            title={t.close}
            aria-label={t.close}
          >
            <XIcon size={14} />
          </button>
        </div>
      </div>

      <div className="relationship-panel__steps">
        <div className={`relationship-panel__step ${relSource ? 'relationship-panel__step--done' : 'relationship-panel__step--active'}`}>
          <span className="relationship-panel__step-num">1</span>
          {sourceMember
            ? <>
                <div className="relationship-panel__step-avatar">
                  <MemberAvatar member={sourceMember} avatarStyle={avatarStyle} displayName={displayName(sourceMember)} />
                </div>
                <span>{displayName(sourceMember)}</span>
              </>
            : <span>{t.tracerStep1}</span>
          }
        </div>
        <span className="relationship-panel__arrow"><ArrowRightIcon size={14} /></span>
        <div className={`relationship-panel__step ${!relSource ? 'relationship-panel__step--disabled' : relTarget ? 'relationship-panel__step--done' : 'relationship-panel__step--active'}`}>
          <span className="relationship-panel__step-num">2</span>
          {targetMember
            ? <>
                <div className="relationship-panel__step-avatar">
                  <MemberAvatar member={targetMember} avatarStyle={avatarStyle} displayName={displayName(targetMember)} />
                </div>
                <span>{displayName(targetMember)}</span>
              </>
            : <span>{t.tracerStep2}</span>
          }
        </div>
      </div>

      {relSource && relTarget && (
        relResult ? (
          <div className="relationship-panel__result">
            <div className="relationship-panel__label-row">
              <span className="relationship-panel__names">
                {sourceMember && displayName(sourceMember)} <span className="relationship-panel__is">→</span> {targetMember && displayName(targetMember)}
              </span>
              <span className="relationship-panel__label">
                {lang === 'mr' ? relResult.labelMr : relResult.label}
              </span>
            </div>
            <div className="relationship-panel__hops">{t.tracerHops(relResult.hops)}</div>

            <div className="relationship-panel__chain">
              {pathMembers.map((m, i) => {
                // A node is "marriage-side" if any hop from source up to this node crossed a spouse edge
                const marriageSide = relResult.directions.slice(0, i).some(d => d === 'spouse');
                const nodeClass = m!.id === relSource ? 'relationship-panel__chain-node--source'
                  : m!.id === relTarget ? 'relationship-panel__chain-node--target'
                  : marriageSide ? 'relationship-panel__chain-node--marriage'
                  : 'relationship-panel__chain-node--blood';
                return (
                  <React.Fragment key={m!.id}>
                    <button
                      className={`relationship-panel__chain-node ${nodeClass}`}
                      onClick={() => dispatch({ type: 'SELECT_MEMBER', payload: m!.id })}
                      title={displayName(m!)}
                    >
                      <div className="relationship-panel__chain-avatar">
                        <MemberAvatar member={m!} avatarStyle={avatarStyle} displayName={displayName(m!)} />
                      </div>
                      <span>{displayFirst(m!)}</span>
                    </button>
                    {i < pathMembers.length - 1 && (
                      <span
                        className={`relationship-panel__chain-arrow relationship-panel__chain-arrow--${
                          relResult.directions[i] === 'spouse' ? 'spouse' : 'blood'
                        }`}
                        title={relResult.directions[i] === 'spouse' ? t.tracerHopSpouse : relResult.directions[i] === 'up' ? t.tracerHopParent : t.tracerHopChild}
                      >
                        {relResult.directions[i] === 'up' ? <ArrowUpIcon size={12} /> :
                         relResult.directions[i] === 'down' ? <ArrowDownIcon size={12} /> : <HeartIcon size={12} />}
                      </span>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
            <div className="relationship-panel__legend">
              <span className="relationship-panel__legend-item relationship-panel__legend-item--blood">
                <ArrowUpIcon size={10} /> {t.legendBlood}
              </span>
              <span className="relationship-panel__legend-item relationship-panel__legend-item--spouse">
                <HeartIcon size={10} /> {t.legendMarriage}
              </span>
            </div>
          </div>
        ) : (
          <div className="relationship-panel__no-path">
            <AlertCircleIcon size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
            {t.tracerNoConnection}
          </div>
        )
      )}
    </div>
  );
};

export default RelationshipPanel;
