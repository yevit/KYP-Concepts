import { type Signal } from '@angular/core';

/** Special navigation target token to navigate back to the previous step */
export const BACK = 'BACK' as const;
export const UNDO = 'UNDO' as const;
export type BackToken = typeof BACK | typeof UNDO;

/**
 * Base state shape for a multi-step form signal store
 */
export interface MultiStepFormState<
  TSteps extends object,
  TStepKey extends keyof TSteps & string = keyof TSteps & string
> {
  /** Record containing the individual state for each step */
  steps: TSteps;
  /** Currently active step identifier */
  currentStep: TStepKey;
  /** Stack of previously visited steps (most recent at the end) */
  stepHistory: TStepKey[];
}

/**
 * Configuration options for initializing multi-step form state
 */
export interface MultiStepFormConfig<
  TSteps extends object,
  TInitialStep extends keyof TSteps & string = keyof TSteps & string
> {
  /** The step the form starts at */
  initialStep: TInitialStep;
  /** Initial state definition for each step */
  steps: TSteps;
}

/**
 * Methods provided by the `withMultiStepForm` feature
 */
export interface MultiStepFormMethods<
  TSteps extends object,
  TStepKey extends keyof TSteps & string = keyof TSteps & string
> {
  /** Navigate directly to a target step, pushing currentStep to stepHistory */
  goToStep(targetStep: TStepKey, options?: { recordHistory?: boolean }): void;
  /** Navigate back to the previous step in history, popping from stepHistory */
  goBack(): void;
  /** Update state for a specific step */
  updateStep<K extends TStepKey>(
    step: K,
    updater: Partial<TSteps[K]> | ((prevState: TSteps[K]) => Partial<TSteps[K]>)
  ): void;
  /** Update state for the currently active step */
  updateCurrentStep(
    updater:
      | Partial<TSteps[TStepKey]>
      | ((prevState: TSteps[TStepKey]) => Partial<TSteps[TStepKey]>)
  ): void;
  /** Reset form back to initial step and initial state values */
  resetForm(): void;
}

/**
 * Computed signals provided by `withMultiStepForm`
 */
export interface MultiStepFormComputed<
  TSteps extends object,
  TStepKey extends keyof TSteps & string = keyof TSteps & string
> {
  /** Reactive signal of the current step's state */
  currentStepState: Signal<TSteps[TStepKey]>;
  /** Reactive signal indicating whether there are steps in history to navigate back to */
  canGoBack: Signal<boolean>;
  /** Reactive signal indicating whether the current step is the initial step */
  isFirstStep: Signal<boolean>;
  /** Reactive signal of the step navigation stack */
  history: Signal<TStepKey[]>;
}

/**
 * Context provided to target evaluation functions
 */
export interface StepTargetContext<
  TCurrentStepState,
  TAllSteps,
  TStepKey extends string,
  TPayload = any
> {
  /** Currently active step */
  currentStep: TStepKey;
  /** State of the active step */
  stepState: TCurrentStepState;
  /** State of all steps in the form */
  allSteps: TAllSteps;
  /** Optional payload passed into the event trigger */
  payload: TPayload;
  /** Function returning the 'BACK' token to navigate to the previous step */
  undo: () => typeof BACK;
  /** True if there is a history stack to go back to */
  canGoBack: boolean;
  /** Immutable array of previous steps */
  history: readonly TStepKey[];
}

/**
 * Target step definition: can be a step name, 'BACK' token, or a function resolving target dynamically
 */
export type StepTarget<
  TStepKey extends string,
  TCurrentStepState,
  TAllSteps,
  TPayload = any
> =
  | TStepKey
  | BackToken
  | ((
      ctx: StepTargetContext<TCurrentStepState, TAllSteps, TStepKey, TPayload>
    ) => TStepKey | BackToken | void | undefined | null);

/**
 * Configuration for a single event transition
 */
export interface StepTransitionConfig<
  TStepKey extends string,
  TCurrentStepState,
  TAllSteps,
  TPayload = any
> {
  /** Target step or function resolving target. If omitted, remains on current step */
  target?: StepTarget<TStepKey, TCurrentStepState, TAllSteps, TPayload>;
  /** State updater function applied when this event occurs */
  update?: (ctx: {
    currentStepState: TCurrentStepState;
    allSteps: TAllSteps;
    payload: TPayload;
  }) => Partial<TCurrentStepState>;
  /** Guard condition: if returns false, transition and update are aborted */
  guard?: (ctx: {
    currentStepState: TCurrentStepState;
    allSteps: TAllSteps;
    payload: TPayload;
  }) => boolean;
  /** Side-effect action executed when transition occurs */
  action?: (ctx: {
    currentStepState: TCurrentStepState;
    allSteps: TAllSteps;
    payload: TPayload;
  }) => void;
}

/**
 * Event parameter for `trigger` and `canTrigger`:
 * supports either `'eventName'` or `{ event: 'eventName', payload?: any }`
 */
export type TriggerParam<TEvents extends string, TPayload = any> =
  | TEvents
  | { event: TEvents; payload?: TPayload };

/**
 * Universal workflow methods added to the store
 */
export interface WorkflowBaseMethods<TEvents extends string = string> {
  /**
   * Trigger an event in the workflow. Executes update, action, and step transition if defined.
   * Can be invoked as `store.trigger('nextPressed', payload)` or `store.trigger({ event: 'nextPressed', payload })`.
   * Returns true if a transition was handled, false if unhandled or rejected by guard.
   */
  trigger(eventOrOptions: TriggerParam<TEvents>, payload?: any): boolean;

  /**
   * Check if an event can be triggered from the current step with the given payload.
   */
  canTrigger(eventOrOptions: TriggerParam<TEvents>, payload?: any): boolean;

  /**
   * Navigate back to the previous step in history (alias for goBack)
   */
  undo(): void;

  /**
   * Dynamic event methods invoked directly on the store:
   * e.g. `store.nextPressed(payload)`, `store.backPressed()`, etc.
   */
  [key: string]: ((...args: any[]) => any);
}

/**
 * Dynamically generated methods directly on the store:
 * E.g., `store.nextPressed(payload)`, `store.backPressed()`, etc.
 */
export type DynamicEventMethods<TEvents extends string> = {
  [E in TEvents]: (payload?: any) => boolean;
};

/**
 * Complete workflow methods exposed on store
 */
export type WorkflowStoreMethods<TEvents extends string> =
  DynamicEventMethods<TEvents> & WorkflowBaseMethods<TEvents>;

/**
 * Helper to extract union of all event names declared across all steps in workflow
 */
export type ExtractAllEvents<TWorkflow> = TWorkflow extends Record<string, any>
  ? {
      [K in keyof TWorkflow]: TWorkflow[K] extends { on?: infer O }
        ? keyof O & string
        : never;
    }[keyof TWorkflow]
  : never;
