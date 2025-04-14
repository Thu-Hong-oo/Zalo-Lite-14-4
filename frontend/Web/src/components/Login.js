import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Phone, Lock } from "lucide-react"

export default function Login() {
  const [activeTab, setActiveTab] = useState("phone")
  const [phoneNumber, setPhoneNumber] = useState("")
  const [password, setPassword] = useState("")

  const handleSubmit = (e) => {
    e.preventDefault()
    console.log("Login attempt with:", { phoneNumber, password })
    // Handle login logic here
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 to-blue-200">
      <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-lg">
        {/* Logo */}
        <div className="flex flex-col items-center mb-6">
          <div className="text-5xl font-bold text-blue-500 mb-4">Zalo</div>
          <div className="text-gray-600 text-center mb-1">Đăng nhập bằng tài khoản Zalo</div>
          <div className="text-gray-500 text-sm">chat.zalo.me</div>
        </div>

        {/* Tabs */}
        <div className="flex border-b mb-6">
          <button
            className={`flex-1 py-2 text-center font-medium ${
              activeTab === "phone" ? "text-blue-500 border-b-2 border-blue-500" : "text-gray-500"
            }`}
            onClick={() => setActiveTab("phone")}
          >
            VỚI SỐ ĐIỆN THOẠI
          </button>
          <button
            className={`flex-1 py-2 text-center font-medium ${
              activeTab === "qr" ? "text-blue-500 border-b-2 border-blue-500" : "text-gray-500"
            }`}
            onClick={() => setActiveTab("qr")}
          >
            VỚI MÃ QR
          </button>
        </div>

        {/* QR Code Tab Content */}
        {activeTab === "qr" && (
          <div className="flex flex-col items-center">
            <div className="border p-4 rounded-lg mb-4">
              <Image
                src="/placeholder.svg?height=200&width=200"
                alt="QR Code"
                width={200}
                height={200}
                className="mx-auto"
              />
            </div>
            <p className="text-gray-500 text-sm text-center">Quét mã QR bằng Zalo để đăng nhập</p>
          </div>
        )}

        {/* Phone Number Tab Content */}
        {activeTab === "phone" && (
          <div>
            <form onSubmit={handleSubmit}>
              {/* Phone Number Input */}
              <div className="mb-4">
                <div className="flex items-center border rounded-md">
                  <div className="flex items-center px-3 py-2 border-r">
                    <Phone className="h-5 w-5 text-gray-400" />
                    <span className="ml-2 text-gray-600">+84</span>
                    <span className="ml-1 text-gray-400">▼</span>
                  </div>
                  <input
                    type="text"
                    placeholder="Số điện thoại"
                    className="flex-1 p-2 outline-none"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="mb-6">
                <div className="flex items-center border rounded-md">
                  <div className="px-3 py-2">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="password"
                    placeholder="Mật khẩu"
                    className="flex-1 p-2 outline-none"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>

              {/* Login Button */}
              <button type="submit" className="w-full bg-blue-400 hover:bg-blue-500 text-white py-2 rounded-md mb-4">
                Đăng nhập với mật khẩu
              </button>
            </form>

            {/* Additional Options */}
            <div className="flex flex-col items-center gap-2 text-sm">
              <Link href="#" className="text-blue-400 hover:text-blue-500">
                Gửi yêu cầu đăng nhập
              </Link>
              <Link href="#" className="text-gray-500 hover:text-gray-600">
                Quên mật khẩu?
              </Link>
            </div>
          </div>
        )}

        {/* Register Link */}
        <div className="mt-6 text-center text-sm">
          <span className="text-gray-600">Bạn chưa có tài khoản? </span>
          <Link href="#" className="text-blue-500 hover:text-blue-600">
            Đăng ký ngay!
          </Link>
        </div>
      </div>
    </div>
  )
}
