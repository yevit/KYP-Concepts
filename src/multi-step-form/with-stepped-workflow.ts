import {
  signalStoreFeature,
  type,
  patchState,
  withMethods
} from '@ngrx/signals';
import { BACK, UNDO } from './multi-step-form.types';
import type {
  BackToken,
  MultiStepFormState,
  StepTransitionConfig,
  TriggerParam,
  WorkflowBaseMethods,
  DynamicEventMethods,
  ExtractAllEvents
} from './multi-step-form.types';
import { withMultiStepFormState } from './with-multi-step-form';

/**
 * NgRx SignalStore custom feature that adds a finite-state-machine / workflow engine
 * to a multi-step form store.
 *
 * Strongly typed based on the steps and step states defined in `withMultiStepFormState`.
 *
 * Features:
 * - Transition mapping per step (`on: { eventName: { target, update, guard, action } }`)
 * - Conditional targets based on active state or payload
 * - Navigation history and back/undo support (`target: ({ undo }) => undo()` or `target: 'BACK'`)
 * - Universal `trigger(event, payload)` and `trigger({ event, payload })`
 * - Dynamically generated methods on the store (e.g. `store.nextPressed(payload)`)
 * - `canTrigger(event)` to test if an event is valid in the current step
 * - `undo()` convenience method
 */
export function withSteppedFormWorkflow<
  TSteps extends object,
  const TConfig extends {
    workflow: {
      [K in keyof TSteps & string]?: {
        on?: Record<
          string,
          StepTransitionConfig<keyof TSteps & string, TSteps[K], TSteps, any>
        >;
      };
    };
  }
>(config: TConfig) {
  type StepKey = keyof TSteps & string;
  type Events = ExtractAllEvents<TConfig['workflow']>;

  return signalStoreFeature(
    // Enforce that withMultiStepFormState has been added upstream
    type<{
      state: MultiStepFormState<TSteps, StepKey>;
    }>(),
    withMethods((store) => {
      /**
       * Internal transition evaluation engine.
       */
      function evaluateEvent(
        eventName: string,
        payload?: any,
        execute = true
      ): boolean {
        const currentStep = store.currentStep() as StepKey;
        const currentStepConfig = (config.workflow as any)[currentStep];
        const transition = currentStepConfig?.on?.[eventName];

        // Event is not defined for current step
        if (!transition) {
          return false;
        }

        const allStepsState = store.steps() as TSteps;
        const currentStepState = (allStepsState as any)[currentStep];

        // Evaluate guard if defined
        if (transition.guard) {
          const allowed = transition.guard({
            currentStepState,
            allSteps: allStepsState,
            payload
          });
          if (!allowed) {
            return false;
          }
        }

        // If only checking feasibility (canTrigger), return true here
        if (!execute) {
          return true;
        }

        // Apply state updates if defined
        let updatedStepsState = allStepsState;
        if (transition.update) {
          const patch = transition.update({
            currentStepState,
            allSteps: allStepsState,
            payload
          });
          updatedStepsState = {
            ...allStepsState,
            [currentStep]: {
              ...currentStepState,
              ...patch
            }
          };
          patchState(store, { steps: updatedStepsState });
        }

        // Run side-effect action if defined
        if (transition.action) {
          transition.action({
            currentStepState: (updatedStepsState as any)[currentStep],
            allSteps: updatedStepsState,
            payload
          });
        }

        // Resolve target step / transition
        const targetDef = transition.target;
        let targetStep: StepKey | BackToken | void | undefined | null;

        if (typeof targetDef === 'function') {
          targetStep = targetDef({
            currentStep,
            stepState: (updatedStepsState as any)[currentStep],
            allSteps: updatedStepsState,
            payload,
            undo: () => BACK,
            canGoBack: store.stepHistory().length > 0,
            history: store.stepHistory() as StepKey[]
          });
        } else {
          targetStep = targetDef;
        }

        // Execute step navigation
        if (targetStep === BACK || targetStep === 'undo' || targetStep === UNDO) {
          (store as any).goBack();
        } else if (typeof targetStep === 'string' && targetStep !== currentStep) {
          (store as any).goToStep(targetStep as StepKey);
        }

        return true;
      }

      function trigger(eventOrOptions: TriggerParam<Events>, payload?: any): boolean {
        const isObj = typeof eventOrOptions === 'object' && eventOrOptions !== null;
        const eventName = isObj
          ? (eventOrOptions as any).event
          : (eventOrOptions as unknown as string);

        const eventPayload = isObj && 'payload' in (eventOrOptions as object)
          ? (eventOrOptions as any).payload
          : payload;

        return evaluateEvent(String(eventName), eventPayload, true);
      }

      function canTrigger(eventOrOptions: TriggerParam<Events>, payload?: any): boolean {
        const isObj = typeof eventOrOptions === 'object' && eventOrOptions !== null;
        const eventName = isObj
          ? (eventOrOptions as any).event
          : (eventOrOptions as unknown as string);

        const eventPayload = isObj && 'payload' in (eventOrOptions as object)
          ? (eventOrOptions as any).payload
          : payload;

        return evaluateEvent(String(eventName), eventPayload, false);
      }

      // Collect all unique event names declared across all steps
      const allEvents = new Set<string>();
      for (const stepKey of Object.keys(config.workflow)) {
        const stepDef = (config.workflow as any)[stepKey];
        if (stepDef?.on) {
          for (const ev of Object.keys(stepDef.on)) {
            allEvents.add(ev);
          }
        }
      }

      // Build dynamic helper methods for each event (e.g. store.nextPressed(payload))
      const dynamicMethods: Record<string, (payload?: any) => boolean> = {};
      for (const ev of allEvents) {
        dynamicMethods[ev] = (payload?: any) => trigger(ev as Events, payload);
      }

      return {
        ...dynamicMethods,
        trigger,
        canTrigger,
        undo: () => (store as any).goBack()
      } as WorkflowBaseMethods;
    })
  );
}

/**
 * Fluent builder factory that couples step state and workflow definitions
 * with end-to-end type inference and zero generic boilerplate.
 *
 * @example
 * ```ts
 * const form = createMultiStepForm({
 *   initialStep: 'step1',
 *   steps: {
 *     step1: { isComplete: false },
 *     step2: { isComplete: false },
 *     confirmationStep: { hasBeenSubmitted: false }
 *   }
 * });
 *
 * export const RegistrationStore = signalStore(
 *   form.withState(),
 *   form.withWorkflow({
 *     workflow: {
 *       step1: {
 *         on: {
 *           nextPressed: {
 *             target: 'step2',
 *             update: ({ currentStepState }) => ({ isComplete: true })
 *           }
 *         }
 *       },
 *       // ...
 *     }
 *   })
 * );
 * ```
 */
export function createMultiStepForm<
  TSteps extends object,
  TInitialStep extends keyof TSteps & string = keyof TSteps & string
>(config: {
  initialStep: TInitialStep;
  steps: TSteps;
}) {
  return {
    /** The base configuration object */
    config,

    /** Store feature that initializes multi-step state, computed signals, and navigation methods */
    withState: () => withMultiStepFormState(config),

    /** Store feature that adds workflow state transitions and dynamic event methods */
    withWorkflow: <
      const TConfig extends {
        workflow: {
          [K in keyof TSteps & string]?: {
            on?: Record<
              string,
              StepTransitionConfig<keyof TSteps & string, TSteps[K], TSteps, any>
            >;
          };
        };
      }
    >(workflowConfig: TConfig) =>
      withSteppedFormWorkflow<TSteps, TConfig>(workflowConfig)
  };
}
