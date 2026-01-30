import { create } from 'zustand';

/**
 * Modal state interface
 */
interface ModalState {
  /** Currently active modal identifier, or null if no modal is open */
  activeModal: string | null;
  /** Success message to display after certain operations (e.g., registration) */
  successMessage: string | null;
}

/**
 * Modal actions interface
 */
interface ModalActions {
  /** Open a modal by its identifier */
  openModal: (modalId: string) => void;
  /** Close the currently active modal */
  closeModal: () => void;
  /** Set a success message */
  setSuccessMessage: (message: string | null) => void;
  /** Clear the success message */
  clearSuccessMessage: () => void;
}

/**
 * Combined modal store type
 */
export type ModalStore = ModalState & ModalActions;

/**
 * Modal store for managing modal visibility
 *
 * Usage:
 * - Open modal: useModalStore.getState().openModal('register')
 * - Close modal: useModalStore.getState().closeModal()
 * - Within component: const { activeModal, openModal, closeModal } = useModalStore()
 */
export const useModalStore = create<ModalStore>((set) => ({
  // Initial state
  activeModal: null,
  successMessage: null,

  // Actions
  openModal: (modalId: string) => {
    set({ activeModal: modalId });
  },

  closeModal: () => {
    set({ activeModal: null });
  },

  setSuccessMessage: (message: string | null) => {
    set({ successMessage: message });
  },

  clearSuccessMessage: () => {
    set({ successMessage: null });
  },
}));
