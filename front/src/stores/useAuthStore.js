import { create } from "zustand";
import { persist, devtools } from "zustand/middleware";
import authService from "../api/authService";

export const useAuthStore = create(
  devtools(
    persist(
      (set) => ({
      // 상태
      user: null,
      isAuthenticated: false,
      token: null,

      // 비동기 상태 (loading, error)
      loginStatus: 'idle', // 'idle' | 'loading' | 'success' | 'failure'
      loginError: null,
      registerStatus: 'idle',
      registerError: null,

      // 로그인
      login: async (email, password) => {
        set({ loginStatus: 'loading', loginError: null });

        try {
          const { user, token } = await authService.login(email, password);

          set({
            user,
            token,
            isAuthenticated: true,
            loginStatus: 'success',
            loginError: null,
          });

          return { success: true, user };
        } catch (error) {
          console.error("Login failed:", error);

          set({
            loginStatus: 'failure',
            loginError: error.message || '로그인에 실패했습니다.',
          });

          return { success: false, error: error.message || '로그인에 실패했습니다.' };
        }
      },

      // 회원가입
      register: async (formData) => {
        set({ registerStatus: 'loading', registerError: null });

        try {
          const { user, token } = await authService.register({
            email: formData.email,
            password: formData.password,
            name: formData.name,
            postcode: formData.postcode,
            address: formData.address,
            detail_address: formData.detail_address,
            phone: formData.phone
          });

          set({
            user,
            token,
            isAuthenticated: true,
            registerStatus: 'success',
            registerError: null,
          });

          return { success: true, user };
        } catch (error) {
          console.error("Registration failed:", error);

          set({
            registerStatus: 'failure',
            registerError: error.message || '회원가입에 실패했습니다.',
          });

          return { success: false, error: error.message || '회원가입에 실패했습니다.' };
        }
      },

      // 로그아웃
      logout: () => {
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          loginStatus: 'idle',
          loginError: null,
        });
      },

      // 상태 리셋 함수들
      resetLoginStatus: () => set({ loginStatus: 'idle', loginError: null }),
      resetRegisterStatus: () => set({ registerStatus: 'idle', registerError: null }),

      // 유저 정보 업데이트
      updateUser: (userData) => {
        set((state) => ({
          user: { ...state.user, ...userData },
        }));
      },
      }),
      {
        name: "auth-storage", // localStorage 키 이름
        partialize: (state) => ({
          // localStorage에 저장할 필드만 선택
          user: state.user,
          token: state.token,
          isAuthenticated: state.isAuthenticated,
        }),
      }
    ),
    { name: 'AuthStore' } // Redux DevTools 이름
  )
);
