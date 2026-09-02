import { useState } from 'react';
import { Button } from '@/components/Button';
import { TopBar } from '@/components/TopBar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { BillingMethod, AccountGroup } from '@/data/pupusa';
import { Theme } from '@/hooks/useTheme';
import { Plus, X, Users, User, ChevronDown, Trash2, ArrowRight } from 'lucide-react';

interface Props {
  onBack: () => void;
  onContinue: (method: BillingMethod, groups: AccountGroup[]) => void;
  selected: BillingMethod | null;
  onSelect: (method: BillingMethod) => void;
  theme: Theme;
  onToggleTheme: () => void;
  people: string[];
  initialGroups: AccountGroup[];
}

let groupIdCounter = 0;
const genGroupId = () => `grp-${++groupIdCounter}-${Date.now()}`;

export function BillingScreen({
  onBack,
  onContinue,
  selected,
  onSelect,
  theme,
  onToggleTheme,
  people,
  initialGroups,
}: Props) {
  const personIds = people.map((_, i) => `p${i}`);
  const [groups, setGroups] = useState<AccountGroup[]>(initialGroups);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState('');

  const assignedPersonIds = new Set(groups.flatMap((g) => g.personIds));
  const unassigned = personIds.filter((id) => !assignedPersonIds.has(id));

  const addGroup = () => {
    const name = newGroupName.trim() || `Cuenta ${groups.length + 1}`;
    const g: AccountGroup = { id: genGroupId(), name, personIds: [] };
    setGroups([...groups, g]);
    setExpandedGroup(g.id);
    setNewGroupName('');
  };

  const removeGroup = (id: string) => {
    setGroups(groups.filter((g) => g.id !== id));
  };

  const renameGroup = (id: string, name: string) => {
    setGroups(groups.map((g) => (g.id === id ? { ...g, name } : g)));
  };

  const toggleExpand = (id: string) => {
    setExpandedGroup(expandedGroup === id ? null : id);
  };

  const addPersonToGroup = (groupId: string, personId: string) => {
    setGroups(
      groups.map((g) =>
        g.id === groupId
          ? { ...g, personIds: [...g.personIds, personId] }
          : { ...g, personIds: g.personIds.filter((p) => p !== personId) }
      )
    );
  };

  const removePersonFromGroup = (groupId: string, personId: string) => {
    setGroups(
      groups.map((g) =>
        g.id === groupId
          ? { ...g, personIds: g.personIds.filter((p) => p !== personId) }
          : g
      )
    );
  };

  const movePerson = (personId: string, toGroupId: string) => {
    setGroups(
      groups.map((g) => {
        if (g.id === toGroupId) {
          if (g.personIds.includes(personId)) return g;
          return { ...g, personIds: [...g.personIds, personId] };
        }
        return { ...g, personIds: g.personIds.filter((p) => p !== personId) };
      })
    );
  };

  const options: { id: BillingMethod; emoji: string; title: string; subtitle: string }[] = [
    { id: 'single', emoji: '🧾', title: 'Una sola cuenta', subtitle: 'Todo junto' },
    { id: 'split', emoji: '👤', title: 'Cada quien paga lo suyo', subtitle: 'Dividir por persona' },
    { id: 'groups', emoji: '👥', title: 'Varias cuentas', subtitle: 'Agrupar personas en diferentes cuentas' },
  ];

  const canContinue =
    selected === 'single' ||
    selected === 'split' ||
    (selected === 'groups' && groups.length > 0 && unassigned.length === 0);

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar onBack={onBack} right={<ThemeToggle theme={theme} onToggle={onToggleTheme} />} />
      <div className="px-5 pb-2">
        <h2 className="font-display text-3xl font-bold text-charcoal-900 dark:text-cream-50 mb-1">
          ¿Cómo vamos a pagar?
        </h2>
        <p className="text-charcoal-700 dark:text-cream-200 mb-6">Elegí el método</p>
      </div>

      <div className="flex-1 px-5 space-y-4 overflow-y-auto pb-40">
        {options.map((opt) => {
          const isSel = selected === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => onSelect(opt.id)}
              className={`w-full text-left p-6 rounded-3xl border-2 transition-all active:scale-[0.99] no-tap-highlight ${
                isSel
                  ? 'border-terracotta-400 bg-terracotta-50 dark:bg-terracotta-700/30 shadow-card'
                  : 'border-cream-200 dark:border-night-100 bg-cream-50 dark:bg-night-300 hover:border-cream-300 dark:hover:border-night-50'
              }`}
            >
              <div className="flex items-center gap-4">
                <span className="text-4xl">{opt.emoji}</span>
                <div className="flex-1">
                  <p className="font-bold text-charcoal-900 dark:text-cream-50 text-lg leading-tight">
                    {opt.title}
                  </p>
                  <p className="text-charcoal-700 dark:text-cream-200 text-sm mt-0.5">{opt.subtitle}</p>
                </div>
                <div
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${
                    isSel ? 'border-terracotta-400 bg-terracotta-400' : 'border-cream-300 dark:border-night-50'
                  }`}
                >
                  {isSel && <div className="w-2.5 h-2.5 rounded-full bg-white animate-pop" />}
                </div>
              </div>
            </button>
          );
        })}

        {/* Groups management UI */}
        {selected === 'groups' && (
          <div className="space-y-4 pt-2 animate-slideUp">
            {/* Summary bar */}
            <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-olive-100 dark:bg-olive-600/20 border border-olive-200 dark:border-olive-600/30">
              <span className="text-sm font-bold text-charcoal-800 dark:text-cream-100">
                {people.length} {people.length === 1 ? 'persona' : 'personas'} · {groups.length}{' '}
                {groups.length === 1 ? 'cuenta' : 'cuentas'}
              </span>
              {unassigned.length > 0 && (
                <span className="text-sm font-semibold text-terracotta-500">
                  {unassigned.length} sin asignar
                </span>
              )}
            </div>

            {/* Create new group */}
            <div className="flex gap-2">
              <input
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addGroup()}
                placeholder="Nombre de la cuenta..."
                className="flex-1 px-4 py-3 rounded-2xl bg-cream-50 dark:bg-night-300 border border-cream-200 dark:border-night-100 text-charcoal-800 dark:text-cream-100 placeholder:text-charcoal-700/40 dark:placeholder:text-cream-200/40 focus:outline-none focus:border-terracotta-300 transition-colors text-sm"
              />
              <button
                onClick={addGroup}
                className="px-4 rounded-2xl bg-terracotta-400 text-white flex items-center justify-center shadow-soft active:scale-95 transition-transform no-tap-highlight shrink-0"
                aria-label="Crear cuenta"
              >
                <Plus className="w-5 h-5" strokeWidth={2.5} />
              </button>
            </div>

            {/* Groups list */}
            {groups.map((g, gi) => {
              const isExpanded = expandedGroup === g.id;
              return (
                <div
                  key={g.id}
                  className="rounded-2xl border-2 border-cream-200 dark:border-night-100 bg-cream-50 dark:bg-night-300 overflow-hidden animate-slideUp"
                  style={{ animationDelay: `${gi * 40}ms` }}
                >
                  {/* Group header */}
                  <div className="flex items-center gap-2 p-3">
                    <button
                      onClick={() => toggleExpand(g.id)}
                      className="flex-1 flex items-center gap-2 text-left no-tap-highlight"
                    >
                      <ChevronDown
                        className={`w-5 h-5 text-charcoal-700/50 dark:text-cream-200/50 transition-transform shrink-0 ${
                          isExpanded ? 'rotate-180' : ''
                        }`}
                      />
                      <input
                        value={g.name}
                        onChange={(e) => renameGroup(g.id, e.target.value)}
                        className="flex-1 bg-transparent font-bold text-charcoal-900 dark:text-cream-50 text-base focus:outline-none"
                      />
                    </button>
                    <span className="text-xs font-bold text-charcoal-700/60 dark:text-cream-200/50 bg-cream-200 dark:bg-night-100 px-2 py-1 rounded-full shrink-0">
                      {g.personIds.length}
                    </span>
                    <button
                      onClick={() => removeGroup(g.id)}
                      className="w-8 h-8 rounded-full bg-red-50 dark:bg-red-900/20 text-red-400 flex items-center justify-center active:scale-90 transition-transform no-tap-highlight shrink-0"
                      aria-label="Eliminar cuenta"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Group members */}
                  {isExpanded && (
                    <div className="px-3 pb-3 space-y-2 animate-fadeIn">
                      {/* Assigned people */}
                      {g.personIds.map((pid) => {
                        const idx = personIds.indexOf(pid);
                        return (
                          <div
                            key={pid}
                            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-cream-100 dark:bg-night-200 border border-cream-200 dark:border-night-100"
                          >
                            <div className="w-7 h-7 rounded-full bg-olive-100 dark:bg-olive-600/30 text-olive-600 dark:text-olive-200 flex items-center justify-center shrink-0">
                              <User className="w-3.5 h-3.5" />
                            </div>
                            <span className="flex-1 text-sm font-semibold text-charcoal-800 dark:text-cream-100">
                              {people[idx]}
                            </span>
                            {/* Move dropdown */}
                            <select
                              value=""
                              onChange={(e) => e.target.value && movePerson(pid, e.target.value)}
                              className="text-xs bg-cream-200 dark:bg-night-100 text-charcoal-700 dark:text-cream-200 rounded-lg px-2 py-1 font-semibold focus:outline-none cursor-pointer"
                            >
                              <option value="">Mover a...</option>
                              {groups
                                .filter((og) => og.id !== g.id)
                                .map((og) => (
                                  <option key={og.id} value={og.id}>
                                    {og.name}
                                  </option>
                                ))}
                            </select>
                            <button
                              onClick={() => removePersonFromGroup(g.id, pid)}
                              className="w-7 h-7 rounded-full text-charcoal-700/40 dark:text-cream-200/40 flex items-center justify-center active:scale-90 transition-transform no-tap-highlight shrink-0"
                              aria-label="Quitar de la cuenta"
                            >
                              <X className="w-4 h-4" strokeWidth={2.5} />
                            </button>
                          </div>
                        );
                      })}

                      {/* Unassigned people to add */}
                      {unassigned.length > 0 && (
                        <div className="pt-1">
                          <p className="text-xs font-semibold text-charcoal-700/50 dark:text-cream-200/40 mb-1.5 px-1">
                            Sin asignar
                          </p>
                          {unassigned.map((pid) => {
                            const idx = personIds.indexOf(pid);
                            return (
                              <button
                                key={pid}
                                onClick={() => addPersonToGroup(g.id, pid)}
                                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-cream-300 dark:border-night-50 hover:border-terracotta-300 hover:bg-terracotta-50/50 dark:hover:bg-terracotta-700/10 transition-colors no-tap-highlight"
                              >
                                <div className="w-7 h-7 rounded-full bg-cream-200 dark:bg-night-100 text-charcoal-700/50 dark:text-cream-200/50 flex items-center justify-center shrink-0">
                                  <User className="w-3.5 h-3.5" />
                                </div>
                                <span className="flex-1 text-left text-sm font-semibold text-charcoal-700 dark:text-cream-200">
                                  {people[idx]}
                                </span>
                                <ArrowRight className="w-4 h-4 text-terracotta-400 shrink-0" />
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {g.personIds.length === 0 && unassigned.length === 0 && (
                        <p className="text-sm text-charcoal-700/50 dark:text-cream-200/40 py-2 text-center">
                          Todas las personas están asignadas
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {groups.length === 0 && (
              <div className="text-center py-8">
                <Users className="w-10 h-10 text-charcoal-700/30 dark:text-cream-200/30 mx-auto mb-3" />
                <p className="text-charcoal-700 dark:text-cream-200 font-semibold">
                  Creá una cuenta para empezar
                </p>
                <p className="text-charcoal-700/60 dark:text-cream-200/50 text-sm mt-1">
                  Asigná personas a cada cuenta
                </p>
              </div>
            )}

            {unassigned.length > 0 && groups.length > 0 && (
              <div className="rounded-2xl bg-terracotta-50 dark:bg-terracotta-700/15 border border-terracotta-200 dark:border-terracotta-600/30 p-4 text-center">
                <p className="text-sm font-semibold text-terracotta-600 dark:text-terracotta-200">
                  {unassigned.length} {unassigned.length === 1 ? 'persona sin asignar' : 'personas sin asignar'}
                </p>
                <p className="text-xs text-charcoal-700/60 dark:text-cream-200/50 mt-0.5">
                  Asignalas a una cuenta para continuar
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-cream-100/95 dark:bg-night-400/95 backdrop-blur-md px-5 py-4 safe-bottom border-t border-cream-200 dark:border-night-100">
        <Button
          onClick={() => selected && onContinue(selected, selected === 'groups' ? groups : [])}
          disabled={!canContinue}
        >
          Continuar
        </Button>
      </div>
    </div>
  );
}
