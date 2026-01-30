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
    setSuccessMessage('¡Cuenta creada exitosamente! Ahora puedes iniciar sesión.');
    closeModal();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={closeModal}
      title="Crear cuenta"
      description="Completa los campos para registrarte"
      size="md"
    >
      <RegisterForm onSuccess={handleSuccess} />
    </Modal>
  );
}
