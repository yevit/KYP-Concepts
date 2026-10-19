import { signalStore } from '@ngrx/signals';
import {
  BACK,
  createMultiStepConfig,
  createMultiStepForm,
  withMultiStepFormState,
  withSteppedFormWorkflow
} from '../multi-step-form';

/* =========================================================================
 * 1. Form Step State Shapes & Initial Configuration
 * ========================================================================= */

/**
 * Step state types for a registration form.
 * Each step has its own tailored state shape.
 */
export interface RegistrationSteps {
  step1: {
    isComplete: boolean;
    name: string;
  };
  step2: {
    isComplete: boolean;
    email: string;
    acceptedTerms: boolean;
  };
  confirmationStep: {
    hasBeenSubmitted: boolean;
    confirmationId: string | null;
  };
}

/**
 * Initial configuration for the multi-step form.
 * `createMultiStepConfig` enforces that `initialStep` must be a valid step key.
 */
export const initialRegistrationConfig = createMultiStepConfig<RegistrationSteps, 'step1'>({
  initialStep: 'step1',
  steps: {
    step1: {
      isComplete: false,
      name: ''
    },
    step2: {
      isComplete: false,
      email: '',
      acceptedTerms: false
    },
    confirmationStep: {
      hasBeenSubmitted: false,
      confirmationId: null
    }
  }
});

/* =========================================================================
 * 2. Store Implementation - Approach A: Fluent Builder API
 *
 * `createMultiStepForm` binds the step types from initial configuration,
 * providing seamless type inference across both features with ZERO boilerplate.
 * ========================================================================= */

const registrationForm = createMultiStepForm(initialRegistrationConfig);

export const RegistrationFormStore = signalStore(
  // Feature 1: Multi-step state, computed signals, and navigation
  registrationForm.withState(),

  // Feature 2: Workflow state machine, event transitions, and dynamic methods
  registrationForm.withWorkflow({
    workflow: {
      step1: {
        on: {
          nextPressed: {
            target: 'step2',
            // Update current step state, with optional payload from outside the store
            update: ({ currentStepState, payload }: { currentStepState: RegistrationSteps['step1']; payload?: { name?: string } }) => ({
              isComplete: true,
              name: payload?.name ?? currentStepState.name
            })
          }
        }
      },

      step2: {
        on: {
          nextPressed: {
            // Target can be a function that views state to decide destination
            target: ({ stepState, payload }) => {
              const termsAccepted = payload?.acceptedTerms ?? stepState.acceptedTerms;
              return termsAccepted ? 'confirmationStep' : 'step2';
            },
            update: ({ currentStepState, payload }: { currentStepState: RegistrationSteps['step2']; payload?: { email?: string; acceptedTerms?: boolean } }) => ({
              isComplete: true,
              email: payload?.email ?? currentStepState.email,
              acceptedTerms: payload?.acceptedTerms ?? currentStepState.acceptedTerms
            })
          },

          backPressed: {
            // Function returning undo() or simply 'BACK' token
            target: ({ undo }) => undo()
          }
        }
      },

      confirmationStep: {
        on: {
          formSubmitted: {
            update: ({ payload }: { payload?: { confirmationId?: string } }) => ({
              hasBeenSubmitted: true,
              confirmationId: payload?.confirmationId ?? 'REF-' + Math.random().toString(36).substring(2, 9).toUpperCase()
            }),
            action: ({ currentStepState }) => {
              console.log('Registration submitted successfully! Confirmation ID:', currentStepState.confirmationId);
            }
          },

          backPressed: {
            target: BACK
          }
        }
      }
    }
  })
);

/* =========================================================================
 * 3. Store Implementation - Approach B: Standalone Features
 *
 * Alternatively, `withMultiStepFormState` and `withSteppedFormWorkflow`
 * can be used directly and independently composed with any other store features.
 * ========================================================================= */

const standaloneWorkflow = {
  workflow: {
    step1: {
      on: {
        nextPressed: {
          target: 'step2' as const,
          update: () => ({ isComplete: true })
        }
      }
    },
    step2: {
      on: {
        nextPressed: {
          target: 'confirmationStep' as const,
          update: () => ({ isComplete: true })
        },
        backPressed: {
          target: ({ undo }: { undo: () => typeof BACK }) => undo()
        }
      }
    },
    confirmationStep: {
      on: {
        formSubmitted: {
          update: () => ({ hasBeenSubmitted: true })
        },
        backPressed: {
          target: BACK
        }
      }
    }
  }
} as const;

export const StandaloneRegistrationStore = signalStore(
  withMultiStepFormState(initialRegistrationConfig),
  withSteppedFormWorkflow<RegistrationSteps, typeof standaloneWorkflow>(standaloneWorkflow)
);
