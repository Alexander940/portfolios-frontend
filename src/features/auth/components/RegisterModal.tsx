import { Modal } from '@/components/ui';
import { useModalStore } from '../stores/modalStore';
import { RegisterForm } from './RegisterForm';

/**
 * RegisterModal Component
 *
 * Modal wrapper for the registration form.
 * Uses the modal store to control visibility.
 *
 * On successful registration:
 * - Closes the modal
 * - Sets a success message in the store (displayed on login page)
 */
export function RegisterModal() {
  const { activeModal, closeModal, setSuccessMessage } = useModalStore();
  const isOpen = activeModal === 'register';

  const handleSuccess = () => {
    setSuccessMessage('Account created successfully. You can now sign in.');
    closeModal();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={closeModal}
      title="Create account"
      description="Fill in the fields to register"
      size="md"
    >
      <RegisterForm onSuccess={handleSuccess} />
    </Modal>
  );
}
