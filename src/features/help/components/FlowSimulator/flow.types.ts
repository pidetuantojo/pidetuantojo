export interface FlowStep<S> {
  title: string;
  text: string;
  // Valor de `data-flow-target` del elemento que se toca en este paso
  target: string;
  // Lo que pasa en pantalla al tocarlo (función pura)
  act: (state: S) => S;
  // Paso que ocurre solo (ej. llega un pedido): no espera toque en modo práctica
  auto?: boolean;
}

export interface FlowDefinition<S> {
  initialState: S;
  steps: readonly FlowStep<S>[];
  // Apaga lo que solo se ve durante un paso (notificaciones, animaciones) antes del siguiente
  settle?: (state: S) => S;
  // Tamaño interno de la pantalla simulada; se escala para caber en el contenedor
  width: number;
  height: number;
  doneTitle: string;
  doneText: { demo: string; practice: string };
}

/** Estado de pantalla al empezar el paso `index`: aplica los pasos anteriores y "asienta" lo transitorio. */
export function stateAtStep<S>(flow: Pick<FlowDefinition<S>, 'initialState' | 'steps' | 'settle'>, index: number): S {
  const settle = flow.settle ?? ((s: S) => s);
  return flow.steps.slice(0, index).reduce((s, step) => settle(step.act(s)), flow.initialState);
}
