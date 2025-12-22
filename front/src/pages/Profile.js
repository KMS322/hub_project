import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/useAuthStore";
import Header from "../components/Header";
import authService from "../api/authService";
import AlertModal from "../components/AlertModal";
import ConfirmModal from "../components/ConfirmModal";
import EditPassword from "../components/EditPassword";
import "./Profile.css";

function Profile() {
  const navigate = useNavigate();
  const { user, updateUser, logout } = useAuthStore();

  const [formData, setFormData] = useState({
    email: "",
    name: "",
    postcode: "",
    address: "",
    detail_address: "",
    phone: "",
  });
  const [phoneParts, setPhoneParts] = useState({
    part1: '', // 3자리 (02, 031 등)
    part2: '', // 3-4자리
    part3: ''  // 4자리
  });

  const [alertModal, setAlertModal] = useState({
    isOpen: false,
    title: "",
    message: "",
  });
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: null,
  });
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const response = await authService.getMe();
      if (response.success && response.data?.user) {
        const userData = response.data.user;
        const phone = userData.phone || "";
        
        // 전화번호 파싱
        const phonePartsArray = phone.split('-');
        const parsedPhoneParts = {
          part1: phonePartsArray[0] || '',
          part2: phonePartsArray[1] || '',
          part3: phonePartsArray[2] || ''
        };
        
        setFormData({
          email: userData.email || "",
          name: userData.name || "",
          postcode: userData.postcode || "",
          address: userData.address || "",
          detail_address: userData.detail_address || "",
          phone: phone,
        });
        setPhoneParts(parsedPhoneParts);
      }
    } catch (error) {
      console.error("Failed to load user data:", error);
    }
  };

  const handleChange = (e) => {
    const value =
      e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setFormData({
      ...formData,
      [e.target.name]: value,
    });
  };

  // 전화번호 파트별 입력 처리
  const handlePhonePartChange = (part, value) => {
    // 숫자만 허용
    const numericValue = value.replace(/\D/g, '')
    
    let newPhoneParts = { ...phoneParts }
    
    if (part === 'part1') {
      // 첫 번째 파트: 최대 3자리
      newPhoneParts.part1 = numericValue.slice(0, 3)
      // 3자리 입력 시 다음 필드로 포커스 이동
      if (numericValue.length === 3) {
        setTimeout(() => {
          document.getElementById('profile-phone-part2')?.focus()
        }, 0)
      }
    } else if (part === 'part2') {
      // 두 번째 파트: 최대 4자리
      newPhoneParts.part2 = numericValue.slice(0, 4)
      // 4자리 입력 시 다음 필드로 포커스 이동
      if (numericValue.length === 4) {
        setTimeout(() => {
          document.getElementById('profile-phone-part3')?.focus()
        }, 0)
      }
    } else if (part === 'part3') {
      // 세 번째 파트: 최대 4자리
      newPhoneParts.part3 = numericValue.slice(0, 4)
    }
    
    setPhoneParts(newPhoneParts)
    
    // 전체 전화번호 조합 (하이픈 포함)
    const fullPhone = `${newPhoneParts.part1}${newPhoneParts.part2 ? '-' + newPhoneParts.part2 : ''}${newPhoneParts.part3 ? '-' + newPhoneParts.part3 : ''}`
    setFormData({
      ...formData,
      phone: fullPhone
    })
  }

  // 전화번호 파트별 백스페이스 처리
  const handlePhonePartKeyDown = (part, e) => {
    if (e.key === 'Backspace') {
      const currentValue = phoneParts[part]
      if (currentValue === '' && part === 'part2') {
        // 두 번째 필드가 비어있으면 첫 번째 필드로 포커스 이동
        e.preventDefault()
        document.getElementById('profile-phone-part1')?.focus()
      } else if (currentValue === '' && part === 'part3') {
        // 세 번째 필드가 비어있으면 두 번째 필드로 포커스 이동
        e.preventDefault()
        document.getElementById('profile-phone-part2')?.focus()
      }
    }
  }

  const handleEditToggle = () => {
    if (isEditing) {
      // 편집 모드를 취소하는 경우 원래 데이터로 복원
      loadUserData();
    }
    setIsEditing(!isEditing);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isEditing) {
      // 수정 모드로 전환
      setIsEditing(true);
      return;
    }

    // 저장 처리
    setLoading(true);

    try {
      const result = await authService.updateUser({
        name: formData.name,
        postcode: formData.postcode,
        address: formData.address,
        detail_address: formData.detail_address,
        phone: formData.phone,
      });

      // Zustand 스토어 업데이트
      updateUser(result.user);

      setAlertModal({
        isOpen: true,
        title: "수정 완료",
        message: "정보가 수정되었습니다.",
      });
      setIsEditing(false);
    } catch (error) {
      setAlertModal({
        isOpen: true,
        title: "오류",
        message: error.message || "정보 수정에 실패했습니다.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = () => {
    setConfirmModal({
      isOpen: true,
      title: "회원 탈퇴",
      message: "정말 탈퇴하시겠습니까? 모든 데이터가 삭제됩니다.",
      onConfirm: () => {
        logout();
        navigate("/login");
      },
    });
  };

  return (
    <div className="profile-page">
      <Header />
      <div className="profile-container">
        <form onSubmit={handleSubmit} className="profile-form">
          <div className="form-section">
            <h2>기본 정보</h2>
            <div className="form-group">
              <label htmlFor="email">이메일</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                disabled
                className="disabled-input"
              />
              <span className="help-text">이메일은 변경할 수 없습니다.</span>
            </div>
          </div>

          <div className="form-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0 }}>병원 정보</h2>
              {!isEditing && (
                <span style={{ fontSize: '0.9rem', color: '#666' }}>
                  정보를 수정하려면 아래 "정보 수정" 버튼을 클릭하세요
                </span>
              )}
            </div>
            <div className="form-group">
              <label htmlFor="name">병원명 *</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                disabled={!isEditing}
                className={!isEditing ? "disabled-input" : ""}
                placeholder="병원명을 입력하세요"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="postcode">우편번호 *</label>
              <input
                type="text"
                id="postcode"
                name="postcode"
                value={formData.postcode}
                onChange={handleChange}
                disabled={!isEditing}
                className={!isEditing ? "disabled-input" : ""}
                placeholder="우편번호를 입력하세요"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="address">주소 *</label>
              <input
                type="text"
                id="address"
                name="address"
                value={formData.address}
                onChange={handleChange}
                disabled={!isEditing}
                className={!isEditing ? "disabled-input" : ""}
                placeholder="주소를 입력하세요"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="detail_address">상세주소 *</label>
              <input
                type="text"
                id="detail_address"
                name="detail_address"
                value={formData.detail_address}
                onChange={handleChange}
                disabled={!isEditing}
                className={!isEditing ? "disabled-input" : ""}
                placeholder="상세주소를 입력하세요"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="phone">병원 전화번호 *</label>
              <div className="phone-input-group">
                <input
                  type="tel"
                  id="profile-phone-part1"
                  value={phoneParts.part1}
                  onChange={(e) => handlePhonePartChange('part1', e.target.value)}
                  onKeyDown={(e) => handlePhonePartKeyDown('part1', e)}
                  disabled={!isEditing}
                  className={!isEditing ? "disabled-input" : ""}
                  placeholder="02"
                  maxLength={3}
                  required
                  style={{ width: '80px', textAlign: 'center' }}
                />
                <span className="phone-separator">-</span>
                <input
                  type="tel"
                  id="profile-phone-part2"
                  value={phoneParts.part2}
                  onChange={(e) => handlePhonePartChange('part2', e.target.value)}
                  onKeyDown={(e) => handlePhonePartKeyDown('part2', e)}
                  disabled={!isEditing}
                  className={!isEditing ? "disabled-input" : ""}
                  placeholder="1234"
                  maxLength={4}
                  required
                  style={{ width: '100px', textAlign: 'center' }}
                />
                <span className="phone-separator">-</span>
                <input
                  type="tel"
                  id="profile-phone-part3"
                  value={phoneParts.part3}
                  onChange={(e) => handlePhonePartChange('part3', e.target.value)}
                  onKeyDown={(e) => handlePhonePartKeyDown('part3', e)}
                  disabled={!isEditing}
                  className={!isEditing ? "disabled-input" : ""}
                  placeholder="5678"
                  maxLength={4}
                  required
                  style={{ width: '100px', textAlign: 'center' }}
                />
              </div>
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? "저장 중..." : isEditing ? "병원 정보 저장" : "병원 정보 수정"}
            </button>
            {isEditing && (
              <button
                type="button"
                className="btn-secondary"
                onClick={handleEditToggle}
                disabled={loading}
              >
                취소
              </button>
            )}
          </div>
        </form>

        <EditPassword />

        <div className="withdraw-section">
          <button type="button" className="btn-danger" onClick={handleWithdraw}>
            회원 탈퇴
          </button>
        </div>
      </div>

      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal({ isOpen: false, title: "", message: "" })}
        title={alertModal.title}
        message={alertModal.message}
      />
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() =>
          setConfirmModal({
            isOpen: false,
            title: "",
            message: "",
            onConfirm: null,
          })
        }
        onConfirm={confirmModal.onConfirm || (() => {})}
        title={confirmModal.title}
        message={confirmModal.message}
      />
    </div>
  );
}

export default Profile;
