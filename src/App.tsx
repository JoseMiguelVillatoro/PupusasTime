import { useState, useCallback } from 'react';
import { HomeScreen } from '@/screens/HomeScreen';
import { RestaurantScreen } from '@/screens/RestaurantScreen';
import { PeopleScreen } from '@/screens/PeopleScreen';
import { BillingScreen } from '@/screens/BillingScreen';
import { OrderScreen } from '@/screens/OrderScreen';
import { PersonSummaryScreen } from '@/screens/PersonSummaryScreen';
import { FinalSummaryScreen } from '@/screens/FinalSummaryScreen';
import { PaymentScreen } from '@/screens/PaymentScreen';
import { PaymentResult } from '@/data/consolidation';
import {
  PlaceRestaurant,
  BillingMethod,
  PersonOrder,
  PupusaItem,
  AccountGroup,
} from '@/data/pupusa';
import { useTheme } from '@/hooks/useTheme';

type Screen =
  | 'home'
  | 'restaurant'
  | 'people'
  | 'billing'
  | 'order'
  | 'personSummary'
  | 'final'
  | 'payment';

let idCounter = 0;
const genId = () => `id-${++idCounter}-${Date.now()}`;

export default function App() {
  const { theme, toggle: toggleTheme } = useTheme();
  const [screen, setScreen] = useState<Screen>('home');
  const [restaurant, setRestaurant] = useState<PlaceRestaurant | null>(null);
  const [people, setPeople] = useState<string[]>([]);
  const [billing, setBilling] = useState<BillingMethod | null>(null);
  const [groups, setGroups] = useState<AccountGroup[]>([]);
  const [orders, setOrders] = useState<PersonOrder[]>([]);
  const [currentPersonIdx, setCurrentPersonIdx] = useState(0);
  const [editingFromSummary, setEditingFromSummary] = useState(false);

  // Payment calculator state (lifted so it persists across navigation)
  const [priceInputs, setPriceInputs] = useState<Record<string, string>>({});
  const [paymentStep, setPaymentStep] = useState<'intro' | 'price' | 'tip' | 'result'>('intro');
  const [hasTip, setHasTip] = useState<boolean | null>(null);
  const [tipInput, setTipInput] = useState('');
  const [paymentResult, setPaymentResult] = useState<PaymentResult | null>(null);

  const reset = useCallback(() => {
    setRestaurant(null);
    setPeople([]);
    setBilling(null);
    setGroups([]);
    setOrders([]);
    setCurrentPersonIdx(0);
    setEditingFromSummary(false);
    setScreen('home');
  }, []);

  const startPupuseada = () => {
    setRestaurant(null);
    setPeople([]);
    setBilling(null);
    setGroups([]);
    setOrders([]);
    setCurrentPersonIdx(0);
    setScreen('restaurant');
  };

  const handleRestaurantContinue = () => {
    if (restaurant) setScreen('people');
  };

  const handlePeopleContinue = (names: string[]) => {
    setPeople(names);
    setOrders(names.map((name) => ({ id: genId(), name, items: [] })));
    setCurrentPersonIdx(0);
    setScreen('billing');
  };

  const handleBillingContinue = (method: BillingMethod, newGroups: AccountGroup[]) => {
    setBilling(method);
    if (method === 'groups') {
      setGroups(newGroups);
    } else {
      setGroups([]);
    }
    setCurrentPersonIdx(0);
    setScreen('order');
  };

  const handleOrderComplete = (items: PupusaItem[]) => {
    setOrders((prev) =>
      prev.map((order, i) =>
        i === currentPersonIdx ? { ...order, items } : order
      )
    );
    setScreen('personSummary');
  };

  const handlePersonSummaryContinue = () => {
    if (currentPersonIdx + 1 >= people.length) {
      setScreen('final');
    } else {
      setCurrentPersonIdx((i) => i + 1);
      setScreen('order');
    }
  };

  const handleEditCurrent = () => {
    setEditingFromSummary(true);
    setScreen('order');
  };

  const handleOrderBack = () => {
    if (editingFromSummary) {
      setEditingFromSummary(false);
      setScreen('personSummary');
    } else if (currentPersonIdx === 0) {
      setScreen('billing');
    } else {
      setCurrentPersonIdx((i) => i - 1);
      setScreen('personSummary');
    }
  };

  const handleFinalEdit = () => {
    setCurrentPersonIdx(0);
    setScreen('personSummary');
  };

  return (
    <div className="min-h-screen bg-cream-100 dark:bg-night-400">
      <div className="max-w-md mx-auto min-h-screen bg-cream-100 dark:bg-night-400 relative">
        {screen === 'home' && (
          <HomeScreen onStart={startPupuseada} theme={theme} onToggleTheme={toggleTheme} />
        )}

        {screen === 'restaurant' && (
          <RestaurantScreen
            onSelect={setRestaurant}
            selected={restaurant}
            theme={theme}
            onToggleTheme={toggleTheme}
            onContinue={handleRestaurantContinue}
          />
        )}

        {screen === 'people' && (
          <PeopleScreen
            onBack={() => setScreen('restaurant')}
            onContinue={handlePeopleContinue}
            initialPeople={people}
            theme={theme}
            onToggleTheme={toggleTheme}
          />
        )}

        {screen === 'billing' && (
          <BillingScreen
            onBack={() => setScreen('people')}
            onContinue={handleBillingContinue}
            selected={billing}
            onSelect={setBilling}
            theme={theme}
            onToggleTheme={toggleTheme}
            people={people}
            initialGroups={groups}
          />
        )}

        {screen === 'order' && (
          <OrderScreen
            personIndex={currentPersonIdx}
            totalPeople={people.length}
            personName={people[currentPersonIdx] || ''}
            initialItems={orders[currentPersonIdx]?.items || []}
            allOrders={orders}
            onBack={handleOrderBack}
            onComplete={handleOrderComplete}
            theme={theme}
            onToggleTheme={toggleTheme}
          />
        )}

        {screen === 'personSummary' && (
          <PersonSummaryScreen
            personIndex={currentPersonIdx}
            totalPeople={people.length}
            personOrder={orders[currentPersonIdx] || { id: '', name: '', items: [] }}
            allOrders={orders}
            onEdit={handleEditCurrent}
            onContinue={handlePersonSummaryContinue}
            theme={theme}
            onToggleTheme={toggleTheme}
          />
        )}

        {screen === 'final' && (
          <FinalSummaryScreen
            restaurant={restaurant}
            billing={billing || 'single'}
            orders={orders}
            groups={groups}
            people={people}
            onEdit={handleFinalEdit}
            onRestart={reset}
            theme={theme}
            onToggleTheme={toggleTheme}
            onOpenPayment={() => {
              if (paymentStep === 'intro') setPaymentStep('price');
              setScreen('payment');
            }}
          />
        )}

        {screen === 'payment' && (
          <PaymentScreen
            restaurant={restaurant}
            billing={billing || 'single'}
            orders={orders}
            groups={groups}
            people={people}
            theme={theme}
            onToggleTheme={toggleTheme}
            onBack={() => setScreen('final')}
            priceInputs={priceInputs}
            setPriceInputs={setPriceInputs}
            paymentStep={paymentStep}
            setPaymentStep={setPaymentStep}
            hasTip={hasTip}
            setHasTip={setHasTip}
            tipInput={tipInput}
            setTipInput={setTipInput}
            paymentResult={paymentResult}
            setPaymentResult={setPaymentResult}
          />
        )}
      </div>
    </div>
  );
}
