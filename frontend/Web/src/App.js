"use client"

import { useState, useEffect } from "react"
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

export default function App() {
  const [activeTab, setActiveTab] = useState("Ưu tiên")
  const [currentSlide, setCurrentSlide] = useState(0)

  // Bootstrap requires JavaScript for some components
  useEffect(() => {
    // Import Bootstrap JS only on client side
    if (typeof window !== "undefined") {
      require("bootstrap/dist/js/bootstrap.bundle.min.js")
    }
  }, [])

  const handlePrevSlide = () => {
    setCurrentSlide((prev) => (prev > 0 ? prev - 1 : 0))
  }

  const handleNextSlide = () => {
    setCurrentSlide((prev) => (prev < 4 ? prev + 1 : 4))
  }

  return (
    <div className="d-flex vh-100" style={{ backgroundColor: "#f0f5ff" }}>
      {/* Left sidebar */}
      <div className="d-flex flex-column align-items-center py-4" style={{ width: "64px", backgroundColor: "#0068ff" }}>
        <div className="rounded-circle bg-white mb-4 overflow-hidden" style={{ width: "40px", height: "40px" }}>
          <img src="/placeholder.svg?height=40&width=40" alt="Profile" className="w-100 h-100 object-fit-cover" />
        </div>

        <div className="d-flex flex-column align-items-center gap-4 flex-grow-1">
          <button
            className="d-flex align-items-center justify-content-center text-white rounded"
            style={{ width: "40px", height: "40px", backgroundColor: "#0055cc" }}
          >
            <MessageCircle size={20} />
          </button>
          <button
            className="d-flex align-items-center justify-content-center text-white border-0 bg-transparent"
            style={{ width: "40px", height: "40px" }}
          >
            <FileText size={20} />
          </button>
          <button
            className="d-flex align-items-center justify-content-center text-white border-0 bg-transparent"
            style={{ width: "40px", height: "40px" }}
          >
            <CheckSquare size={20} />
          </button>
          <button
            className="d-flex align-items-center justify-content-center text-white border-0 bg-transparent"
            style={{ width: "40px", height: "40px" }}
          >
            <Database size={20} />
          </button>
          <button
            className="d-flex align-items-center justify-content-center text-white border-0 bg-transparent"
            style={{ width: "40px", height: "40px" }}
          >
            <Cloud size={20} />
          </button>
          <button
            className="d-flex align-items-center justify-content-center text-white border-0 bg-transparent"
            style={{ width: "40px", height: "40px" }}
          >
            <Briefcase size={20} />
          </button>
        </div>

        <button
          className="d-flex align-items-center justify-content-center text-white border-0 bg-transparent mt-auto"
          style={{ width: "40px", height: "40px" }}
        >
          <Settings size={20} />
        </button>
      </div>

      {/* Chat list */}
      <div className="bg-white border-end" style={{ width: "320px" }}>
        <div className="p-3">
          <div className="position-relative">
            <Search className="position-absolute start-0 top-50 translate-middle-y ms-3 text-secondary" size={18} />
            <input
              type="text"
              placeholder="Tìm kiếm"
              className="form-control bg-light rounded-pill ps-5 pe-5"
              style={{ fontSize: "0.875rem" }}
            />
            <div className="position-absolute end-0 top-50 translate-middle-y me-2 d-flex gap-2">
              <button className="btn btn-sm text-secondary p-1">
                <User size={18} />
              </button>
              <button className="btn btn-sm text-secondary p-1">
                <Users size={18} />
              </button>
            </div>
          </div>
        </div>

        <div className="d-flex border-bottom">
          <button
            className={`flex-grow-1 py-2 border-0 bg-transparent ${
              activeTab === "Ưu tiên" ? "text-primary border-bottom border-3 border-primary" : "text-secondary"
            }`}
            style={{ fontSize: "0.875rem", fontWeight: "500" }}
            onClick={() => setActiveTab("Ưu tiên")}
          >
            Ưu tiên
          </button>
          <button
            className={`flex-grow-1 py-2 border-0 bg-transparent ${
              activeTab === "Khác" ? "text-primary border-bottom border-3 border-primary" : "text-secondary"
            }`}
            style={{ fontSize: "0.875rem", fontWeight: "500" }}
            onClick={() => setActiveTab("Khác")}
          >
            Khác
          </button>

          <div className="d-flex align-items-center px-3">
            <button className="btn btn-sm text-secondary p-0 d-flex align-items-center">
              <span style={{ fontSize: "0.875rem" }}>Phân loại</span>
              <ChevronLeft size={16} />
            </button>
            <button className="btn btn-sm text-secondary p-0 ms-2">
              <MoreHorizontal size={18} />
            </button>
          </div>
        </div>

        <div className="overflow-auto" style={{ height: "calc(100% - 110px)" }}>
          {/* Chat items */}
          <ChatItem
            avatars={["/placeholder.svg?height=40&width=40", "/placeholder.svg?height=40&width=40"]}
            name="SinhVien_Nganh_SE_Khoa"
            message="Nguyen Thi Hanh: Các bạn hãy tha..."
            time="3 ngày"
            count="99+"
          />

          <ChatItem
            avatars={["/placeholder.svg?height=40&width=40", "/placeholder.svg?height=40&width=40"]}
            name="DHKHMT18ATT_QLDA"
            message="Chưa có tin nhắn"
            time=""
            count="51"
          />

          <ChatItem
            avatars={["/placeholder.svg?height=40&width=40", "/placeholder.svg?height=40&width=40"]}
            name="422000191402_17BTT_HK2_..."
            message="Em đứng ở V7.02 từ chiều"
            time="2 ngày"
            count="53"
          />

          <ChatItem
            avatars={["/placeholder.svg?height=40&width=40", "/placeholder.svg?height=40&width=40"]}
            name="CNM-HK2-24-25KTPM17BTT..."
            message="Chưa có tin nhắn"
            time=""
            count="47"
            badge="GK"
          />

          <ChatItem
            avatars={["/placeholder.svg?height=40&width=40", "/placeholder.svg?height=40&width=40"]}
            name="IUH HK2 2025 Big Data"
            message="Bé Văn lêu khêu: Hình ảnh"
            time="2 ngày"
            count="99+"
            hasImage={true}
          />

          <ChatItem
            avatars={["/placeholder.svg?height=40&width=40"]}
            name="Cloud của tôi"
            message="Bạn: Hình ảnh"
            time="3 phút"
            hasImage={true}
          />

          <ChatItem
            avatars={["/placeholder.svg?height=40&width=40", "/placeholder.svg?height=40&width=40"]}
            name="PG/PB MC Mascot Eve..."
            message="Mr Trị: Mình cần 2b PG tiếc ngoại ..."
            time="32 phút"
            count="84"
            hasMore={true}
          />
        </div>
      </div>

      {/* Main content */}
      <div className="flex-grow-1 d-flex flex-column align-items-center justify-content-center position-relative">
        <div className="text-center" style={{ maxWidth: "32rem" }}>
          <h1 className="fw-bold mb-4 fs-2">
            Chào mừng đến với <span style={{ color: "#0068ff" }}>Zalo PC</span>!
          </h1>
          <p className="text-secondary mb-4">
            Khám phá những tiện ích hỗ trợ làm việc và trò chuyện cùng người thân, bạn bè được tối ưu hoá cho máy tính
            của bạn.
          </p>

          <div className="position-relative" style={{ height: "16rem" }}>
            {currentSlide === 0 && (
              <div className="position-absolute top-0 start-0 end-0 bottom-0 d-flex justify-content-center">
                <img
                  src="/welcome.png"
                  alt="Zalo features"
                  className="h-100 object-fit-contain"
                />
              </div>
            )}
          </div>

          <h3 className="fs-4 fw-medium mt-4" style={{ color: "#0068ff" }}>
            Nhắn tin nhiều hơn, soạn thảo ít hơn
          </h3>
          <p className="text-secondary mt-2">
            Sử dụng <strong>Tin Nhắn Nhanh</strong> để lưu sẵn các tin nhắn thường dùng và gửi nhanh trong hội thoại bất
            kỳ.
          </p>

          <div className="d-flex justify-content-center mt-4">
            <div className="d-flex gap-2">
              {[0, 1, 2, 3, 4].map((index) => (
                <button
                  key={index}
                  className="border-0 rounded-circle"
                  style={{
                    width: "8px",
                    height: "8px",
                    backgroundColor: currentSlide === index ? "#0068ff" : "#dee2e6",
                  }}
                  onClick={() => setCurrentSlide(index)}
                />
              ))}
            </div>
          </div>
        </div>

        <button
          className="position-absolute start-0 top-50 translate-middle-y ms-4 rounded-circle bg-white shadow-sm border-0 d-flex align-items-center justify-content-center"
          style={{ width: "40px", height: "40px" }}
          onClick={handlePrevSlide}
        >
          <ChevronLeft size={20} />
        </button>

        <button
          className="position-absolute end-0 top-50 translate-middle-y me-4 rounded-circle bg-white shadow-sm border-0 d-flex align-items-center justify-content-center"
          style={{ width: "40px", height: "40px" }}
          onClick={handleNextSlide}
        >
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
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