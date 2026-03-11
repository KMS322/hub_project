import AlertModal from "./AlertModal";
import { useErrorModalStore } from "../stores/useErrorModalStore";

export default function GlobalErrorModal() {
  const { isOpen, title, message, closeErrorModal } = useErrorModalStore();
  return (
    <AlertModal
      isOpen={isOpen}
      title={title}
      message={message}
      onClose={closeErrorModal}
    />
  );
}
