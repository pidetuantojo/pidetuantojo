'use client';

import { FlowSimulator } from '../../components/FlowSimulator/FlowSimulator';
import { ORDER_FLOW } from './orderFlow';
import { OrderFlowScreen } from './OrderFlowScreen';

/** Simulador de la guía "Gestiona un pedido de principio a fin". Se usa en el MDX como <OrderFlowSimulator />. */
export function OrderFlowSimulator() {
  return (
    <FlowSimulator
      flow={ORDER_FLOW}
      label="Simulador: gestionar un pedido"
      renderScreen={(state) => <OrderFlowScreen state={state} />}
    />
  );
}
