"use client"

import { useState, useEffect } from "react"
import { Routes, Route, Navigate, useNavigate } from "react-router-dom"
import {
  Search,
  MessageCircle,
  FileText,
  CheckSquare,
  Database,
  Cloud,
  Briefcase,
  Settings,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Users,
  User,
  ImageIcon,
} from "lucide-react"
import "bootstrap/dist/css/bootstrap.min.css"
import "./App.css"

// Components
import Login from "./components/Login"

function MainApp() {
  const [activeTab, setActiveTab] = useState("Ưu tiên")
  const [currentSlide, setCurrentSlide] = useState(0)
  const [user, setUser] = useState(null)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    // Lấy thông tin user từ localStorage khi component mount
    const userStr = localStorage.getItem("user")
    if (userStr) {
      try {
        const userData = JSON.parse(userStr)
        setUser(userData)
      } catch (err) {
        console.error("Error parsing user data:", err)
      }
    }
  }, [])

  const handleLogout = () => {
    // Xóa thông tin đăng nhập
    localStorage.removeItem("accessToken")
    localStorage.removeItem("refreshToken")
    localStorage.removeItem("user")
    // Chuyển về trang login
    navigate("/login", { replace: true })
  }

  const handlePrevSlide = () => {
    setCurrentSlide((prev) => (prev > 0 ? prev - 1 : 0))
  }

  const handleNextSlide = () => {
    setCurrentSlide((prev) => (prev < 4 ? prev + 1 : 4))
  }

  const slides = [
    {
      id: 1,
      image: "/images/slide1.png",
      title: "Nhắn tin nhiều hơn, soạn thảo ít hơn",
      description: "Sử dụng Tin Nhắn Nhanh để lưu sẵn các tin nhắn thường dùng và gửi nhanh trong hội thoại bất kỳ."
    },
    {
      id: 2,
      image: "/images/slide2.png",
      title: "Trải nghiệm xuyên suốt",
      description: "Kết nối và giải quyết công việc trên mọi thiết bị với dữ liệu luôn được đồng bộ."
    },
    {
      id: 3,
      image: "/images/slide3.png",
      title: "Gửi file không giới hạn",
      description: "Chia sẻ hình ảnh, file văn bản, bảng tính... với dung lượng không giới hạn."
    },
    {
      id: 4,
      image: "/images/slide4.png",
      title: "Chat nhóm với đồng nghiệp",
      description: "Trao đổi công việc nhóm một cách hiệu quả trong không gian làm việc riêng."
    }
  ]

  return (
    <div className="d-flex vh-100" style={{ backgroundColor: "#f0f5ff" }}>
      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-top">
          <div className="user-profile" style={{ position: 'relative' }}>
            <div 
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              style={{ cursor: 'pointer' }}
            >
              <img 
                src={user?.avatar} 
                alt={user?.name || "User"} 
                className="avatar"
                title={user?.name || "User"}
                onError={(e) => {
                  e.target.onerror = null;
                  // Nếu avatar không load được, sử dụng UI Avatars làm fallback
                  e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || "User")}&background=random`;
                }}
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "50%",
                  objectFit: "cover"
                }}
              />
              {user?.status === "online" && (
                <span className="status-badge"></span>
              )}
            </div>

            {/* Profile Dropdown Menu */}
            {showProfileMenu && (
              <div 
                style={{
                  position: 'absolute',
                  left: '60px',
                  top: '0',
                  backgroundColor: 'white',
                  borderRadius: '8px',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
                  width: '280px',
                  zIndex: 1000,
                }}
              >
                {/* User Info */}
                <div style={{ padding: '16px', borderBottom: '1px solid #E6E8EB' }}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                    <img 
                      src={user?.avatar} 
                      alt={user?.name}
                      style={{
                        width: '64px',
                        height: '64px',
                        borderRadius: '50%',
                        marginRight: '12px',
                        objectFit: 'cover'
                      }}
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || "User")}&background=random`;
                      }}
                    />
                    <div>
                      <h3 style={{ 
                        margin: '0', 
                        fontSize: '16px', 
                        fontWeight: '600',
                        color: '#081C36'
                      }}>{user?.name}</h3>
                      <p style={{ 
                        margin: '4px 0 0', 
                        fontSize: '14px',
                        color: '#7589A3' 
                      }}>{user?.phone}</p>
                    </div>
                  </div>
                </div>

                {/* Menu Items */}
                <div style={{ padding: '8px 0' }}>
                  <button 
                    onClick={() => {/* TODO: Xử lý xem thông tin cá nhân */}}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '12px 16px',
                      width: '100%',
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                      color: '#081C36',
                      fontSize: '14px',
                      textAlign: 'left'
                    }}
                  >
                    <User size={20} style={{ marginRight: '12px', color: '#7589A3' }} />
                    Thông tin cá nhân
                  </button>
                  <button 
                    onClick={handleLogout}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '12px 16px',
                      width: '100%',
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                      color: '#FF4D4F',
                      fontSize: '14px',
                      textAlign: 'left'
                    }}
                  >
                    <Settings size={20} style={{ marginRight: '12px' }} />
                    Đăng xuất
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="nav-items">
            <button className="nav-item active">
              <MessageCircle size={24} />
            </button>
            <button className="nav-item">
              <Users size={24} />
            </button>
            <button className="nav-item">
              <FileText size={24} />
            </button>
            <button className="nav-item">
              <Cloud size={24} />
            </button>
            <button className="nav-item">
              <CheckSquare size={24} />
            </button>
            <button className="nav-item">
              <Database size={24} />
            </button>
            <button className="nav-item">
              <Briefcase size={24} />
            </button>
          </div>
        </div>
        <div className="sidebar-bottom">
          <button className="nav-item">
            <Settings size={24} />
          </button>
        </div>
      </div>

      {/* Chat List */}
      <div className="chat-list">
        <div className="chat-list-header">
          <div className="search-box">
            <Search size={20} className="search-icon" />
            <input type="text" placeholder="Tìm kiếm" />
          </div>
          <button className="add-chat-btn">
            <MessageCircle size={20} />
            <span>Tạo nhóm mới</span>
          </button>
        </div>

        <div className="chat-tabs">
          <button
            className={`chat-tab ${activeTab === "Ưu tiên" ? "active" : ""}`}
            onClick={() => setActiveTab("Ưu tiên")}
          >
            Ưu tiên
          </button>
          <button
            className={`chat-tab ${activeTab === "Khác" ? "active" : ""}`}
            onClick={() => setActiveTab("Khác")}
          >
            Khác
          </button>
          <button
            className={`chat-tab ${activeTab === "Tất cả" ? "active" : ""}`}
            onClick={() => setActiveTab("Tất cả")}
          >
            Tất cả
          </button>
        </div>

        <div className="chat-items">
          {/* Chat items will be rendered here */}
        </div>
      </div>

      {/* Main Content */}
      <div className="main-content">
        <div className="welcome-screen">
          <div className="carousel-container">
            <button className="carousel-btn prev" onClick={handlePrevSlide}>
              <ChevronLeft size={24} />
            </button>
            <div className="carousel-content">
              {slides[currentSlide] && (
                <>
                  <img
                    src={slides[currentSlide].image}
                    alt={slides[currentSlide].title}
                    className="carousel-image"
                  />
                  <div className="welcome-text">
                    <h2>{slides[currentSlide].title}</h2>
                    <p>{slides[currentSlide].description}</p>
                  </div>
                </>
              )}
            </div>
            <button className="carousel-btn next" onClick={handleNextSlide}>
              <ChevronRight size={24} />
            </button>
          </div>
          
          {/* Slide indicators */}
          <div className="carousel-indicators">
            {slides.map((slide, index) => (
              <button
                key={slide.id}
                className={`carousel-indicator ${currentSlide === index ? 'active' : ''}`}
                onClick={() => setCurrentSlide(index)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Kiểm tra token và user data khi component mount
    const checkAuth = () => {
      const token = localStorage.getItem("accessToken")
      const userStr = localStorage.getItem("user")
      
      if (token && userStr) {
        try {
          const userData = JSON.parse(userStr)
          if (userData) {
            setIsAuthenticated(true)
          }
        } catch (err) {
          console.error("Error parsing user data:", err)
          // Xóa dữ liệu không hợp lệ
          localStorage.removeItem("accessToken")
          localStorage.removeItem("user")
        }
      }
      setIsLoading(false)
    }

    checkAuth()
  }, [])

  if (isLoading) {
    return <div>Loading...</div>
  }

  return (
    <Routes>
      <Route 
        path="/login" 
        element={
          isAuthenticated ? 
            <Navigate to="/app" replace /> : 
            <Login setIsAuthenticated={setIsAuthenticated} />
        } 
      />
      <Route 
        path="/app/*" 
        element={
          isAuthenticated ? 
            <MainApp /> : 
            <Navigate to="/login" replace />
        } 
      />
      <Route 
        path="/" 
        element={<Navigate to={isAuthenticated ? "/app" : "/login"} replace />} 
      />
    </Routes>
  )
}

function ChatItem({ avatars, name, message, time, count, badge, hasImage, hasMore }) {
  return (
    <div className="d-flex p-3 border-bottom cursor-pointer" style={{ cursor: "pointer" }}>
      <div className="position-relative me-3">
        {avatars.length === 1 ? (
          <div className="rounded-circle overflow-hidden" style={{ width: "48px", height: "48px" }}>
            <img src={avatars[0] || "/placeholder.svg"} alt="" className="w-100 h-100 object-fit-cover" />
          </div>
        ) : (
          <div className="position-relative" style={{ width: "48px", height: "48px" }}>
            <div
              className="position-absolute top-0 start-0 rounded-circle overflow-hidden border border-2 border-white"
              style={{ width: "32px", height: "32px" }}
            >
              <img src={avatars[0] || "/placeholder.svg"} alt="" className="w-100 h-100 object-fit-cover" />
            </div>
            <div
              className="position-absolute bottom-0 end-0 rounded-circle overflow-hidden border border-2 border-white"
              style={{ width: "32px", height: "32px" }}
            >
              <img src={avatars[1] || "/placeholder.svg"} alt="" className="w-100 h-100 object-fit-cover" />
            </div>
          </div>
        )}

        {badge && (
          <div
            className="position-absolute bottom-0 start-0 translate-middle rounded-circle bg-info text-white d-flex align-items-center justify-content-center fw-bold"
            style={{ width: "20px", height: "20px", fontSize: "10px" }}
          >
            {badge}
          </div>
        )}
      </div>

      <div className="flex-grow-1 min-width-0">
        <div className="d-flex justify-content-between align-items-start">
          <h3 className="fw-medium text-truncate mb-0" style={{ fontSize: "0.875rem" }}>
            {name}
          </h3>
          {time && (
            <span className="text-secondary ms-1" style={{ fontSize: "0.75rem", whiteSpace: "nowrap" }}>
              {time}
            </span>
          )}
        </div>

        <div className="d-flex align-items-center mt-1">
          <p className="text-secondary text-truncate mb-0 flex-grow-1" style={{ fontSize: "0.875rem" }}>
            {hasImage && <ImageIcon size={14} className="me-1" style={{ display: "inline" }} />}
            {message}
          </p>

          <div className="d-flex align-items-center ms-2">
            {count && (
              <span className="badge rounded-pill text-bg-primary" style={{ fontSize: "0.75rem", minWidth: "20px" }}>
                {count}
              </span>
            )}
            {hasMore && (
              <span className="badge rounded-pill bg-secondary ms-1" style={{ fontSize: "0.75rem" }}>
                5+
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
} 