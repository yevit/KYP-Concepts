import '@angular/compiler';
import { RegistrationFormStore } from './registration-form.store';

/**
 * Proof-of-concept execution demonstrating usage of the multi-step signal store.
 */
export function runMultiStepFormDemo() {
  console.log('--- Initializing Registration Form Store ---');
  const store = new RegistrationFormStore();

  console.log('Initial Step:', store.currentStep()); // 'step1'
  console.log('Initial Step 1 State:', store.currentStepState()); // { isComplete: false, name: '' }
  console.log('Can go back?:', store.canGoBack()); // false

  // 1. Trigger event with external payload:
  // Both invocation styles are fully supported:
  // - store.trigger('nextPressed', payload)
  // - store.trigger({ event: 'nextPressed', payload })
  console.log('\n--- Action: Triggering nextPressed with payload { name: "Alice Smith" } ---');
  store.trigger({ event: 'nextPressed', payload: { name: 'Alice Smith' } });

  console.log('Current Step:', store.currentStep()); // 'step2'
  console.log('Step 1 State in Store:', store.steps().step1); // { isComplete: true, name: 'Alice Smith' }
  console.log('Step 2 Current State:', store.currentStepState()); // { isComplete: false, email: '', acceptedTerms: false }
  console.log('Can go back?:', store.canGoBack()); // true
  console.log('Step History:', store.history()); // ['step1']

  // 2. Test conditional target in Step 2:
  // If acceptedTerms is false, staying on step2
  console.log('\n--- Action: Triggering nextPressed without accepting terms ---');
  store.trigger('nextPressed', { email: 'alice@example.com', acceptedTerms: false });
  console.log('Current Step (stayed on step2 because terms not accepted):', store.currentStep()); // 'step2'

  // Now accept terms and proceed to confirmationStep
  console.log('\n--- Action: Triggering nextPressed with acceptedTerms: true ---');
  store.trigger('nextPressed', { email: 'alice@example.com', acceptedTerms: true });
  console.log('Current Step (transitioned to confirmationStep):', store.currentStep()); // 'confirmationStep'
  console.log('Confirmation Step State:', store.currentStepState()); // { hasBeenSubmitted: false, confirmationId: null }
  console.log('History stack:', store.history()); // ['step1', 'step2']

  // 3. Test Back / Undo functionality:
  console.log('\n--- Action: User clicks Back from Confirmation Step ---');
  store.trigger('backPressed'); // Target resolves to 'BACK' / undo()
  console.log('Current Step after back:', store.currentStep()); // 'step2'
  console.log('Step 2 data preserved?:', store.currentStepState()); // { isComplete: true, email: 'alice@example.com', acceptedTerms: true }
  console.log('History stack:', store.history()); // ['step1']

  // Navigate forward again (can also invoke dynamic method: store.nextPressed?.(...))
  console.log('\n--- Action: Forward to confirmation again (via dynamic method) ---');
  store['nextPressed']?.({ acceptedTerms: true });
  console.log('Current Step:', store.currentStep()); // 'confirmationStep'

  // 4. Submit form:
  console.log('\n--- Action: Submit form ---');
  store.trigger({ event: 'formSubmitted', payload: { confirmationId: 'ORDER-12345' } });
  console.log('Confirmation Step State after submit:', store.currentStepState()); // { hasBeenSubmitted: true, confirmationId: 'ORDER-12345' }

  // 5. Test event checking:
  console.log('\n--- Syntax Demo: store.canTrigger() ---');
  console.log('Can trigger "formSubmitted" on confirmationStep?:', store.canTrigger('formSubmitted')); // true
  console.log('Can trigger "nextPressed" on confirmationStep?:', store.canTrigger('nextPressed')); // false

  // 6. Demonstrate undo() method:
  console.log('\n--- Action: Calling store.undo() directly ---');
  store.undo();
  console.log('Current Step after undo():', store.currentStep()); // 'step2'

  // 7. Demonstrate form reset:
  console.log('\n--- Action: Reset form ---');
  store.resetForm();
  console.log('Current Step after reset:', store.currentStep()); // 'step1'
  console.log('Step 1 state after reset:', store.currentStepState()); // { isComplete: false, name: '' }
  console.log('Can go back?:', store.canGoBack()); // false
}

// Execute demo
runMultiStepFormDemo();
