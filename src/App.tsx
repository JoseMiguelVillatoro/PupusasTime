import { useEffect } from 'react';
import { HomeScreen } from '@/screens/HomeScreen';
import { RestaurantScreen } from '@/screens/RestaurantScreen';
import { PeopleScreen } from '@/screens/PeopleScreen';
import { BillingScreen } from '@/screens/BillingScreen';
import { OrderScreen } from '@/screens/OrderScreen';
import { PersonSummaryScreen } from '@/screens/PersonSummaryScreen';
import { FinalSummaryScreen } from '@/screens/FinalSummaryScreen';
import { PaymentScreen } from '@/screens/PaymentScreen';
import { useTheme } from '@/hooks/useTheme';
import { usePupuseada } from '@/state/usePupuseada';
import { hasOrders, isHost, phoneOwnership } from '@/state/pupuseada';
import { accountsFor } from '@/data/consolidation';
import { archive } from '@/state/storage';
import { JoinScreen } from '@/screens/JoinScreen';
import { LobbyScreen } from '@/screens/LobbyScreen';
import { useSharedTable } from '@/shared/useSharedTable';
import { normalizeCode } from '@/shared/backend';

export default function App() {
  const { theme, toggle: toggleTheme } = useTheme();
  const { state, dispatch, finish } = usePupuseada();
  const table = useSharedTable(state, dispatch);
  const themeProps = { theme, onToggleTheme: toggleTheme };
  const host = isHost(state);
  const people = state.people;
  const guest = Boolean(state.shared) && !host;
  const phones = phoneOwnership(state);
  const hostName =
    (state.shared && people.find((p) => state.shared?.meta[p.id]?.uid === state.shared?.hostUid)?.name) || 'el anfitrión';
  const myPersonIds = state.shared ? people.filter((p) => state.shared?.meta[p.id]?.managedBy === state.shared?.myUid).map((p) => p.id) : [];

  // Link de invitación: /?mesa=K7Q2X abre la pantalla para unirse.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('mesa');
    if (!code) return;
    params.delete('mesa');
    const rest = params.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${rest ? `?${rest}` : ''}${window.location.hash}`);
    if (state.shared && state.shared.code === normalizeCode(code)) return; // ya estamos en esa mesa
    dispatch({ type: 'OPEN_JOIN', code });
    // Solo al abrir la app.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentIdx = people.findIndex((p) => p.id === state.currentPersonId);
  const current = currentIdx >= 0 ? people[currentIdx] : null;

  // Un estado guardado inconsistente (p. ej. de una versión anterior) no deja la pantalla en blanco.
  const orphanScreen = (state.screen === 'order' || state.screen === 'personSummary') && !current;
  useEffect(() => {
    if (orphanScreen) dispatch({ type: 'GO', screen: people.length > 0 ? 'final' : 'home' });
  }, [orphanScreen, people.length, dispatch]);

  const start = () => {
    if (hasOrders(state)) archive(state);
    dispatch({ type: 'START' });
  };

  return (
    <div className="min-h-screen bg-cream-100 dark:bg-night-400">
      <div className="max-w-md mx-auto min-h-screen bg-cream-100 dark:bg-night-400 relative">
        {state.screen === 'home' && (
          <HomeScreen onStart={start} onJoin={() => dispatch({ type: 'OPEN_JOIN' })} {...themeProps} />
        )}

        {state.screen === 'join' && (
          <JoinScreen
            initialCode={state.pendingCode}
            busy={table.busy}
            error={table.error}
            onJoin={(code, name) => void table.join(code, name)}
            onBack={() => {
              table.clearError();
              dispatch({ type: 'GO', screen: 'home' });
            }}
            {...themeProps}
          />
        )}

        {state.screen === 'lobby' && state.shared && (
          <LobbyScreen
            shared={state.shared}
            people={people}
            restaurantName={state.restaurant?.name ?? null}
            isHost={host}
            busy={table.busy}
            error={table.error}
            offline={table.offline}
            onOrderFor={(personId) => dispatch({ type: 'OPEN_ORDER_FOR', personId })}
            onAddOffline={(name) => void table.addOffline(name)}
            onRemove={(personId) => void table.remove(personId)}
            onLock={async () => {
              await table.setStatus('locked');
              dispatch({ type: 'GO', screen: 'final' });
            }}
            onReopen={() => void table.setStatus('ordering')}
            onViewOrder={() => dispatch({ type: 'GO', screen: 'final' })}
            onLeave={() => finish(state)}
            onDismissError={table.clearError}
            {...themeProps}
          />
        )}

        {state.screen === 'restaurant' && (
          <RestaurantScreen
            selected={state.restaurant}
            onSelect={(restaurant) => dispatch({ type: 'SET_RESTAURANT', restaurant })}
            onContinue={() => dispatch({ type: 'RESTAURANT_DONE' })}
            onBack={state.returnToFinal ? () => dispatch({ type: 'RESTAURANT_DONE' }) : () => dispatch({ type: 'GO', screen: 'home' })}
            {...themeProps}
          />
        )}

        {state.screen === 'people' && (
          <PeopleScreen
            initialPeople={people.map((p) => ({ id: p.id, name: p.name, hasOrder: p.items.length > 0 || (p.extras?.length ?? 0) > 0 }))}
            editing={state.returnToFinal}
            onBack={() =>
              state.returnToFinal
                ? dispatch({ type: 'NEXT_PERSON' })
                : dispatch({ type: 'GO', screen: 'restaurant' })
            }
            onContinue={(list) => dispatch({ type: 'SET_PEOPLE', people: list })}
            onShare={(hostName) => void table.share(hostName)}
            shareBusy={table.busy}
            shareError={table.error}
            {...themeProps}
          />
        )}

        {state.screen === 'order' && current && (
          <OrderScreen
            key={current.id}
            personIndex={currentIdx}
            totalPeople={people.length}
            person={current}
            allOrders={people}
            editingFromFinal={state.returnToFinal || Boolean(state.shared)}
            onBack={() => dispatch({ type: 'ORDER_BACK' })}
            onComplete={(items, extras) => {
              dispatch({ type: 'SAVE_ORDER', items, extras });
              if (state.shared) table.saveOrder(current.id, items, extras);
            }}
            {...themeProps}
          />
        )}

        {state.screen === 'personSummary' && current && (
          <PersonSummaryScreen
            personIndex={currentIdx}
            totalPeople={people.length}
            personOrder={current}
            allOrders={people}
            returnsToFinal={
              state.returnToFinal &&
              !people.some((p) => p.id !== current.id && p.items.length === 0 && (p.extras?.length ?? 0) === 0)
            }
            onEdit={() => dispatch({ type: 'EDIT_CURRENT' })}
            onContinue={() => dispatch({ type: 'NEXT_PERSON' })}
            {...themeProps}
          />
        )}

        {state.screen === 'final' && (
          <FinalSummaryScreen
            restaurant={state.restaurant}
            orders={people}
            onEditPerson={(personId) => dispatch({ type: 'EDIT_PERSON', personId })}
            onEditPeople={() => dispatch({ type: 'EDIT_PEOPLE' })}
            onOpenPayment={() => dispatch(guest ? { type: 'GO', screen: 'payment' } : { type: 'OPEN_BILLING' })}
            guestAccounts={guest ? { hostName, published: Boolean(state.shared?.accountsPublished && state.billing) } : undefined}
            onFinish={() => finish(state)}
            {...themeProps}
          />
        )}

        {state.screen === 'billing' && (
          <BillingScreen
            people={people}
            selected={state.billing}
            initialGroups={state.groups}
            phoneAccounts={
              phones
                ? accountsFor('byPhone', people, [], phones).map((g) => ({ name: g.name, count: g.personIds.length }))
                : undefined
            }
            onBack={() => dispatch({ type: 'GO', screen: 'final' })}
            onContinue={(billing, groups) => dispatch({ type: 'SET_BILLING', billing, groups })}
            {...themeProps}
          />
        )}

        {state.screen === 'payment' && state.billing && (
          <PaymentScreen
            restaurant={state.restaurant}
            billing={state.billing}
            orders={people}
            groups={state.groups}
            draft={state.payment}
            onChange={(patch) => dispatch({ type: 'UPDATE_PAYMENT', patch })}
            onBack={() => dispatch({ type: 'GO', screen: 'billing' })}
            onBackToSummary={() => dispatch({ type: 'GO', screen: 'final' })}
            phones={phones}
            readOnly={guest}
            hostName={hostName}
            myPersonIds={myPersonIds}
            onPublish={
              state.shared && host && state.billing
                ? () => void table.publishAccounts(state.billing!, state.groups, state.payment)
                : undefined
            }
            {...themeProps}
          />
        )}
      </div>
    </div>
  );
}
