import { create } from "zustand";

/**
 * 전역 에러 모달 (HTTP/Socket/MQTT 요청 실패·응답 없음 시 표시)
 */
export const useErrorModalStore = create((set) => ({
  isOpen: false,
  title: "",
  message: "",

  showErrorModal: (title, message) =>
    set({ isOpen: true, title: title || "오류", message: message || "오류가 발생했습니다." }),

  closeErrorModal: () =>
    set({ isOpen: false, title: "", message: "" }),
}));
