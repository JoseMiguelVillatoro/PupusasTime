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
import { hasOrders } from '@/state/pupuseada';
import { archive } from '@/state/storage';

export default function App() {
  const { theme, toggle: toggleTheme } = useTheme();
  const { state, dispatch, finish } = usePupuseada();
  const themeProps = { theme, onToggleTheme: toggleTheme };

  const people = state.people;
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
        {state.screen === 'home' && <HomeScreen onStart={start} {...themeProps} />}

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
            editingFromFinal={state.returnToFinal}
            onBack={() => dispatch({ type: 'ORDER_BACK' })}
            onComplete={(items, extras) => dispatch({ type: 'SAVE_ORDER', items, extras })}
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
            onOpenPayment={() => dispatch({ type: 'OPEN_BILLING' })}
            onFinish={() => finish(state)}
            {...themeProps}
          />
        )}

        {state.screen === 'billing' && (
          <BillingScreen
            people={people}
            selected={state.billing}
            initialGroups={state.groups}
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
            {...themeProps}
          />
        )}
      </div>
    </div>
  );
}
