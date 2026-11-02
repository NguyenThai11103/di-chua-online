# Đi Chùa Online contributor notes

- Đây là website tĩnh tâm độc lập, không phải công cụ livestream và không kết nối mạng xã hội.
- Mọi giao diện mới phải hoạt động tốt từ màn hình rộng 320 px đến desktop.
- Giữ trải nghiệm tôn trọng, nhẹ nhàng; không dùng cơ chế quà tặng trả phí hoặc ngôn ngữ thúc ép tương tác.
- `src/App.tsx` quản lý trạng thái phiên hiện tại; dữ liệu tên và lời nguyện không được lưu trên server.
- `src/components/ChanhDienStage.tsx` là sân khấu 3D; `src/components/VisitorPanel.tsx` là khu tương tác chính.
- `server.ts` phục vụ Vite/static assets, endpoint TTS và chat thời gian thực SSE lưu tạm trong RAM.
- Trước khi bàn giao, chạy `npm run lint`, `npm run build` và `git diff --check`.
