import {
  signalStoreFeature,
  withState,
  withComputed,
  withMethods,
  patchState
} from '@ngrx/signals';
import { computed } from '@angular/core';
import type {
  MultiStepFormConfig,
  MultiStepFormState
} from './multi-step-form.types';

/**
 * Type-safe helper to define initial form state and steps with strong type inference.
 *
 * @example
 * ```ts
 * const initialState = createMultiStepConfig({
 *   initialStep: 'step1',
 *   steps: {
 *     step1: { isComplete: false },
 *     step2: { isComplete: false },
 *     confirmationStep: { hasBeenSubmitted: false }
 *   }
 * });
 * ```
 */
export function createMultiStepConfig<
  TSteps extends object,
  TInitialStep extends keyof TSteps & string
>(config: {
  initialStep: TInitialStep;
  steps: TSteps;
}): MultiStepFormConfig<TSteps, TInitialStep> {
  return config;
}

/**
 * NgRx SignalStore custom feature that manages multi-step form state.
 *
 * Provides:
 * - State: `steps` (all steps state), `currentStep`, `stepHistory`
 * - Computed signals: `currentStepState` (reactive signal for active step), `canGoBack`, `isFirstStep`, `history`
 * - Methods: `goToStep(step, options?)`, `goBack()`, `updateStep(step, updater)`, `updateCurrentStep(updater)`, `resetForm()`
 *
 * @param config Multi-step form configuration with initialStep and steps definition
 */
export function withMultiStepFormState<
  TSteps extends object,
  TInitialStep extends keyof TSteps & string = keyof TSteps & string
>(config: MultiStepFormConfig<TSteps, TInitialStep>) {
  type StepKey = keyof TSteps & string;

  return signalStoreFeature(
    withState<MultiStepFormState<TSteps, StepKey>>({
      steps: config.steps,
      currentStep: config.initialStep as StepKey,
      stepHistory: [] as StepKey[]
    }),
    withComputed((store) => ({
      /** Reactive signal representing the active step's specific state */
      currentStepState: computed(() => (store.steps() as any)[store.currentStep()]),
      /** Reactive signal indicating if there is history to go back to */
      canGoBack: computed(() => store.stepHistory().length > 0),
      /** Reactive signal indicating if currently on the initial step */
      isFirstStep: computed(() => store.currentStep() === config.initialStep),
      /** Reactive signal representing the stack of past steps */
      history: computed(() => store.stepHistory())
    })),
    withMethods((store) => ({
      /**
       * Navigates to a target step and pushes the current step into `stepHistory`.
       */
      goToStep(targetStep: StepKey, options?: { recordHistory?: boolean }): void {
        const record = options?.recordHistory ?? true;
        patchState(store, (state) => {
          const newHistory = record
            ? [...state.stepHistory, state.currentStep]
            : state.stepHistory;
          return {
            currentStep: targetStep,
            stepHistory: newHistory
          };
        });
      },

      /**
       * Navigates back to the previously visited step in `stepHistory`.
       */
      goBack(): void {
        const history = store.stepHistory();
        if (history.length === 0) return;
        const prevStep = history[history.length - 1]!;
        const remainingHistory = history.slice(0, -1);

        patchState(store, {
          currentStep: prevStep,
          stepHistory: remainingHistory
        });
      },

      /**
       * Updates the state for a specific step by key.
       */
      updateStep<K extends StepKey>(
        step: K,
        updater: Partial<TSteps[K]> | ((prevState: TSteps[K]) => Partial<TSteps[K]>)
      ): void {
        patchState(store, (state) => {
          const currentVal = (state.steps as any)[step];
          const patch = typeof updater === 'function' ? (updater as any)(currentVal) : updater;
          return {
            steps: {
              ...state.steps,
              [step]: {
                ...currentVal,
                ...patch
              }
            }
          };
        });
      },

      /**
       * Updates the state of the currently active step.
       */
      updateCurrentStep(
        updater:
          | Partial<TSteps[StepKey]>
          | ((prevState: TSteps[StepKey]) => Partial<TSteps[StepKey]>)
      ): void {
        const cur = store.currentStep();
        patchState(store, (state) => {
          const currentVal = (state.steps as any)[cur];
          const patch = typeof updater === 'function' ? (updater as any)(currentVal) : updater;
          return {
            steps: {
              ...state.steps,
              [cur]: {
                ...currentVal,
                ...patch
              }
            }
          };
        });
      },

      /**
       * Resets the entire form back to initialStep, empty history, and initial state values.
       */
      resetForm(): void {
        patchState(store, {
          steps: config.steps,
          currentStep: config.initialStep as StepKey,
          stepHistory: []
        });
      }
    }))
  );
}

/** Alias for `withMultiStepFormState` */
export const withMultiStepForm = withMultiStepFormState;
